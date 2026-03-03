"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save, ChevronDown, ChevronRight, Eye } from "lucide-react";

interface NaechsteSchritteEditorProps {
  akteId: string;
  initialText: string | null;
}

export function NaechsteSchritteEditor({
  akteId,
  initialText,
}: NaechsteSchritteEditorProps) {
  const [text, setText] = useState(initialText ?? "");
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(!!initialText);

  async function handleSave() {
    if (saving) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/akten/${akteId}/naechste-schritte`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() || null }),
      });

      if (!res.ok) {
        throw new Error("Save failed");
      }

      toast.success("Naechste Schritte gespeichert");
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-card rounded-xl border border-[var(--glass-border-color)] overflow-hidden">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-4 text-left hover:bg-[var(--glass-card-bg)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Naechste Schritte (fuer Mandant)
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Dieser Text ist fuer den Mandanten im Portal sichtbar.
          </p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="z.B. Wir warten auf die Antwort des Gerichts. Voraussichtlich bis Ende des Monats."
            rows={4}
            className="glass-input w-full rounded-lg px-3 py-2 text-sm resize-y min-h-[80px] border border-[var(--glass-border-color)] focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
