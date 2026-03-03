"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Send, Loader2, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

interface PortalInviteDialogProps {
  beteiligter: {
    id: string;
    kontakt: {
      vorname: string | null;
      nachname: string | null;
      firma: string | null;
      email: string | null;
    };
  };
  akteId: string;
  onSuccess?: () => void;
}

export function PortalInviteDialog({
  beteiligter,
  akteId,
  onSuccess,
}: PortalInviteDialogProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const mandantName =
    [beteiligter.kontakt.vorname, beteiligter.kontakt.nachname]
      .filter(Boolean)
      .join(" ") ||
    beteiligter.kontakt.firma ||
    "Mandant";

  const email = beteiligter.kontakt.email;
  const hasEmail = !!email;

  const handleSend = useCallback(async () => {
    if (!hasEmail || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/portal/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beteiligteId: beteiligter.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Versenden der Einladung");
      }

      toast.success(`Einladung an ${email} gesendet`);
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Fehler beim Versenden der Einladung"
      );
    } finally {
      setSending(false);
    }
  }, [beteiligter.id, email, hasEmail, sending, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
          <Send className="w-3.5 h-3.5" />
          Portal-Einladung
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Portal-Einladung senden</DialogTitle>
          <DialogDescription>
            Laden Sie den Mandanten zum Mandantenportal ein. Eine E-Mail mit
            einem Aktivierungslink wird versendet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Mandant name */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Send className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{mandantName}</p>
              <p className="text-xs text-muted-foreground">Mandant</p>
            </div>
          </div>

          {/* Email address */}
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            {hasEmail ? (
              <span className="text-sm">{email}</span>
            ) : (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  Keine E-Mail-Adresse hinterlegt. Bitte zuerst eine E-Mail beim
                  Kontakt erfassen.
                </span>
              </div>
            )}
          </div>

          {/* Info text */}
          {hasEmail && (
            <p className="text-xs text-muted-foreground">
              Der Mandant erhaelt eine E-Mail mit einem Aktivierungslink, der 7
              Tage gueltig ist. Nach Aktivierung kann der Mandant freigegebene
              Dokumente und Akteninformationen im Portal einsehen.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={sending}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSend}
            disabled={!hasEmail || sending}
            className="gap-2"
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            Einladung senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
