"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ArrowLeft,
  Send,
  FolderOpen,
  X,
  Paperclip,
  FileText,
  Search,
  Loader2,
  CheckCircle2,
  Lock,
} from "lucide-react";

interface RefEmail {
  id: string;
  betreff: string;
  absender: string;
  absenderName: string | null;
  empfaenger: string[];
  cc: string[];
  inhalt: string | null;
  inhaltText: string | null;
  akteId: string | null;
  richtung: string;
}

interface AkteOption {
  id: string;
  aktenzeichen: string;
  kurzrubrum: string;
}

interface EmailComposeViewProps {
  mode: "new" | "reply" | "replyAll" | "forward";
  refEmail: RefEmail | null;
  akten: AkteOption[];
  defaultAkteId: string | null;
}

export function EmailComposeView({
  mode,
  refEmail,
  akten,
  defaultAkteId,
}: EmailComposeViewProps) {
  const router = useRouter();

  // Pre-fill based on mode
  const getInitialTo = () => {
    if (mode === "reply" && refEmail) {
      return refEmail.richtung === "EINGEHEND"
        ? refEmail.absender
        : refEmail.empfaenger[0] ?? "";
    }
    if (mode === "replyAll" && refEmail) {
      const addresses = [refEmail.absender, ...refEmail.empfaenger];
      return Array.from(new Set(addresses)).join(", ");
    }
    return "";
  };

  const getInitialCc = () => {
    if (mode === "replyAll" && refEmail) {
      return refEmail.cc.join(", ");
    }
    return "";
  };

  const getInitialSubject = () => {
    if (!refEmail) return "";
    if (mode === "reply" || mode === "replyAll") {
      return refEmail.betreff.startsWith("Re:")
        ? refEmail.betreff
        : `Re: ${refEmail.betreff}`;
    }
    if (mode === "forward") {
      return refEmail.betreff.startsWith("Fwd:")
        ? refEmail.betreff
        : `Fwd: ${refEmail.betreff}`;
    }
    return "";
  };

  const getInitialBody = () => {
    if (!refEmail) return "";
    const date = new Date().toLocaleDateString("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const sender = refEmail.absenderName || refEmail.absender;
    const quote = refEmail.inhaltText ?? "";

    if (mode === "reply" || mode === "replyAll") {
      return `\n\n--- Am ${date} schrieb ${sender}: ---\n${quote}`;
    }
    if (mode === "forward") {
      return `\n\n--- Weitergeleitete Nachricht ---\nVon: ${sender} <${refEmail.absender}>\nBetreff: ${refEmail.betreff}\n\n${quote}`;
    }
    return "";
  };

  const [an, setAn] = useState(getInitialTo());
  const [cc, setCc] = useState(getInitialCc());
  const [betreff, setBetreff] = useState(getInitialSubject());
  const [inhalt, setInhalt] = useState(getInitialBody());
  const [selectedAkteId, setSelectedAkteId] = useState<string>(
    defaultAkteId ?? ""
  );
  const [sending, setSending] = useState(false);
  const [showCc, setShowCc] = useState(cc.length > 0);
  const [attachments, setAttachments] = useState<{ id: string; name: string; mimeType: string }[]>([]);
  const [showDocPicker, setShowDocPicker] = useState(false);

  const modeLabels: Record<string, string> = {
    new: "Neue E-Mail",
    reply: "Antworten",
    replyAll: "Allen antworten",
    forward: "Weiterleiten",
  };

  async function handleSend() {
    if (!an.trim() || !betreff.trim()) return;
    setSending(true);

    try {
      const empfaenger = an
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      const ccList = cc
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const res = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          richtung: "AUSGEHEND",
          betreff,
          absender: "info@kanzlei-baumfalk.de", // TODO: from user/kanzlei settings
          absenderName: "Kanzlei Baumfalk",
          empfaenger: empfaenger,
          cc: ccList,
          inhaltText: inhalt,
          inhalt: `<pre style="white-space: pre-wrap; font-family: sans-serif;">${escapeHtml(inhalt)}</pre>`,
          gesendetAm: new Date().toISOString(),
          gelesen: true,
          akteId: selectedAkteId || null,
          anhaenge: attachments.map((a) => `dms-${a.id}`),
        }),
      });

      if (res.ok) {
        router.push("/email");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <h1 className="text-xl font-heading text-foreground">
          {modeLabels[mode]}
        </h1>
      </div>

      {/* Compose form */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] overflow-hidden">
        {/* To */}
        <div className="flex items-center border-b border-white/10 dark:border-white/[0.06]">
          <label className="px-6 py-3 text-sm text-slate-500 w-16 flex-shrink-0">
            An:
          </label>
          <Input
            value={an}
            onChange={(e) => setAn(e.target.value)}
            placeholder="empfaenger@beispiel.de"
            className="border-0 focus:ring-0 rounded-none"
          />
          {!showCc && (
            <button
              onClick={() => setShowCc(true)}
              className="px-3 text-xs text-brand-600 hover:underline flex-shrink-0"
            >
              CC
            </button>
          )}
        </div>

        {/* CC */}
        {showCc && (
          <div className="flex items-center border-b border-white/10 dark:border-white/[0.06]">
            <label className="px-6 py-3 text-sm text-slate-500 w-16 flex-shrink-0">
              CC:
            </label>
            <Input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@beispiel.de"
              className="border-0 focus:ring-0 rounded-none"
            />
            <button
              onClick={() => {
                setShowCc(false);
                setCc("");
              }}
              className="px-3 flex-shrink-0"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        )}

        {/* Subject */}
        <div className="flex items-center border-b border-white/10 dark:border-white/[0.06]">
          <label className="px-6 py-3 text-sm text-slate-500 w-16 flex-shrink-0">
            Betr.:
          </label>
          <Input
            value={betreff}
            onChange={(e) => setBetreff(e.target.value)}
            placeholder="Betreff eingeben..."
            className="border-0 focus:ring-0 rounded-none font-medium"
          />
        </div>

        {/* Akte linking */}
        <div className="flex items-center border-b border-white/10 dark:border-white/[0.06]">
          <label className="px-6 py-3 text-sm text-slate-500 w-16 flex-shrink-0">
            <FolderOpen className="w-4 h-4" />
          </label>
          <Select
            value={selectedAkteId}
            onChange={(e) => setSelectedAkteId(e.target.value)}
            className="border-0 focus:ring-0 rounded-none text-sm"
          >
            <option value="">Keine Akte zuordnen</option>
            {akten.map((akte) => (
              <option key={akte.id} value={akte.id}>
                {akte.aktenzeichen} – {akte.kurzrubrum}
              </option>
            ))}
          </Select>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <textarea
            value={inhalt}
            onChange={(e) => setInhalt(e.target.value)}
            rows={16}
            className="w-full border-0 bg-transparent text-sm text-foreground placeholder:text-slate-400 focus:outline-none resize-none"
            placeholder="Ihre Nachricht..."
            autoFocus
          />
        </div>

        {/* Attachments */}
        <div className="px-6 py-3 border-t border-white/10 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 flex items-center gap-1.5">
              <Paperclip className="w-4 h-4" />
              Anhaenge ({attachments.length})
            </span>
            <button
              onClick={() => setShowDocPicker(true)}
              className="text-xs text-brand-600 hover:underline"
            >
              Dokument anhaengen
            </button>
          </div>
          {attachments.length > 0 && (
            <div className="space-y-1.5">
              {attachments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm"
                >
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground flex-1 truncate">{doc.name}</span>
                  <button
                    onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== doc.id))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            E-Mail wird als Entwurf gespeichert und über SMTP versendet.
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              Verwerfen
            </Button>
            <Button
              onClick={handleSend}
              disabled={!an.trim() || !betreff.trim() || sending}
            >
              <Send className="w-4 h-4 mr-1.5" />
              {sending ? "Wird gesendet…" : "Senden"}
            </Button>
          </div>
        </div>
      </div>
      {/* Document Picker Dialog */}
      {showDocPicker && (
        <EmailDocumentPicker
          akteId={selectedAkteId || null}
          existingIds={attachments.map((a) => a.id)}
          onSelect={(doc) => {
            setAttachments((prev) => [...prev, doc]);
            setShowDocPicker(false);
          }}
          onClose={() => setShowDocPicker(false)}
        />
      )}
    </div>
  );
}

// Document picker with ENTWURF greyed out and Quick-Release button
function EmailDocumentPicker({
  akteId,
  existingIds,
  onSelect,
  onClose,
}: {
  akteId: string | null;
  existingIds: string[];
  onSelect: (doc: { id: string; name: string; mimeType: string }) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [docs, setDocs] = useState<
    { id: string; name: string; mimeType: string; status: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        // Fetch ALL documents (not just FREIGEGEBEN) to show ENTWURF greyed out
        const params = new URLSearchParams({ take: "30" });
        if (akteId) params.set("akteId", akteId);
        if (search) params.set("q", search);

        const res = await fetch(`/api/dokumente?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setDocs(
            (data.dokumente || []).map((d: any) => ({
              id: d.id,
              name: d.name,
              mimeType: d.mimeType,
              status: d.status,
            }))
          );
        }
      } catch {
        // Ignore
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, akteId]);

  async function handleQuickRelease(docId: string) {
    setReleasing(docId);
    try {
      const res = await fetch(`/api/dokumente/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "FREIGEGEBEN" }),
      });
      if (res.ok) {
        // Refresh document list to update status
        setDocs((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, status: "FREIGEGEBEN" } : d))
        );
      }
    } catch {
      // Ignore
    }
    setReleasing(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-lg space-y-4 shadow-xl border border-border">
        <h3 className="text-lg font-heading text-foreground">
          Dokument anhaengen
        </h3>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Dokument suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Keine Dokumente gefunden.
            </p>
          ) : (
            docs.map((doc) => {
              const isFreigegeben = doc.status === "FREIGEGEBEN" || doc.status === "VERSENDET";
              const isAlreadyAdded = existingIds.includes(doc.id);
              const isEntwurf = doc.status === "ENTWURF" || doc.status === "ZUR_PRUEFUNG";

              return (
                <div
                  key={doc.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                    isEntwurf
                      ? "opacity-50 cursor-not-allowed"
                      : isAlreadyAdded
                      ? "opacity-40"
                      : "hover:bg-muted cursor-pointer"
                  } transition-colors`}
                  onClick={() => {
                    if (isFreigegeben && !isAlreadyAdded) {
                      onSelect({ id: doc.id, name: doc.name, mimeType: doc.mimeType });
                    }
                  }}
                >
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">{doc.name}</span>
                  {isEntwurf && (
                    <>
                      <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 flex-shrink-0">
                        <Lock className="w-3 h-3" />
                        Noch nicht freigegeben
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickRelease(doc.id);
                        }}
                        disabled={releasing === doc.id}
                        className="text-xs text-brand-600 hover:underline flex items-center gap-1 flex-shrink-0 disabled:opacity-50"
                      >
                        {releasing === doc.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        Freigeben
                      </button>
                    </>
                  )}
                  {isAlreadyAdded && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      Bereits angehaengt
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Schliessen
          </button>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
