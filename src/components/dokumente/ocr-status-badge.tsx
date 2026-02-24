"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type OcrStatus =
  | "AUSSTEHEND"
  | "IN_BEARBEITUNG"
  | "ABGESCHLOSSEN"
  | "FEHLGESCHLAGEN"
  | "NICHT_NOETIG";

interface OcrStatusBadgeProps {
  status: OcrStatus;
  dokumentId: string;
  /** Callback when OCR is manually retried */
  onRetry?: () => void;
}

/**
 * Color-coded OCR status badge component.
 * Shows processing state with retry button for failed documents.
 */
export function OcrStatusBadge({ status, dokumentId, onRetry }: OcrStatusBadgeProps) {
  const [retrying, setRetrying] = useState(false);

  // Hide badge for documents that don't need OCR
  if (status === "NICHT_NOETIG") return null;

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setRetrying(true);

    try {
      const res = await fetch(`/api/dokumente/${dokumentId}/ocr`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Neustarten");
      }
      toast.success("OCR wird erneut gestartet");
      onRetry?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast.error(message);
    } finally {
      setRetrying(false);
    }
  };

  switch (status) {
    case "AUSSTEHEND":
      return (
        <Badge
          variant="secondary"
          className="text-[10px] bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 gap-1"
        >
          OCR ausstehend
        </Badge>
      );

    case "IN_BEARBEITUNG":
      return (
        <Badge
          variant="secondary"
          className="text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 gap-1"
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          OCR laeuft...
        </Badge>
      );

    case "ABGESCHLOSSEN":
      return (
        <Badge
          variant="secondary"
          className="text-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 gap-1"
        >
          OCR abgeschlossen
        </Badge>
      );

    case "FEHLGESCHLAGEN":
      return (
        <div className="flex items-center gap-1">
          <Badge
            variant="secondary"
            className="text-[10px] bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400 gap-1"
          >
            OCR fehlgeschlagen
          </Badge>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="p-0.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-500 hover:text-rose-700 transition-colors"
            title="OCR erneut starten"
          >
            {retrying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      );

    default:
      return null;
  }
}
