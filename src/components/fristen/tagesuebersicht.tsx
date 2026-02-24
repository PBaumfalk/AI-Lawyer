"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { FristenAmpel } from "./fristen-ampel";
import {
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Printer,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface KalenderItem {
  id: string;
  typ: "TERMIN" | "FRIST" | "WIEDERVORLAGE";
  titel: string;
  datum: string;
  datumBis: string | null;
  erledigt: boolean;
  prioritaet: string;
  istNotfrist: boolean;
  akteId: string | null;
  verantwortlichId: string;
  akte: { id: string; aktenzeichen: string; kurzrubrum: string } | null;
  verantwortlich: { id: string; name: string } | null;
}

/**
 * Tagesuebersicht Dashboard Widget
 *
 * Shows three sections:
 * 1. Fristen: Today's + overdue, with FristenAmpel
 * 2. Wiedervorlagen: Today's WV
 * 3. Termine: Today's appointments with time/location
 *
 * Quick actions: Erledigen, Oeffnen Akte
 */
export function Tagesuebersicht() {
  const [fristen, setFristen] = useState<KalenderItem[]>([]);
  const [wiedervorlagen, setWiedervorlagen] = useState<KalenderItem[]>([]);
  const [termine, setTermine] = useState<KalenderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erledigungDialog, setErledigungDialog] = useState<{
    id: string;
    titel: string;
  } | null>(null);
  const [erledigungsgrund, setErledigungsgrund] = useState("");
  const [erledigungSaving, setErledigungSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch overdue + today's entries
      const [overdueRes, todayRes] = await Promise.all([
        // Overdue (past, not erledigt)
        fetch(
          `/api/kalender?erledigt=false&bis=${today.toISOString()}`
        ).then((r) => r.json()),
        // Today's entries
        fetch(
          `/api/kalender?erledigt=false&von=${today.toISOString()}&bis=${tomorrow.toISOString()}`
        ).then((r) => r.json()),
      ]);

      const overdueItems: KalenderItem[] = Array.isArray(overdueRes)
        ? overdueRes
        : [];
      const todayItems: KalenderItem[] = Array.isArray(todayRes)
        ? todayRes
        : [];

      // Combine and deduplicate
      const allItems = new Map<string, KalenderItem>();
      for (const item of [...overdueItems, ...todayItems]) {
        allItems.set(item.id, item);
      }

      const items = Array.from(allItems.values());

      // Sort: overdue first, then by date proximity
      const now = Date.now();
      items.sort((a, b) => {
        const aDiff = new Date(a.datum).getTime() - now;
        const bDiff = new Date(b.datum).getTime() - now;
        // Overdue items (negative diff) come first
        if (aDiff < 0 && bDiff >= 0) return -1;
        if (bDiff < 0 && aDiff >= 0) return 1;
        return Math.abs(aDiff) - Math.abs(bDiff);
      });

      setFristen(items.filter((i) => i.typ === "FRIST"));
      setWiedervorlagen(items.filter((i) => i.typ === "WIEDERVORLAGE"));
      setTermine(items.filter((i) => i.typ === "TERMIN"));
    } catch {
      toast.error("Tagesuebersicht konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Erledigen
  const handleErledigen = async () => {
    if (!erledigungDialog) return;
    if (!erledigungsgrund.trim()) {
      toast.error("Bitte einen Erledigungsgrund angeben");
      return;
    }
    setErledigungSaving(true);
    try {
      const res = await fetch(
        `/api/kalender/${erledigungDialog.id}/erledigt`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            erledigt: true,
            erledigungsgrund: erledigungsgrund.trim(),
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Fehler");
      }
      toast.success("Erledigt!");
      setErledigungDialog(null);
      setErledigungsgrund("");
      fetchData(); // Refresh
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setErledigungSaving(false);
    }
  };

  // Print Fristenzettel
  const handlePrintFristenzettel = () => {
    const today = new Date().toISOString().split("T")[0];
    window.open(
      `/api/fristen/fristenzettel?format=daily&datum=${today}`,
      "_blank"
    );
  };

  if (loading) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Lade Tagesuebersicht...
          </span>
        </div>
      </GlassCard>
    );
  }

  const totalItems = fristen.length + wiedervorlagen.length + termine.length;

  return (
    <>
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading text-foreground">
            Tagesuebersicht
          </h2>
          <span className="text-xs text-muted-foreground">
            {format(new Date(), "EEEE, dd. MMMM yyyy", { locale: de })}
          </span>
        </div>

        {totalItems === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Keine Eintraege fuer heute.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Fristen Section */}
            {fristen.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-rose-500" />
                    Fristen ({fristen.length})
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrintFristenzettel}
                    className="text-[10px] h-6 px-2"
                  >
                    <Printer className="w-3 h-3 mr-1" />
                    Fristenzettel
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {fristen.map((frist) => (
                    <div
                      key={frist.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/30 dark:hover:bg-white/[0.05] transition-colors group"
                    >
                      <FristenAmpel datum={frist.datum} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground truncate">
                            {frist.titel}
                          </span>
                          {frist.istNotfrist && (
                            <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold bg-rose-600 text-white shrink-0">
                              NF
                            </span>
                          )}
                        </div>
                        {frist.akte && (
                          <span className="text-xs text-muted-foreground">
                            {frist.akte.aktenzeichen} -- {frist.akte.kurzrubrum}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground block">
                          {format(new Date(frist.datum), "dd.MM.yyyy", {
                            locale: de,
                          })}{" "}
                          | {frist.verantwortlich?.name ?? "--"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() =>
                            setErledigungDialog({
                              id: frist.id,
                              titel: frist.titel,
                            })
                          }
                          className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                          title="Erledigen"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        {frist.akte && (
                          <Link
                            href={`/akten/${frist.akte.id}`}
                            className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                            title="Akte oeffnen"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wiedervorlagen Section */}
            {wiedervorlagen.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Wiedervorlagen ({wiedervorlagen.length})
                </h3>
                <div className="space-y-1.5">
                  {wiedervorlagen.map((wv) => (
                    <div
                      key={wv.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/30 dark:hover:bg-white/[0.05] transition-colors group"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate block">
                          {wv.titel}
                        </span>
                        {wv.akte && (
                          <span className="text-xs text-muted-foreground">
                            {wv.akte.aktenzeichen} -- {wv.akte.kurzrubrum}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() =>
                            setErledigungDialog({
                              id: wv.id,
                              titel: wv.titel,
                            })
                          }
                          className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                          title="Erledigen"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        {wv.akte && (
                          <Link
                            href={`/akten/${wv.akte.id}`}
                            className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                            title="Akte oeffnen"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Termine Section */}
            {termine.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Termine ({termine.length})
                </h3>
                <div className="space-y-1.5">
                  {termine.map((termin) => (
                    <div
                      key={termin.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/30 dark:hover:bg-white/[0.05] transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate block">
                          {termin.titel}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(termin.datum), "HH:mm", {
                            locale: de,
                          })}{" "}
                          Uhr
                          {termin.datumBis &&
                            ` -- ${format(new Date(termin.datumBis), "HH:mm", { locale: de })} Uhr`}
                        </span>
                        {termin.akte && (
                          <span className="text-xs text-muted-foreground block">
                            {termin.akte.aktenzeichen}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Erledigungsgrund Dialog */}
      {erledigungDialog && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setErledigungDialog(null);
              setErledigungsgrund("");
            }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-slate-950 rounded-xl shadow-2xl border border-white/20 dark:border-white/[0.08] p-6">
            <h3 className="text-sm font-heading text-foreground mb-3">
              Erledigen: {erledigungDialog.titel}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Erledigungsgrund <span className="text-rose-500">*</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Grund der Erledigung..."
                  value={erledigungsgrund}
                  onChange={(e) => setErledigungsgrund(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setErledigungDialog(null);
                    setErledigungsgrund("");
                  }}
                >
                  Abbrechen
                </Button>
                <Button
                  size="sm"
                  onClick={handleErledigen}
                  disabled={erledigungSaving || !erledigungsgrund.trim()}
                >
                  {erledigungSaving && (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  )}
                  Erledigen
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
