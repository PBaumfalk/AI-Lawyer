"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import {
  X,
  Send,
  Paperclip,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { ReplyMode } from "@/components/email/email-actions-bar";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EmailData {
  id: string;
  betreff: string;
  absender: string;
  absenderName: string | null;
  empfaenger: string[];
  cc: string[];
  inhalt: string | null;
  inhaltText: string | null;
  empfangenAm: string | null;
  gesendetAm: string | null;
  anhaenge?: Array<{
    id: string;
    dateiname: string;
    groesse: number;
    mimeType: string;
  }>;
}

interface EmailInlineReplyProps {
  mode: ReplyMode;
  originalEmail: EmailData;
  onClose: () => void;
  onSent: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EmailInlineReply({
  mode,
  originalEmail,
  onClose,
  onSent,
}: EmailInlineReplyProps) {
  const [isSending, setIsSending] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Pre-fill recipients based on mode
  const [recipients, setRecipients] = useState<string>(() => {
    switch (mode) {
      case "reply":
        return originalEmail.absender;
      case "replyAll": {
        const all = new Set<string>();
        all.add(originalEmail.absender);
        originalEmail.empfaenger.forEach((e) => all.add(e));
        return Array.from(all).join(", ");
      }
      case "forward":
        return "";
      default:
        return "";
    }
  });

  const [ccField, setCcField] = useState<string>(() => {
    if (mode === "replyAll" && originalEmail.cc.length > 0) {
      return originalEmail.cc.join(", ");
    }
    return "";
  });

  const [bccField, setBccField] = useState("");
  const [subject, setSubject] = useState(() => {
    const prefix = mode === "forward" ? "Fwd" : "Re";
    const cleanSubject = originalEmail.betreff
      .replace(/^(Re:|Fwd:|AW:|WG:|Wtr:)\s*/gi, "")
      .trim();
    return `${prefix}: ${cleanSubject}`;
  });

  // Forward: original attachment selection
  const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(
    () => new Set(originalEmail.anhaenge?.map((a) => a.id) ?? [])
  );

  // Quoted text header
  const quotedHeader = useMemo(() => {
    const date = new Date(
      originalEmail.empfangenAm ?? originalEmail.gesendetAm ?? ""
    );
    const dateStr = date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const sender =
      originalEmail.absenderName || originalEmail.absender;
    return `Am ${dateStr} schrieb ${sender}:`;
  }, [originalEmail]);

  // Reply-All safety check
  const recipientCount = useMemo(() => {
    const allRecipients = [
      ...recipients.split(",").map((r) => r.trim()).filter(Boolean),
      ...ccField.split(",").map((r) => r.trim()).filter(Boolean),
    ];
    return allRecipients.length;
  }, [recipients, ccField]);

  const handleSend = useCallback(async () => {
    if (!recipients.trim()) {
      toast.error("Bitte geben Sie mindestens einen Empfaenger an");
      return;
    }

    // Warn on Reply-All with 5+ recipients
    if (recipientCount >= 5) {
      const confirmed = window.confirm(
        `Sie antworten an ${recipientCount} Empfaenger. Fortfahren?`
      );
      if (!confirmed) return;
    }

    setIsSending(true);
    try {
      const bodyHtml = editorRef.current?.innerHTML ?? "";

      const res = await fetch("/api/email-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          an: recipients.split(",").map((r) => r.trim()).filter(Boolean),
          cc: ccField ? ccField.split(",").map((r) => r.trim()).filter(Boolean) : [],
          bcc: bccField ? bccField.split(",").map((r) => r.trim()).filter(Boolean) : [],
          betreff: subject,
          inhalt: bodyHtml,
          inReplyTo: mode !== "forward" ? originalEmail.id : undefined,
          weiterleitung: mode === "forward",
          anhaengeIds:
            mode === "forward"
              ? Array.from(selectedAttachments)
              : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Senden fehlgeschlagen");
      }

      // 10-second undo toast
      toast("E-Mail wird in 10s gesendet", {
        action: {
          label: "Rueckgaengig",
          onClick: async () => {
            try {
              const data = await res.json().catch(() => ({}));
              if (data.jobId) {
                await fetch(`/api/email-send?jobId=${data.jobId}`, {
                  method: "DELETE",
                });
                toast.success("Senden abgebrochen");
              }
            } catch {
              toast.error("Konnte nicht abgebrochen werden");
            }
          },
        },
        duration: 10000,
      });

      onSent();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Senden fehlgeschlagen"
      );
    } finally {
      setIsSending(false);
    }
  }, [
    recipients,
    ccField,
    bccField,
    subject,
    mode,
    originalEmail.id,
    selectedAttachments,
    recipientCount,
    onSent,
  ]);

  const handleDiscard = useCallback(() => {
    if (hasEdited) {
      const confirmed = window.confirm(
        "Entwurf verwerfen? Aenderungen gehen verloren."
      );
      if (!confirmed) return;
    }
    onClose();
  }, [hasEdited, onClose]);

  const toggleAttachment = useCallback((attachmentId: string) => {
    setSelectedAttachments((prev) => {
      const next = new Set(prev);
      if (next.has(attachmentId)) next.delete(attachmentId);
      else next.add(attachmentId);
      return next;
    });
  }, []);

  const modeLabel =
    mode === "reply"
      ? "Antwort"
      : mode === "replyAll"
        ? "Antwort an alle"
        : "Weiterleitung";

  const recipientLabel =
    mode === "forward"
      ? "Weiterleiten an"
      : `Antwort an ${originalEmail.absenderName || originalEmail.absender}`;

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/50">
        <span className="text-xs font-medium text-muted-foreground">
          {recipientLabel}
        </span>
        <button
          onClick={handleDiscard}
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Recipients */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 w-8">An:</label>
            <Input
              value={recipients}
              onChange={(e) => {
                setRecipients(e.target.value);
                setHasEdited(true);
              }}
              placeholder="Empfaenger..."
              className="h-7 text-xs flex-1"
            />
            {!showCcBcc && (
              <button
                onClick={() => setShowCcBcc(true)}
                className="text-xs text-brand-600 hover:text-brand-700 whitespace-nowrap"
              >
                CC/BCC
              </button>
            )}
          </div>

          {showCcBcc && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 w-8">CC:</label>
                <Input
                  value={ccField}
                  onChange={(e) => {
                    setCcField(e.target.value);
                    setHasEdited(true);
                  }}
                  placeholder="CC-Empfaenger..."
                  className="h-7 text-xs flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 w-8">BCC:</label>
                <Input
                  value={bccField}
                  onChange={(e) => {
                    setBccField(e.target.value);
                    setHasEdited(true);
                  }}
                  placeholder="BCC-Empfaenger..."
                  className="h-7 text-xs flex-1"
                />
              </div>
            </>
          )}
        </div>

        {/* Mini toolbar */}
        <div className="flex items-center gap-0.5 border-b border-slate-200 dark:border-slate-700 pb-2">
          <ToolbarButton
            icon={Bold}
            title="Fett"
            onClick={() => document.execCommand("bold")}
          />
          <ToolbarButton
            icon={Italic}
            title="Kursiv"
            onClick={() => document.execCommand("italic")}
          />
          <ToolbarButton
            icon={LinkIcon}
            title="Link"
            onClick={() => {
              const url = prompt("URL eingeben:");
              if (url) document.execCommand("createLink", false, url);
            }}
          />
          <ToolbarButton
            icon={List}
            title="Liste"
            onClick={() => document.execCommand("insertUnorderedList")}
          />
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
          <ToolbarButton icon={Paperclip} title="Datei anhaengen" onClick={() => {}} />
        </div>

        {/* Editable area */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => setHasEdited(true)}
          className="min-h-[100px] max-h-[300px] overflow-y-auto text-sm text-foreground focus:outline-none"
          style={{ whiteSpace: "pre-wrap" }}
          data-placeholder="Ihre Antwort..."
        />

        {/* Forward: attachment selection */}
        {mode === "forward" &&
          originalEmail.anhaenge &&
          originalEmail.anhaenge.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Anhaenge weiterleiten:
              </p>
              {originalEmail.anhaenge.map((att) => (
                <label
                  key={att.id}
                  className="flex items-center gap-2 text-xs cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedAttachments.has(att.id)}
                    onChange={() => toggleAttachment(att.id)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600"
                  />
                  <Paperclip className="w-3 h-3 text-slate-400" />
                  <span className="truncate">{att.dateiname}</span>
                  <span className="text-slate-400 ml-auto">
                    {formatFileSize(att.groesse)}
                  </span>
                </label>
              ))}
            </div>
          )}

        {/* Quoted original */}
        <div className="border-l-2 border-slate-300 dark:border-slate-600 pl-3 mt-3">
          <p className="text-xs text-muted-foreground mb-1">{quotedHeader}</p>
          <div
            className="text-xs text-muted-foreground/70 max-h-[200px] overflow-y-auto"
            dangerouslySetInnerHTML={{
              __html: originalEmail.inhalt ?? "",
            }}
          />
          {!originalEmail.inhalt && originalEmail.inhaltText && (
            <pre className="text-xs text-muted-foreground/70 whitespace-pre-wrap font-mono">
              {originalEmail.inhaltText}
            </pre>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleSend}
            disabled={isSending || !recipients.trim()}
          >
            <Send className="w-3.5 h-3.5" />
            {isSending ? "Wird gesendet..." : "Senden"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={handleDiscard}
          >
            Verwerfen
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Toolbar button ─────────────────────────────────────────────────────────

function ToolbarButton({
  icon: Icon,
  title,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
