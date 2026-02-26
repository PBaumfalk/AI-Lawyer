"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Reply,
  ReplyAll,
  Forward,
  FolderOpen,
  Ticket,
  Paperclip,
  Clock,
  User,
  Mail,
  Search,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";

interface EmailData {
  id: string;
  messageId: string | null;
  akteId: string | null;
  richtung: "EINGEHEND" | "AUSGEHEND";
  betreff: string;
  absender: string;
  absenderName: string | null;
  empfaenger: string[];
  cc: string[];
  inhalt: string | null;
  inhaltText: string | null;
  empfangenAm: string | null;
  gesendetAm: string | null;
  gelesen: boolean;
  veraktet: boolean;
  ticketId: string | null;
  anhangDokumentIds: string[];
  createdAt: string;
  akte: { id: string; aktenzeichen: string; kurzrubrum: string } | null;
  ticket: {
    id: string;
    titel: string;
    status: string;
    prioritaet: string;
  } | null;
}

interface AkteOption {
  id: string;
  aktenzeichen: string;
  kurzrubrum: string;
}

interface EmailDetailViewProps {
  email: EmailData;
  akten: AkteOption[];
}

export function EmailDetailView({ email, akten }: EmailDetailViewProps) {
  const router = useRouter();
  const [showVeraktenDialog, setShowVeraktenDialog] = useState(false);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [isVerakting, setIsVerakting] = useState(false);
  const [aiDraft, setAiDraft] = useState<{
    id: string;
    inhalt: string;
    titel: string;
  } | null>(null);
  const [showDraft, setShowDraft] = useState(false);
  const [draftAccepted, setDraftAccepted] = useState(false);

  const isIncoming = email.richtung === "EINGEHEND";
  const dateStr = email.empfangenAm ?? email.gesendetAm ?? email.createdAt;
  const date = new Date(dateStr);

  // Check for AI draft suggestions for this email
  useEffect(() => {
    if (!isIncoming) return;

    fetch(
      `/api/helena/suggestions?emailId=${email.id}&typ=ANTWORT_ENTWURF&status=NEU&limit=1`
    )
      .then((res) => (res.ok ? res.json() : { suggestions: [] }))
      .then((data) => {
        if (data.suggestions && data.suggestions.length > 0) {
          const s = data.suggestions[0];
          setAiDraft({ id: s.id, inhalt: s.inhalt, titel: s.titel });
        }
      })
      .catch(() => {});
  }, [email.id, isIncoming]);

  async function handleAcceptDraft() {
    if (!aiDraft) return;
    try {
      const res = await fetch(`/api/helena/suggestions/${aiDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "UEBERNOMMEN" }),
      });
      if (res.ok) {
        setDraftAccepted(true);
      }
    } catch {
      // Silent fail
    }
  }

  async function handleRejectDraft() {
    if (!aiDraft) return;
    try {
      await fetch(`/api/helena/suggestions/${aiDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ABGELEHNT" }),
      });
    } catch {
      // Silent fail
    }
    setAiDraft(null);
    setShowDraft(false);
  }

  return (
    <div className="space-y-6">
      {/* KI-Antwort banner */}
      {aiDraft && !draftAccepted && (
        <div className="bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 rounded-xl px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-brand-800 dark:text-brand-300">
                Helena hat einen Antwort-Entwurf erstellt
              </p>
              <p className="text-xs text-brand-600/70 dark:text-brand-400/70">
                KI-Antwort verfuegbar
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300"
              onClick={() => setShowDraft(!showDraft)}
            >
              {showDraft ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 mr-1" />
                  Verbergen
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 mr-1" />
                  Anzeigen
                </>
              )}
            </Button>
          </div>

          {/* Expanded draft content */}
          {showDraft && (
            <div className="mt-3 pt-3 border-t border-brand-200 dark:border-brand-800">
              <div className="bg-white dark:bg-slate-900 rounded-lg px-4 py-3 text-sm text-foreground/80 whitespace-pre-wrap max-h-60 overflow-y-auto">
                {aiDraft.inhalt}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleAcceptDraft}
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Uebernehmen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/30"
                  onClick={handleRejectDraft}
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Ablehnen
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Draft accepted confirmation */}
      {draftAccepted && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl px-5 py-3">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-600" />
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              Antwort-Entwurf wurde als KI-Entwurf gespeichert.
            </p>
          </div>
        </div>
      )}

      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/email")}
          className="p-2 rounded-lg hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate">
            {email.betreff || "(Kein Betreff)"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {isIncoming ? (
              <Badge variant="outline" className="text-xs gap-1">
                <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
                Eingehend
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1">
                <ArrowUpRight className="w-3 h-3 text-blue-500" />
                Ausgehend
              </Badge>
            )}
            {email.veraktet && email.akte && (
              <Link href={`/akten/${email.akte.id}`}>
                <Badge variant="success" className="text-xs gap-1 cursor-pointer hover:opacity-80">
                  <FolderOpen className="w-3 h-3" />
                  {email.akte.aktenzeichen}
                </Badge>
              </Link>
            )}
            {email.ticket && (
              <Badge variant="warning" className="text-xs gap-1">
                <Ticket className="w-3 h-3" />
                {email.ticket.titel}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link href={`/email/compose?reply=${email.id}`}>
          <Button variant="outline" size="sm">
            <Reply className="w-4 h-4 mr-1.5" />
            Antworten
          </Button>
        </Link>
        {email.cc.length > 0 && (
          <Link href={`/email/compose?replyAll=${email.id}`}>
            <Button variant="outline" size="sm">
              <ReplyAll className="w-4 h-4 mr-1.5" />
              Allen antworten
            </Button>
          </Link>
        )}
        <Link href={`/email/compose?forward=${email.id}`}>
          <Button variant="outline" size="sm">
            <Forward className="w-4 h-4 mr-1.5" />
            Weiterleiten
          </Button>
        </Link>

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        {!email.veraktet && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVeraktenDialog(true)}
          >
            <FolderOpen className="w-4 h-4 mr-1.5" />
            E-Mail verakten
          </Button>
        )}
        {!email.ticketId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTicketDialog(true)}
          >
            <Ticket className="w-4 h-4 mr-1.5" />
            Ticket erstellen
          </Button>
        )}
      </div>

      {/* Email content card */}
      <GlassPanel elevation="panel" className="overflow-hidden">
        {/* Email header info */}
        <div className="px-6 py-4 border-b border-[var(--glass-border-color)] space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {email.absenderName || email.absender}
                </p>
                {email.absenderName && (
                  <p className="text-xs text-slate-500">{email.absender}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              {date.toLocaleDateString("de-DE", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              {", "}
              {date.toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>

          <div className="text-xs text-slate-500 space-y-1 pl-[52px]">
            <p>
              <span className="text-slate-400 mr-2">An:</span>
              {email.empfaenger.join(", ")}
            </p>
            {email.cc.length > 0 && (
              <p>
                <span className="text-slate-400 mr-2">CC:</span>
                {email.cc.join(", ")}
              </p>
            )}
          </div>
        </div>

        {/* Email body */}
        <div className="px-6 py-6">
          {email.inhalt ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: email.inhalt }}
            />
          ) : email.inhaltText ? (
            <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans">
              {email.inhaltText}
            </pre>
          ) : (
            <p className="text-sm text-slate-400 italic">
              Kein Inhalt verfügbar.
            </p>
          )}
        </div>

        {/* Attachments */}
        {email.anhangDokumentIds.length > 0 && (
          <div className="px-6 py-4 border-t border-[var(--glass-border-color)]">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              Anhänge ({email.anhangDokumentIds.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {email.anhangDokumentIds.map((docId) => (
                <div
                  key={docId}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-input text-sm"
                >
                  <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-foreground/80">
                    Dokument {docId.slice(0, 8)}…
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassPanel>

      {/* Verakten Dialog */}
      {showVeraktenDialog && (
        <VeraktenDialog
          emailId={email.id}
          akten={akten}
          onClose={() => setShowVeraktenDialog(false)}
          onSuccess={() => {
            setShowVeraktenDialog(false);
            router.refresh();
          }}
        />
      )}

      {/* Ticket Dialog */}
      {showTicketDialog && (
        <TicketDialog
          email={email}
          onClose={() => setShowTicketDialog(false)}
          onSuccess={() => {
            setShowTicketDialog(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── Verakten Dialog ────────────────────────────────────────────────────────

function VeraktenDialog({
  emailId,
  akten,
  onClose,
  onSuccess,
}: {
  emailId: string;
  akten: AkteOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedAkteId, setSelectedAkteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = akten.filter(
    (a) =>
      a.aktenzeichen.toLowerCase().includes(search.toLowerCase()) ||
      a.kurzrubrum.toLowerCase().includes(search.toLowerCase())
  );

  const selectedAkte = akten.find((a) => a.id === selectedAkteId);

  async function handleVerakten() {
    if (!selectedAkteId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/emails/${emailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ akteId: selectedAkteId, veraktet: true }),
      });
      if (res.ok) {
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <GlassPanel elevation="elevated" className="w-full max-w-lg shadow-xl">
        <div className="px-6 py-4 border-b border-[var(--glass-border-color)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            E-Mail verakten
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/20 dark:hover:bg-white/[0.06]"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Wählen Sie die Akte, der diese E-Mail zugeordnet werden soll.
          </p>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Aktenzeichen oder Rubrum suchen..."
              className="pl-10"
            />
          </div>

          {/* Akten list */}
          <div className="max-h-60 overflow-y-auto border border-white/20 dark:border-white/[0.08] rounded-lg divide-y divide-white/10 dark:divide-white/[0.04]">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-400 text-center">
                Keine Akten gefunden.
              </p>
            ) : (
              filtered.map((akte) => (
                <button
                  key={akte.id}
                  onClick={() => setSelectedAkteId(akte.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-white/20 dark:hover:bg-white/[0.05] transition-colors ${
                    selectedAkteId === akte.id
                      ? "bg-brand-50 dark:bg-brand-950/30 border-l-2 border-brand-600"
                      : ""
                  }`}
                >
                  <p className="text-sm font-mono text-brand-600">
                    {akte.aktenzeichen}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {akte.kurzrubrum}
                  </p>
                </button>
              ))
            )}
          </div>

          {selectedAkte && (
            <p className="text-sm text-muted-foreground">
              Ausgewählt:{" "}
              <span className="font-medium text-foreground">
                {selectedAkte.aktenzeichen} – {selectedAkte.kurzrubrum}
              </span>
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--glass-border-color)] flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            onClick={handleVerakten}
            disabled={!selectedAkteId || loading}
          >
            {loading ? "Wird zugeordnet…" : "Verakten"}
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}

// ─── Ticket Dialog ──────────────────────────────────────────────────────────

function TicketDialog({
  email,
  onClose,
  onSuccess,
}: {
  email: EmailData;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [titel, setTitel] = useState(email.betreff);
  const [beschreibung, setBeschreibung] = useState(
    email.inhaltText?.substring(0, 500) ?? ""
  );
  const [prioritaet, setPrioritaet] = useState("NORMAL");
  const [faelligAm, setFaelligAm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailId: email.id,
          akteId: email.akteId,
          titel,
          beschreibung,
          prioritaet,
          faelligAm: faelligAm || null,
          tags: ["email"],
        }),
      });
      if (res.ok) {
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <GlassPanel elevation="elevated" className="w-full max-w-lg shadow-xl">
        <div className="px-6 py-4 border-b border-[var(--glass-border-color)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Ticket aus E-Mail erstellen
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/20 dark:hover:bg-white/[0.06]"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1 block">
              Titel
            </label>
            <Input
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Ticket-Titel"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1 block">
              Beschreibung
            </label>
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              rows={4}
              className="glass-input w-full rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none"
              placeholder="Beschreibung..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1 block">
                Priorität
              </label>
              <Select
                value={prioritaet}
                onChange={(e) => setPrioritaet(e.target.value)}
              >
                <option value="NIEDRIG">Niedrig</option>
                <option value="NORMAL">Normal</option>
                <option value="HOCH">Hoch</option>
                <option value="KRITISCH">Kritisch</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1 block">
                Fällig am
              </label>
              <Input
                type="date"
                value={faelligAm}
                onChange={(e) => setFaelligAm(e.target.value)}
              />
            </div>
          </div>

          {email.akte && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg glass-input">
              <FolderOpen className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-foreground/80">
                Akte: {email.akte.aktenzeichen} – {email.akte.kurzrubrum}
              </span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--glass-border-color)] flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={!titel || loading}>
            {loading ? "Wird erstellt…" : "Ticket erstellen"}
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}
