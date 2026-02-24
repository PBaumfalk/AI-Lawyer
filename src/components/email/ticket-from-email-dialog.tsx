"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Ticket,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TicketFromEmailDialogProps {
  open: boolean;
  onClose: () => void;
  emailId: string;
}

interface EmailPreview {
  betreff: string;
  inhaltText: string | null;
  empfangenAm: string | null;
  gesendetAm: string | null;
  absender: string;
  absenderName: string | null;
  veraktung: { akteId: string; aktenzeichen: string } | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TicketFromEmailDialog({
  open,
  onClose,
  emailId,
}: TicketFromEmailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [titel, setTitel] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [akteId, setAkteId] = useState<string | null>(null);
  const [aktenzeichen, setAktenzeichen] = useState<string | null>(null);
  const [prioritaet, setPrioritaet] = useState("NORMAL");
  const [faelligAm, setFaelligAm] = useState("");
  const [verantwortlichId, setVerantwortlichId] = useState("");

  // Users for dropdown
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);

  // Load email data for pre-fill
  useEffect(() => {
    if (!open || !emailId) return;
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/emails/${emailId}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setTitel(data.betreff || "(Kein Betreff)");

          const dateStr = data.empfangenAm ?? data.gesendetAm;
          const dateLabel = dateStr
            ? new Date(dateStr).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : "unbekannt";

          setBeschreibung(
            `Aus E-Mail vom ${dateLabel}\n\n${
              data.inhaltText?.slice(0, 500) ?? ""
            }`
          );

          // Get linked Akte from veraktungen
          const activeVeraktung = (data.veraktungen ?? []).find(
            (v: any) => !v.aufgehoben
          );
          if (activeVeraktung?.akte) {
            setAkteId(activeVeraktung.akte.id);
            setAktenzeichen(activeVeraktung.akte.aktenzeichen);
          } else {
            setAkteId(null);
            setAktenzeichen(null);
          }
        }

        // Load users
        const usersRes = await fetch("/api/users?take=50");
        if (usersRes.ok && !cancelled) {
          const usersData = await usersRes.json();
          setUsers(
            (usersData.users ?? usersData ?? []).map((u: any) => ({
              id: u.id,
              name: u.name,
            }))
          );
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [open, emailId]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/emails/${emailId}/ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titel,
          beschreibung,
          akteId,
          prioritaet,
          faelligAm: faelligAm || undefined,
          verantwortlichId: verantwortlichId || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler beim Erstellen");
      }

      const ticket = await res.json();

      toast.success("Ticket erstellt", {
        action: {
          label: "Anzeigen",
          onClick: () => {
            window.location.href = `/tickets/${ticket.id}`;
          },
        },
      });

      onClose();
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Erstellen des Tickets");
    } finally {
      setSubmitting(false);
    }
  }, [emailId, titel, beschreibung, akteId, prioritaet, faelligAm, verantwortlichId, onClose]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5" />
            Ticket erstellen
          </SheetTitle>
          <SheetDescription>
            Ticket aus E-Mail erstellen
          </SheetDescription>
        </SheetHeader>

        <div className="p-6 space-y-5 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {/* Titel */}
              <div className="space-y-1.5">
                <Label htmlFor="ticket-titel">Titel</Label>
                <Input
                  id="ticket-titel"
                  value={titel}
                  onChange={(e) => setTitel(e.target.value)}
                  placeholder="Ticket-Titel..."
                />
              </div>

              {/* Beschreibung */}
              <div className="space-y-1.5">
                <Label htmlFor="ticket-beschreibung">Beschreibung</Label>
                <Textarea
                  id="ticket-beschreibung"
                  value={beschreibung}
                  onChange={(e) => setBeschreibung(e.target.value)}
                  rows={6}
                  className="resize-y"
                />
              </div>

              {/* Akte (read-only if pre-filled) */}
              {aktenzeichen && (
                <div className="space-y-1.5">
                  <Label>Akte</Label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-sm font-mono font-medium">
                      {aktenzeichen}
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </div>
                </div>
              )}

              {/* Prioritaet */}
              <div className="space-y-1.5">
                <Label htmlFor="ticket-prioritaet">Prioritaet</Label>
                <select
                  id="ticket-prioritaet"
                  value={prioritaet}
                  onChange={(e) => setPrioritaet(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="NIEDRIG">Niedrig</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HOCH">Hoch</option>
                  <option value="KRITISCH">Kritisch</option>
                </select>
              </div>

              {/* Faellig am */}
              <div className="space-y-1.5">
                <Label htmlFor="ticket-faellig">Faellig am</Label>
                <Input
                  id="ticket-faellig"
                  type="date"
                  value={faelligAm}
                  onChange={(e) => setFaelligAm(e.target.value)}
                />
              </div>

              {/* Verantwortlicher */}
              <div className="space-y-1.5">
                <Label htmlFor="ticket-verantwortlich">Verantwortlicher</Label>
                <select
                  id="ticket-verantwortlich"
                  value={verantwortlichId}
                  onChange={(e) => setVerantwortlichId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="">-- Nicht zugewiesen --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={!titel.trim() || submitting}
                  className="w-full"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Ticket className="w-4 h-4 mr-2" />
                  )}
                  Ticket erstellen
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
