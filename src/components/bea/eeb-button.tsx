"use client";

import { useRef, useState } from "react";
import { Loader2, FileCheck } from "lucide-react";
import { heuteBerlin, minusKalendermonate, pruefeEebDatum } from "@/lib/bea/regeln";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hinweis } from "./bea-status";

interface EebButtonProps {
  messageId: string;
  /** Current eEB status; WIRD_ABGEGEBEN means a submission with unknown outcome. */
  eebStatus: string | null;
  onConfirmed: (ergebnis: { eebDatum: string; warnung?: string }) => void;
}

export const EEB_ABGABE_UNKLAR = "Abgabe unklar – bitte im beA-Webclient prüfen";

export function EebButton({ messageId, eebStatus, onConfirmed }: EebButtonProps) {
  const heute = heuteBerlin();
  const fruehestens = minusKalendermonate(heute, 2);
  const [abgabeDatum, setAbgabeDatum] = useState(heute);
  const [loading, setLoading] = useState(false);
  const laeuft = useRef(false); // guards against double submit before the state re-renders
  const [error, setError] = useState<string | null>(null);
  // 409: another submission is running or already done; the outcome must be checked in beA
  const [konflikt, setKonflikt] = useState(false);

  const unklar = eebStatus === "WIRD_ABGEGEBEN" || konflikt;
  const datumFehler = abgabeDatum ? pruefeEebDatum(abgabeDatum) : "Bitte ein Abgabedatum wählen";

  const handleConfirm = async () => {
    if (laeuft.current || unklar || datumFehler) return;
    laeuft.current = true;
    setLoading(true);
    setError(null);

    try {
      // The server submits the eEB through the beA provider and records it
      const res = await fetch(`/api/bea/messages/${encodeURIComponent(messageId)}/eeb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abgabeDatum }),
      });
      const data = await res.json().catch(() => ({}));
      // A 409 with details is the missing-certificate case, which is a plain error
      if (res.status === 409 && !data.details) {
        setKonflikt(true);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || `Das eEB konnte nicht abgegeben werden (${res.status})`);
      }
      onConfirmed({ eebDatum: data.eebDatum ?? `${abgabeDatum}T12:00:00Z`, warnung: data.warnung });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      laeuft.current = false;
      setLoading(false);
    }
  };

  if (unklar) {
    return (
      <div className="space-y-3">
        <Hinweis art="warnung">{EEB_ABGABE_UNKLAR}</Hinweis>
        <Button disabled>
          <FileCheck className="mr-2 h-4 w-4" />
          Empfangsbekenntnis abgeben
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`eeb-datum-${messageId}`}>Abgabedatum</Label>
          <Input
            id={`eeb-datum-${messageId}`}
            type="date"
            value={abgabeDatum}
            min={fruehestens}
            max={heute}
            onChange={(e) => setAbgabeDatum(e.target.value)}
            disabled={loading}
            className="w-44"
          />
        </div>
        <Button onClick={handleConfirm} disabled={loading || !!datumFehler}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Wird abgegeben…
            </>
          ) : (
            <>
              <FileCheck className="mr-2 h-4 w-4" />
              Empfangsbekenntnis abgeben
            </>
          )}
        </Button>
      </div>

      {datumFehler && <p className="text-xs text-destructive">{datumFehler}</p>}
      {error && <Hinweis art="fehler">{error}</Hinweis>}
    </div>
  );
}
