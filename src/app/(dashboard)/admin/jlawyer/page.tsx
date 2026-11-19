"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/ui/glass-panel";
import { GlassCard } from "@/components/ui/glass-card";
import { toast } from "sonner";
import {
  Loader2,
  FileText,
  Users,
  Link,
  FolderOpen,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plug,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import type {
  JLawyerBenutzerOption,
  JLawyerConfigRequest,
  JLawyerConfigResponse,
  MigrationStartResponse,
  MigrationStatusResponse,
  MigrationStatusWert,
} from "@/lib/jlawyer/migration-status";
import type { JLawyerMigrationIssue } from "@/lib/jlawyer/types";

type MigrationStatus = Partial<MigrationStatusResponse> & { status: MigrationStatusWert };

const statusLabels: Record<string, string> = {
  idle: "Bereit",
  running: "Laueft...",
  done: "Abgeschlossen",
  error: "Fehler",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  idle: "outline",
  running: "secondary",
  done: "default",
  error: "destructive",
};

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString("de-DE");
  } catch {
    return ts;
  }
}

export default function JLawyerMigrationPage() {
  // Config state
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [standardVerantwortlicherId, setStandardVerantwortlicherId] = useState("");
  const [benutzer, setBenutzer] = useState<JLawyerBenutzerOption[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Connection test state
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Migration state
  const [migration, setMigration] = useState<MigrationStatus>({ status: "idle" });
  const [migrating, setMigrating] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Report UI state
  const [showErrors, setShowErrors] = useState(false);
  const [showHinweise, setShowHinweise] = useState(false);

  // Load config on mount
  const fetchConfig = useCallback(async () => {
    try {
      setConfigLoading(true);
      const res = await fetch("/api/admin/jlawyer");
      if (res.status === 403) {
        toast.error("Keine Berechtigung");
        return;
      }
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data: JLawyerConfigResponse = await res.json();
      setUrl(data.url || "");
      setUsername(data.username || "");
      setHasPassword(data.hasPassword);
      setStandardVerantwortlicherId(data.standardVerantwortlicherId ?? "");
      setBenutzer(data.benutzer ?? []);
    } catch {
      toast.error("Verbindungsdaten konnten nicht geladen werden");
    } finally {
      setConfigLoading(false);
    }
  }, []);

  // Load migration status on mount
  const fetchMigrationStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/jlawyer/migrate");
      if (!res.ok) return;
      const data: MigrationStatusResponse = await res.json();
      setMigration(data);
    } catch {
      // Ignore — non-critical on initial load
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchMigrationStatus();
  }, [fetchConfig, fetchMigrationStatus]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: JLawyerConfigRequest = { standardVerantwortlicherId };
      if (url) body.url = url;
      if (username) body.username = username;
      if (password) body.password = password;

      const res = await fetch("/api/admin/jlawyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 403) {
        toast.error("Keine Berechtigung");
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Speichern");
        return;
      }

      toast.success("Verbindungsdaten gespeichert");
      setPassword(""); // Clear password field after save
      setHasPassword(true);
    } catch {
      toast.error("Fehler beim Speichern der Verbindungsdaten");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const body: Record<string, string> = {};
      if (url) body.url = url;
      if (username) body.username = username;
      if (password) body.password = password;

      const res = await fetch("/api/admin/jlawyer/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 403) {
        setTestResult({ ok: false, error: "Keine Berechtigung" });
        return;
      }

      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : "Unbekannter Fehler" });
    } finally {
      setTesting(false);
    }
  };

  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/jlawyer/migrate");
        if (!res.ok) return;
        const data: MigrationStatusResponse = await res.json();
        setMigration(data);
        if (data.status === "done" || data.status === "error") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setMigrating(false);
        }
      } catch {
        // Continue polling on transient errors
      }
    }, 5000);
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setMigration({ status: "running", startedAt: new Date().toISOString() });
    startPolling();

    try {
      const res = await fetch("/api/admin/jlawyer/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.status === 403) {
        toast.error("Keine Berechtigung");
        setMigrating(false);
        setMigration({ status: "idle" });
        if (pollingRef.current) clearInterval(pollingRef.current);
        return;
      }

      const data: MigrationStartResponse = await res.json();
      if (!data.success) {
        toast.error(data.error || "Migration fehlgeschlagen");
        if (res.status === 409) {
          // Another run is active: show its state instead of an error
          await fetchMigrationStatus();
        } else {
          setMigration({ status: "error", report: data.report ?? null, abbruch: data.error });
        }
      } else {
        setMigration({
          status: "done",
          startedAt: migration.startedAt,
          finishedAt: new Date().toISOString(),
          report: data.report,
          abbruch: null,
        });
        toast.success("Migration abgeschlossen");
      }
    } catch (err) {
      toast.error("Fehler beim Starten der Migration");
      setMigration({ status: "error" });
    } finally {
      setMigrating(false);
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const errors: JLawyerMigrationIssue[] = migration.report?.errors ?? [];
  const hinweise: JLawyerMigrationIssue[] = migration.report?.hinweise ?? [];

  const statCards = migration.report
    ? [
        { label: "Akten", value: migration.report.akten, Icon: FileText },
        { label: "Kontakte", value: migration.report.kontakte, Icon: Users },
        { label: "Beteiligte", value: migration.report.beteiligte, Icon: Link },
        { label: "Dokumente", value: migration.report.dokumente, Icon: FolderOpen },
        { label: "Kalender", value: migration.report.kalender, Icon: Calendar },
      ]
    : [];

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold font-bold">J-Lawyer Migration</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Akten, Kontakte, Dokumente und Kalendereintraege aus J-Lawyer importieren. Ein erneuter
          Lauf legt nur fehlende Datensaetze an und aendert keine bereits uebernommenen.
        </p>
      </div>

      {/* Section 1: Connection configuration */}
      <GlassPanel elevation="panel" className="overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--glass-border-color)]">
          <div className="flex items-center gap-2">
            <Plug className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Verbindung konfigurieren</h2>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="jl-url">Server-URL</Label>
              <Input
                id="jl-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://jlawyer.example.com:8080"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jl-username">Benutzername</Label>
              <Input
                id="jl-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jl-password">Passwort</Label>
              <Input
                id="jl-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasPassword ? "\u25cf\u25cf\u25cf\u25cf\u25cf\u25cf\u25cf\u25cf" : "Passwort eingeben"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jl-standard">Standard-Verantwortlicher</Label>
              <select
                id="jl-standard"
                value={standardVerantwortlicherId}
                onChange={(e) => setStandardVerantwortlicherId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Startender Administrator</option>
                {benutzer.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.role})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Erhält Akten und Fristen, deren j-lawyer-Benutzer keinem Benutzer hier zugeordnet werden kann.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Speichern
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plug className="w-4 h-4 mr-2" />
              )}
              Verbindung testen
            </Button>

            {testResult !== null && (
              <div className="flex items-center gap-2">
                {testResult.ok ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      Verbunden
                    </Badge>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <Badge variant="destructive">
                      Fehler: {testResult.error || "Verbindung fehlgeschlagen"}
                    </Badge>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </GlassPanel>

      {/* Section 2: Migration control */}
      <GlassPanel elevation="panel" className="overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--glass-border-color)]">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Migration</h2>
            <Badge variant={statusVariants[migration.status] || "outline"}>
              {statusLabels[migration.status] || migration.status}
            </Badge>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {migration.status !== "running" && migration.abbruch && (
            <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
              <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{migration.abbruch}</p>
            </div>
          )}

          {migration.status === "running" && (
            <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800">
              <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              <div>
                <p className="font-medium">Migration laueft...</p>
                <p className="text-sm text-blue-600 mt-0.5">
                  Dies kann mehrere Minuten dauern. Der Status wird automatisch aktualisiert.
                </p>
              </div>
            </div>
          )}

          {(migration.startedAt || migration.finishedAt) && (
            <div className="text-sm text-muted-foreground space-y-1">
              {migration.startedAt && (
                <p>Gestartet: {formatTs(migration.startedAt)}</p>
              )}
              {migration.finishedAt && (
                <p>Beendet: {formatTs(migration.finishedAt)}</p>
              )}
            </div>
          )}

          <Button
            onClick={handleMigrate}
            disabled={migrating || migration.status === "running"}
          >
            {migrating || migration.status === "running" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Migration starten
          </Button>
        </div>
      </GlassPanel>

      {/* Section 3: Completion report */}
      {migration.report && (
        <GlassPanel elevation="panel" className="overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--glass-border-color)]">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Abschlussbericht</h2>
              {errors.length > 0 ? (
                <Badge variant="destructive">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {errors.length} Fehler
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Keine Fehler
                </Badge>
              )}
            </div>
          </div>
          <div className="p-6 space-y-6">
            {/* Stat cards grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {statCards.map(({ label, value, Icon }) => (
                <GlassCard key={label} className="p-4">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Icon className="w-6 h-6 text-muted-foreground" />
                    <span className="text-2xl font-bold">{value}</span>
                    <span className="text-xs text-muted-foreground">{label} neu</span>
                  </div>
                </GlassCard>
              ))}
            </div>

            {/* Error list */}
            {errors.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-2 text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors"
                  onClick={() => setShowErrors((v) => !v)}
                >
                  <AlertTriangle className="w-4 h-4" />
                  {errors.length} Fehler anzeigen
                  {showErrors ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {showErrors && (
                  <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                    {errors.slice(0, 20).map((err, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2 text-rose-700">
                          <span className="font-medium">{err.entity}</span>
                          <span className="text-rose-400">/</span>
                          <span className="font-mono text-xs text-rose-500">{err.id}</span>
                        </div>
                        <p className="text-rose-600 mt-0.5">{err.message}</p>
                      </div>
                    ))}
                    {errors.length > 20 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Und {errors.length - 20} weitere Fehler...
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Fallback notes (e.g. unmatched users) */}
            {hinweise.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800 transition-colors"
                  onClick={() => setShowHinweise((v) => !v)}
                >
                  <Info className="w-4 h-4" />
                  {hinweise.length} Hinweise (Ersatzzuordnungen) anzeigen
                  {showHinweise ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showHinweise && (
                  <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                    {hinweise.slice(0, 200).map((h, i) => (
                      <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm">
                        <div className="flex items-center gap-2 text-amber-800">
                          <span className="font-medium">{h.entity}</span>
                          <span className="text-amber-400">/</span>
                          <span className="font-mono text-xs text-amber-600">{h.id}</span>
                        </div>
                        <p className="text-amber-700 mt-0.5">{h.message}</p>
                      </div>
                    ))}
                    {hinweise.length > 200 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Und {hinweise.length - 200} weitere Hinweise...
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </GlassPanel>
      )}
    </div>
  );
}
