"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, HelpCircle, Shield } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PruefprotokollData {
  ergebnis?: string;
  zeitpunkt?: string;
  details?: Array<{
    pruefung: string;
    ergebnis: string;
    hinweis?: string;
  }>;
}

interface PruefprotokollViewerProps {
  data: PruefprotokollData;
}

// ─── Result Icons ────────────────────────────────────────────────────────────

function ResultIcon({ result }: { result: string }) {
  const lower = result.toLowerCase();
  if (lower.includes("gueltig") || lower.includes("ok") || lower.includes("bestanden") || lower === "true") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }
  if (lower.includes("ungueltig") || lower.includes("fehler") || lower.includes("failed") || lower === "false") {
    return <XCircle className="h-4 w-4 text-rose-500" />;
  }
  return <HelpCircle className="h-4 w-4 text-amber-500" />;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PruefprotokollViewer({ data }: PruefprotokollViewerProps) {
  const [expanded, setExpanded] = useState(false);

  if (!data) return null;

  const details = Array.isArray(data.details) ? data.details : [];
  const overallResult = data.ergebnis || "UNBEKANNT";

  const overallColorClass =
    overallResult === "GUELTIG"
      ? "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30"
      : overallResult === "UNGUELTIG"
      ? "text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30"
      : "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30";

  return (
    <div className={`rounded-xl border p-4 ${overallColorClass}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <Shield className="h-4 w-4" />
        <span className="text-sm font-medium">
          Pruefprotokoll: {overallResult}
        </span>
        {data.zeitpunkt && (
          <span className="text-xs opacity-70 ml-auto">
            {formatDate(data.zeitpunkt)}
          </span>
        )}
      </button>

      {expanded && details.length > 0 && (
        <div className="mt-4 border-t border-current/10 pt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="pb-2 font-medium opacity-70">Pruefschritt</th>
                <th className="pb-2 font-medium opacity-70 w-24">Ergebnis</th>
                <th className="pb-2 font-medium opacity-70">Details</th>
              </tr>
            </thead>
            <tbody>
              {details.map((detail, idx) => (
                <tr key={idx} className="border-t border-current/5">
                  <td className="py-2 pr-3">{detail.pruefung}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1.5">
                      <ResultIcon result={detail.ergebnis} />
                      <span className="text-xs">{detail.ergebnis}</span>
                    </div>
                  </td>
                  <td className="py-2 text-xs opacity-70">{detail.hinweis || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
