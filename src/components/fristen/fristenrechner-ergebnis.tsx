"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { FristenAmpel } from "./fristen-ampel";
import {
  Save,
  Clock,
  ArrowRight,
  AlertTriangle,
  FileText,
  History,
} from "lucide-react";
import { toast } from "sonner";

interface FristenRechnerErgebnisProps {
  result: any;
}

// History stored in localStorage
const HISTORY_KEY = "fristenrechner-history";
const MAX_HISTORY = 10;

function saveToHistory(result: any) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    history.unshift({
      timestamp: new Date().toISOString(),
      result,
    });
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.slice(0, MAX_HISTORY))
    );
  } catch {
    // localStorage may be unavailable
  }
}

function getHistory(): any[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function formatDate(d: string | Date): string {
  return format(new Date(d), "dd.MM.yyyy (EEEE)", { locale: de });
}

/**
 * Displays the full FristErgebnis with Ampel, shift reasons, Vorfristen,
 * Halbfrist, Sonderfall annotations, and save/history functionality.
 */
export function FristenRechnerErgebnis({ result }: FristenRechnerErgebnisProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Save to history on new result
  useEffect(() => {
    if (result) {
      saveToHistory(result);
    }
  }, [result]);

  // Load history when toggle opens
  useEffect(() => {
    if (showHistory) {
      setHistory(getHistory());
    }
  }, [showHistory]);

  if (!result) return null;

  const isForward = result.richtung === "vorwaerts";
  const ergebnis = result.ergebnis;

  // Handle backward result
  if (!isForward) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <h3 className="text-sm font-heading text-blue-800 dark:text-blue-300 mb-3">
            Rueckwaertsberechnung
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Spaetester Zustellungstermin
              </span>
              <span className="text-sm font-semibold text-foreground">
                {formatDate(ergebnis.spaetesterZustellungstermin)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Fristende</span>
              <span className="text-sm text-foreground">
                {formatDate(ergebnis.fristende)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Forward result
  const endDatum = new Date(ergebnis.endDatum);

  // Save as KalenderEintrag
  const handleSave = async () => {
    setSaving(true);
    toast.info(
      "Zum Speichern als Frist bitte den Kalender-Dialog verwenden und die berechneten Daten uebernehmen."
    );
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Main result */}
      <div className="p-4 rounded-lg bg-white/50 dark:bg-white/[0.03] border border-white/20 dark:border-white/[0.08]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-heading text-foreground">Ergebnis</h3>
          <FristenAmpel datum={endDatum} showLabel size="md" />
        </div>

        <div className="space-y-2.5">
          {/* Start date */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Fristbeginn</span>
            <span className="text-sm text-foreground">
              {formatDate(ergebnis.startDatum)}
            </span>
          </div>

          {/* Raw end date (if different from final) */}
          {ergebnis.section193Angewendet && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Rechnerisches Ende
              </span>
              <span className="text-sm text-muted-foreground line-through">
                {formatDate(ergebnis.rohEndDatum)}
              </span>
            </div>
          )}

          {/* Final end date */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Fristende
            </span>
            <span className="text-sm font-bold text-foreground">
              {formatDate(ergebnis.endDatum)}
            </span>
          </div>
        </div>
      </div>

      {/* Sonderfall annotation */}
      {result.sonderfall && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800">
          <AlertTriangle className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-violet-700 dark:text-violet-400">
              Sonderfall angewendet
            </p>
            <p className="text-xs text-violet-600 dark:text-violet-400">
              {result.sonderfall.beschreibung}
            </p>
          </div>
        </div>
      )}

      {/* Notfrist badge */}
      {result.istNotfrist && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white">
            NOTFRIST
          </span>
          <span className="text-xs text-rose-700 dark:text-rose-400">
            Diese Frist ist nicht verlaengerbar!
          </span>
        </div>
      )}

      {/* Shift reasons */}
      {ergebnis.verschiebungsGruende && ergebnis.verschiebungsGruende.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1.5">
            Verschoben wegen:
          </p>
          <ul className="space-y-1">
            {ergebnis.verschiebungsGruende.map((v: any, i: number) => (
              <li
                key={i}
                className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5"
              >
                <ArrowRight className="w-3 h-3 shrink-0" />
                {v.grund} ({formatDate(v.datum)})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Vorfristen */}
      {result.vorfristen && result.vorfristen.length > 0 && (
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-medium text-foreground mb-1.5">
            Vorfristen
          </p>
          <div className="space-y-1">
            {result.vorfristen.map((vf: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-muted-foreground">
                  {vf.tageVorher} Tage vorher
                  {vf.verschoben ? " (verschoben)" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <FristenAmpel datum={vf.datum} size="sm" />
                  <span className="text-foreground">
                    {formatDate(vf.datum)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Halbfrist */}
      {result.halbfrist && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-700">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Halbfrist
          </span>
          <span className="text-xs font-medium text-foreground">
            {formatDate(result.halbfrist)}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          Als Frist speichern
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowHistory(!showHistory)}
        >
          <History className="w-3.5 h-3.5 mr-1.5" />
          Historie
        </Button>
      </div>

      {/* History */}
      {showHistory && (
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-medium text-foreground mb-2">
            Letzte {Math.min(history.length, MAX_HISTORY)} Berechnungen
          </p>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine Historie vorhanden.</p>
          ) : (
            <div className="space-y-1.5">
              {history.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span className="text-muted-foreground">
                    {format(new Date(entry.timestamp), "dd.MM. HH:mm")}
                  </span>
                  <span className="text-foreground">
                    {entry.result?.ergebnis?.endDatum
                      ? formatDate(entry.result.ergebnis.endDatum)
                      : "Rueckwaerts"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
