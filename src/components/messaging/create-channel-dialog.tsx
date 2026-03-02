"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (channel: { id: string; name: string; slug: string }) => void;
}

export function CreateChannelDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateChannelDialogProps) {
  const [name, setName] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = name.trim();
      if (!trimmedName || submitting) return;

      setSubmitting(true);
      try {
        const res = await fetch("/api/channels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            beschreibung: beschreibung.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Fehler beim Erstellen");
        }

        const data = await res.json();
        toast.success(`Kanal "${trimmedName}" erstellt`);
        onCreated(data.channel);
        onOpenChange(false);
        // Reset form
        setName("");
        setBeschreibung("");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Fehler beim Erstellen"
        );
      } finally {
        setSubmitting(false);
      }
    },
    [name, beschreibung, submitting, onCreated, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel-elevated sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuer Kanal</DialogTitle>
          <DialogDescription>
            Erstelle einen neuen Kanal fuer die Kanzlei-Kommunikation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="channel-name"
              className="text-sm font-medium text-foreground"
            >
              Kanalname
            </label>
            <input
              id="channel-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Allgemein, Mandanten, ..."
              maxLength={100}
              required
              className="glass-input w-full px-3 py-2 rounded-lg text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="channel-desc"
              className="text-sm font-medium text-foreground"
            >
              Beschreibung (optional)
            </label>
            <textarea
              id="channel-desc"
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              placeholder="Wofuer wird dieser Kanal verwendet?"
              maxLength={500}
              rows={2}
              className="glass-input w-full px-3 py-2 rounded-lg text-sm resize-none"
            />
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!name.trim() || submitting}
              className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Erstellen"
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
