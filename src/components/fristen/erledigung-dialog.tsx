"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  buildErledigtRequest,
  erledigungsAnforderungen,
} from "@/lib/fristen/erledigung";

export interface ErledigungsDialogEintrag {
  id: string;
  typ: string;
  titel: string;
  datum: string;
}

interface ErledigungDialogProps {
  eintrag: ErledigungsDialogEintrag | null;
  onClose: () => void;
  onErledigt: () => void;
}

/**
 * Fragt vor dem Erledigen die Gründe ab, die PATCH /api/kalender/[id]/erledigt
 * verlangt (gemeinsame Regeln in src/lib/fristen/erledigung.ts):
 * Erledigungsgrund für Fristen, zusätzlich Überschreitungsgrund für überfällige Fristen.
 */
export function ErledigungDialog({ eintrag, onClose, onErledigt }: ErledigungDialogProps) {
  const [erledigungsgrund, setErledigungsgrund] = useState("");
  const [ueberschreitungsgrund, setUeberschreitungsgrund] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setErledigungsgrund("");
    setUeberschreitungsgrund("");
  }, [eintrag?.id]);

  if (!eintrag) return null;

  const anf = erledigungsAnforderungen(eintrag);
  const fehlt =
    (anf.erledigungsgrund && !erledigungsgrund.trim()) ||
    (anf.ueberschreitungsgrund && !ueberschreitungsgrund.trim());

  const handleErledigen = async () => {
    if (fehlt) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/kalender/${eintrag.id}/erledigt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildErledigtRequest(true, { erledigungsgrund, ueberschreitungsgrund }),
        ),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Status konnte nicht geändert werden");
      }
      toast.success("Als erledigt markiert");
      onErledigt();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const textareaClass =
    "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="erledigung-titel"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-slate-950 rounded-xl shadow-2xl border border-white/20 dark:border-white/[0.08] p-6"
      >
        <h3 id="erledigung-titel" className="text-sm font-heading text-foreground mb-1">
          Erledigen: {eintrag.titel}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          {anf.ueberschreitungsgrund ? "Fristablauf war am " : "Fällig am "}
          {format(new Date(eintrag.datum), "dd.MM.yyyy", { locale: de })}
        </p>
        <div className="space-y-3">
          <div>
            <label htmlFor="erledigungsgrund" className="text-xs text-muted-foreground block mb-1">
              Erledigungsgrund{" "}
              {anf.erledigungsgrund ? <span className="text-rose-500">*</span> : "(optional)"}
            </label>
            <textarea
              id="erledigungsgrund"
              className={textareaClass}
              rows={3}
              placeholder="z. B. Schriftsatz per beA eingereicht"
              value={erledigungsgrund}
              onChange={(e) => setErledigungsgrund(e.target.value)}
              autoFocus
            />
          </div>
          {anf.ueberschreitungsgrund && (
            <div>
              <label htmlFor="ueberschreitungsgrund" className="text-xs text-rose-600 dark:text-rose-400 block mb-1">
                Diese Frist ist abgelaufen. Grund der Überschreitung{" "}
                <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="ueberschreitungsgrund"
                className={textareaClass}
                rows={3}
                placeholder="z. B. rechtzeitig erledigt, Eintrag nur verspätet abgehakt"
                value={ueberschreitungsgrund}
                onChange={(e) => setUeberschreitungsgrund(e.target.value)}
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={handleErledigen} disabled={saving || fehlt}>
              {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Erledigen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
