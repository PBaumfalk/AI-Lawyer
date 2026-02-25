"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface AdminOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  akteId: string;
  aktenzeichen: string;
}

export function AdminOverrideDialog({
  open,
  onOpenChange,
  akteId,
  aktenzeichen,
}: AdminOverrideDialogProps) {
  const [grund, setGrund] = useState("");
  const [gueltigBis, setGueltigBis] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!grund.trim()) {
      setError("Grund ist erforderlich");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const body: Record<string, string> = { akteId, grund: grund.trim() };
      if (gueltigBis) {
        body.gueltigBis = new Date(gueltigBis).toISOString();
      }

      const res = await fetch("/api/admin/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler beim Erstellen der Zugriffsueberschreibung");
        return;
      }

      setSuccess(true);
      setGrund("");
      setGueltigBis("");
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
      }, 1000);
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Zugriff uebernehmen</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-md hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 text-sm text-rose-700 bg-rose-50 rounded-md border border-rose-200">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-md border border-emerald-200">
              Zugriffsueberschreibung erfolgreich erstellt
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Sie erstellen eine Admin-Zugriffsueberschreibung fuer Akte{" "}
            <span className="font-medium text-foreground">{aktenzeichen}</span>.
            Bitte geben Sie einen Grund an.
          </p>

          <div>
            <label className="block text-sm font-medium mb-1">Grund *</label>
            <textarea
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm"
              rows={3}
              placeholder="Grund fuer die Zugriffsueberschreibung..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Gueltig bis (optional)
            </label>
            <input
              type="date"
              value={gueltigBis}
              onChange={(e) => setGueltigBis(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ohne Angabe gilt die Ueberschreibung unbefristet.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-muted transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || success}
            className="px-4 py-2 text-sm font-medium rounded-md bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Erstelle..." : "Zugriff uebernehmen"}
          </button>
        </div>
      </div>
    </div>
  );
}
