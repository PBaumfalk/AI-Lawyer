"use client";

import { useState } from "react";
import { AlertTriangle, RotateCcw, Eye, PenLine, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

type RecoveryState =
  | "idle"       // Show 3 recovery buttons
  | "retrying"   // OCR retry in progress
  | "vision"     // Vision analysis in progress
  | "manual"     // Manual text entry textarea expanded
  | "saving"     // Saving manual text
  | "success"    // Recovery succeeded (flash green, then auto-hide or refetch)
  | "error";     // Recovery failed (show error message + reset to idle)

interface OcrRecoveryBannerProps {
  dokumentId: string;
  akteId: string;
  mimeType: string;
  ocrFehler: string | null;
  onRecoveryComplete: () => void;
}

export function OcrRecoveryBanner({
  dokumentId,
  akteId,
  mimeType,
  ocrFehler,
  onRecoveryComplete,
}: OcrRecoveryBannerProps) {
  const [state, setState] = useState<RecoveryState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [manualText, setManualText] = useState("");

  const isImage = mimeType.startsWith("image/");

  const handleRetryOcr = async () => {
    setState("retrying");
    try {
      const res = await fetch(`/api/dokumente/${dokumentId}/ocr`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Neustarten der OCR");
      }
      toast.success("OCR wird erneut gestartet");
      setState("success");
      setTimeout(() => onRecoveryComplete(), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      setErrorMessage(message);
      setState("error");
    }
  };

  const handleVisionAnalyse = async () => {
    setState("vision");
    try {
      const res = await fetch(`/api/dokumente/${dokumentId}/vision`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Vision-Analyse fehlgeschlagen");
      }
      toast.success(`Text erfolgreich extrahiert (${data.textLength ?? 0} Zeichen)`);
      setState("success");
      setTimeout(() => onRecoveryComplete(), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      setErrorMessage(message);
      setState("error");
    }
  };

  const handleManualSave = async () => {
    if (!manualText.trim()) return;
    setState("saving");
    try {
      const res = await fetch(`/api/dokumente/${dokumentId}/manual-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: manualText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Fehler beim Speichern");
      }
      toast.success("Text erfolgreich gespeichert");
      setState("success");
      setManualText("");
      setTimeout(() => onRecoveryComplete(), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      setErrorMessage(message);
      setState("error");
    }
  };

  // Success state
  if (state === "success") {
    return (
      <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30 rounded-xl p-4">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-medium">Text erfolgreich extrahiert</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Texterkennung fehlgeschlagen
          </p>
          {ocrFehler && (
            <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-0.5 truncate">
              {ocrFehler}
            </p>
          )}
        </div>
      </div>

      {/* Error state */}
      {state === "error" && (
        <div className="mb-3 p-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-800/30 rounded-lg">
          <p className="text-xs text-rose-600 dark:text-rose-400">{errorMessage}</p>
          <button
            onClick={() => {
              setState("idle");
              setErrorMessage("");
            }}
            className="text-xs text-rose-600 dark:text-rose-400 underline mt-1 hover:text-rose-800 dark:hover:text-rose-300"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Action buttons - idle state */}
      {state === "idle" && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleRetryOcr}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            OCR erneut starten
          </button>
          {isImage && (
            <button
              onClick={handleVisionAnalyse}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              Vision-Analyse
            </button>
          )}
          <button
            onClick={() => setState("manual")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
          >
            <PenLine className="w-3.5 h-3.5" />
            Text manuell eingeben
          </button>
        </div>
      )}

      {/* Loading states */}
      {state === "retrying" && (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">OCR wird erneut gestartet...</span>
        </div>
      )}
      {state === "vision" && (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Vision-Analyse laeuft...</span>
        </div>
      )}
      {state === "saving" && (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Text wird gespeichert...</span>
        </div>
      )}

      {/* Manual text entry */}
      {state === "manual" && (
        <div className="space-y-2">
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Dokumenttext hier einfuegen..."
            className="w-full min-h-32 p-3 text-sm border border-amber-200 dark:border-amber-800 rounded-lg bg-white/80 dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualSave}
              disabled={!manualText.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Speichern
            </button>
            <button
              onClick={() => {
                setState("idle");
                setManualText("");
              }}
              className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
