"use client";

import { useState } from "react";
import { useBeaSession } from "@/lib/bea/session";
import { beaSendEeb } from "@/lib/bea/client";
import { buildEebBestaetigung } from "@/lib/bea/versand";
import { CheckCircle2, Loader2, AlertCircle, FileCheck } from "lucide-react";

interface EebButtonProps {
  messageId: string;
  nachrichtenId: string;
  onConfirmed: () => void;
}

export function EebButton({ messageId, nachrichtenId, onConfirmed }: EebButtonProps) {
  const { session, isAuthenticated } = useBeaSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!isAuthenticated || !session) {
      setError("beA-Sitzung ist nicht aktiv. Bitte melden Sie sich zuerst an.");
      return;
    }

    if (!nachrichtenId) {
      setError("Nachricht hat keine beA-Nachrichten-ID; eEB nicht moeglich.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Send eEB via bea.expert client (browser-side)
      const eebDate = new Date();
      const result = await beaSendEeb(session, nachrichtenId, eebDate);

      // Step 2: record only an eEB that bea.expert confirmed (throws otherwise;
      // nothing is stored and the error is shown)
      const bestaetigung = buildEebBestaetigung(result, nachrichtenId, eebDate);
      const res = await fetch(`/api/bea/messages/${messageId}/eeb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bestaetigung),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          `eEB wurde ueber beA abgegeben, aber nicht gespeichert: ${data.error || res.status}. Bitte manuell vermerken.`
        );
      }

      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Wird bestaetigt...
          </>
        ) : (
          <>
            <FileCheck className="h-4 w-4" />
            Empfangsbekenntnis bestaetigen
          </>
        )}
      </button>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 p-3">
          <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
        </div>
      )}
    </div>
  );
}
