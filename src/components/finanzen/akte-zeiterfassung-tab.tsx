"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, Square, Plus, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface TimeEntry {
  id: string;
  datum: string;
  dauer: number;
  beschreibung: string;
  kategorie: string | null;
  abrechenbar: boolean;
  abgerechnet: boolean;
  userName: string;
  stundensatz: number | null;
}

interface Summary {
  totalMinuten: number;
  abrechenbarMinuten: number;
  effektiverStundensatz: number;
}

function formatDauer(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

interface AkteZeiterfassungTabProps {
  akteId: string;
}

export function AkteZeiterfassungTab({ akteId }: AkteZeiterfassungTabProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerAkteId, setTimerAkteId] = useState<string | null>(null);
  const [timerElapsed, setTimerElapsed] = useState("00:00:00");
  const [timerStartzeit, setTimerStartzeit] = useState<string | null>(null);
  const [timerLoading, setTimerLoading] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // New entry form
  const [showForm, setShowForm] = useState(false);
  const [newDauer, setNewDauer] = useState("");
  const [newBeschreibung, setNewBeschreibung] = useState("");
  const [newKategorie, setNewKategorie] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ akteId, seite: String(page), limit: "25" });
      const res = await fetch(`/api/finanzen/zeiterfassung?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(data.eintraege ?? []);
      setSummary(data.summary ?? null);
      setTotalPages(data.pagination?.seiten ?? 1);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [akteId, page]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Fetch active timer
  const fetchTimer = useCallback(async () => {
    try {
      const res = await fetch("/api/finanzen/zeiterfassung/timer");
      if (res.ok) {
        const data = await res.json();
        if (data.timer) {
          setTimerRunning(true);
          setTimerAkteId(data.timer.akteId);
          setTimerStartzeit(data.timer.startzeit);
        } else {
          setTimerRunning(false);
          setTimerAkteId(null);
          setTimerStartzeit(null);
        }
      }
    } catch { /* */ }
  }, []);

  useEffect(() => { fetchTimer(); }, [fetchTimer]);

  // Tick elapsed time
  useEffect(() => {
    if (timerRunning && timerStartzeit && timerAkteId === akteId) {
      const tick = () => {
        const start = new Date(timerStartzeit).getTime();
        const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        setTimerElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      };
      tick();
      timerIntervalRef.current = setInterval(tick, 1000);
      return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    } else {
      setTimerElapsed("00:00:00");
    }
  }, [timerRunning, timerStartzeit, timerAkteId, akteId]);

  const handleStartTimer = async () => {
    setTimerLoading(true);
    try {
      const res = await fetch("/api/finanzen/zeiterfassung/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ akteId }),
      });
      if (res.ok) {
        await fetchTimer();
      }
    } catch { /* */ } finally {
      setTimerLoading(false);
    }
  };

  const handleStopTimer = async () => {
    setTimerLoading(true);
    try {
      const res = await fetch("/api/finanzen/zeiterfassung/timer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setTimerRunning(false);
        setTimerAkteId(null);
        setTimerStartzeit(null);
        await fetchEntries();
      }
    } catch { /* */ } finally {
      setTimerLoading(false);
    }
  };

  const isTimerForThisAkte = timerRunning && timerAkteId === akteId;

  const handleCreate = async () => {
    if (!newDauer || !newBeschreibung.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/finanzen/zeiterfassung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          akteId,
          datum: new Date().toISOString(),
          dauer: parseInt(newDauer, 10),
          beschreibung: newBeschreibung.trim(),
          kategorie: newKategorie || undefined,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setNewDauer("");
        setNewBeschreibung("");
        setNewKategorie("");
        await fetchEntries();
      }
    } catch { /* */ } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-4">
            <p className="text-xs text-muted-foreground">Gesamt</p>
            <p className="text-lg font-semibold">{formatDauer(summary.totalMinuten)}</p>
          </div>
          <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-4">
            <p className="text-xs text-muted-foreground">Abrechenbar</p>
            <p className="text-lg font-semibold">{formatDauer(summary.abrechenbarMinuten)}</p>
          </div>
          <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-4">
            <p className="text-xs text-muted-foreground">Eff. Stundensatz</p>
            <p className="text-lg font-semibold">{formatEuro(summary.effektiverStundensatz)}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        {/* Timer */}
        <div className="flex items-center gap-3">
          {isTimerForThisAkte ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-lg font-mono font-semibold tabular-nums">{timerElapsed}</span>
              <button
                type="button"
                onClick={handleStopTimer}
                disabled={timerLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors disabled:opacity-50"
              >
                {timerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                Stop
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleStartTimer}
              disabled={timerLoading || (timerRunning && timerAkteId !== akteId)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 transition-colors disabled:opacity-50"
              title={timerRunning && timerAkteId !== akteId ? "Timer laeuft bereits fuer eine andere Akte" : undefined}
            >
              {timerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Timer starten
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          Manueller Eintrag
        </button>
      </div>

      {/* New entry form */}
      {showForm && (
        <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-6 space-y-4">
          <h3 className="font-semibold">Neuer Zeiteintrag</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Dauer (Minuten)</label>
              <input type="number" min="1" value={newDauer} onChange={(e) => setNewDauer(e.target.value)} placeholder="30" className="w-full h-10 px-3 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-muted-foreground mb-1">Beschreibung</label>
              <input type="text" value={newBeschreibung} onChange={(e) => setNewBeschreibung(e.target.value)} placeholder="Taetigkeit beschreiben" className="w-full h-10 px-3 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleCreate} disabled={saving || !newDauer || !newBeschreibung.trim()} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50">
              {saving ? "Speichern..." : "Speichern"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted/50 transition-colors">Abbrechen</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Datum</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Beschreibung</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Kategorie</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Dauer</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Bearbeiter</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Laden...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Keine Zeiteintraege vorhanden.</td></tr>
            ) : entries.map((e) => (
              <tr key={e.id} className="border-b border-border/50">
                <td className="p-3 text-muted-foreground">{formatDate(e.datum)}</td>
                <td className="p-3 text-foreground">{e.beschreibung}</td>
                <td className="p-3 text-muted-foreground">{e.kategorie ?? "—"}</td>
                <td className="p-3 text-right font-mono font-semibold">{formatDauer(e.dauer)}</td>
                <td className="p-3 text-muted-foreground">{e.userName}</td>
                <td className="p-3">
                  {e.abgerechnet ? (
                    <Badge variant="success">Abgerechnet</Badge>
                  ) : e.abrechenbar ? (
                    <Badge variant="default">Abrechenbar</Badge>
                  ) : (
                    <Badge variant="muted">Intern</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <span className="text-sm text-muted-foreground">Seite {page} von {totalPages}</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-md hover:bg-muted/50 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 rounded-md hover:bg-muted/50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
