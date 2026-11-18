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
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import {
  ErledigungDialog,
  type ErledigungsDialogEintrag,
} from "./erledigung-dialog";
import { gruppiereTagesuebersicht } from "@/lib/fristen/tagesuebersicht";
import { kanzleiTag } from "@/lib/fristen/erledigung";
import type { KalenderListenEintrag } from "@/lib/kalender/eintrag";

type KalenderItem = KalenderListenEintrag;

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
  const [externeTermine, setExterneTermine] = useState<KalenderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erledigungDialog, setErledigungDialog] =
    useState<ErledigungsDialogEintrag | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Everything open up to the end of today; grouping decides what is shown
      const res = await fetch(
        `/api/kalender?erledigt=false&bis=${tomorrow.toISOString()}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      const gruppen = gruppiereTagesuebersicht<KalenderItem>(
        Array.isArray(data) ? data : []
      );

      setFristen(gruppen.fristen);
      setWiedervorlagen(gruppen.wiedervorlagen);
      setTermine(gruppen.termine);
      setExterneTermine(gruppen.externeTermine);
    } catch {
      toast.error("Tagesuebersicht konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reload when an entry was created elsewhere (e.g. Fristenrechner)
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("kalender:geaendert", handler);
    return () => window.removeEventListener("kalender:geaendert", handler);
  }, [fetchData]);

  // Print Fristenzettel
  const handlePrintFristenzettel = () => {
    const today = kanzleiTag(new Date());
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

  const totalItems = fristen.length + wiedervorlagen.length + termine.length + externeTermine.length;

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
                            setErledigungDialog(frist)
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
                            setErledigungDialog(wv)
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

            {/* Externe Kalender Section */}
            {externeTermine.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-2">
                  <Globe className="w-4 h-4 text-purple-500" />
                  Externe Kalender ({externeTermine.length})
                </h3>
                <div className="space-y-1.5">
                  {externeTermine.map((ext) => (
                    <div
                      key={ext.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/30 dark:hover:bg-white/[0.05] transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate block">
                          {ext.titel}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(ext.datum), "HH:mm", {
                            locale: de,
                          })}{" "}
                          Uhr
                          {ext.datumBis &&
                            ` -- ${format(new Date(ext.datumBis), "HH:mm", { locale: de })} Uhr`}
                        </span>
                        {ext.kontoName && (
                          <span className="text-[10px] text-muted-foreground block">
                            {ext.kontoName}
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

      {/* Erledigungsgrund / Ueberschreitungsgrund Dialog */}
      <ErledigungDialog
        eintrag={erledigungDialog}
        onClose={() => setErledigungDialog(null)}
        onErledigt={fetchData}
      />
    </>
  );
}
