"use client";

import { useState, useEffect, useCallback } from "react";
import {
  User,
  Clock,
  Paperclip,
  ChevronDown,
  ChevronUp,
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Download,
  Loader2,
  FolderInput,
  X,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmailEmptyState } from "@/components/email/email-empty-state";
import { EmailHtmlBody } from "@/components/email/email-html-body";
import { EmailActionsBar, type ReplyMode } from "@/components/email/email-actions-bar";
import { EmailInlineReply } from "@/components/email/email-inline-reply";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EmailDetailData {
  id: string;
  betreff: string;
  absender: string;
  absenderName: string | null;
  empfaenger: string[];
  cc: string[];
  bcc: string[];
  inhalt: string | null;
  inhaltText: string | null;
  empfangenAm: string | null;
  gesendetAm: string | null;
  gelesen: boolean;
  veraktet: boolean;
  prioritaet: string;
  emailKontoId?: string;
  istKanzlei?: boolean;
  verantwortlichId?: string | null;
  verantwortlichName?: string | null;
  anhaenge: Array<{
    id: string;
    dateiname: string;
    mimeType: string;
    groesse: number;
    downloadUrl?: string;
  }>;
  veraktungen?: Array<{
    id: string;
    aufgehoben: boolean;
    notiz?: string | null;
    createdAt: string;
    akte: { id: string; aktenzeichen: string; kurzrubrum: string } | null;
    user: { id: string; name: string } | null;
  }>;
}

interface EmailDetailProps {
  emailId: string | null;
  onSelectEmail: (emailId: string | null) => void;
  onOpenVeraktung?: (emailId: string) => void;
  onOpenTicket?: (emailId: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EmailDetail({
  emailId,
  onSelectEmail,
  onOpenVeraktung,
  onOpenTicket,
}: EmailDetailProps) {
  const [email, setEmail] = useState<EmailDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [replyMode, setReplyMode] = useState<ReplyMode | null>(null);

  // Verantwortlicher assignment
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);

  // Fetch full email when selectedEmailId changes
  useEffect(() => {
    if (!emailId) {
      setEmail(null);
      setReplyMode(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setReplyMode(null);

    (async () => {
      try {
        const res = await fetch(`/api/emails/${emailId}`);
        if (!res.ok) throw new Error("Fehler beim Laden");
        const data = await res.json();
        if (!cancelled) {
          const emailData: EmailDetailData = {
            id: data.id,
            betreff: data.betreff,
            absender: data.absender,
            absenderName: data.absenderName,
            empfaenger: data.empfaenger,
            cc: data.cc ?? [],
            bcc: data.bcc ?? [],
            inhalt: data.inhalt,
            inhaltText: data.inhaltText,
            empfangenAm: data.empfangenAm,
            gesendetAm: data.gesendetAm,
            gelesen: data.gelesen,
            veraktet: data.veraktet,
            prioritaet: data.prioritaet ?? "NORMAL",
            emailKontoId: data.emailKontoId,
            istKanzlei: data.emailKonto?.istKanzlei ?? false,
            verantwortlichId: data.verantwortlichId,
            verantwortlichName: data.verantwortlich?.name ?? null,
            anhaenge: (data.anhaenge ?? []).map((a: any) => ({
              id: a.id,
              dateiname: a.dateiname,
              mimeType: a.mimeType,
              groesse: a.groesse,
              downloadUrl: a.downloadUrl,
            })),
            veraktungen: data.veraktungen,
          };
          setEmail(emailData);

          // Auto-mark as read
          if (!data.gelesen) {
            fetch(`/api/emails/${emailId}/read`, { method: "PATCH" }).catch(
              () => {}
            );
          }
        }
      } catch (err) {
        console.error("Email detail fetch error:", err);
        if (!cancelled) setEmail(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [emailId]);

  const handleReplyAction = useCallback((mode: ReplyMode) => {
    setReplyMode(mode);
  }, []);

  const handleCloseReply = useCallback(() => {
    setReplyMode(null);
  }, []);

  const handleSent = useCallback(() => {
    setReplyMode(null);
  }, []);

  const handleEmailDeleted = useCallback(() => {
    onSelectEmail(null);
  }, [onSelectEmail]);

  const handleVerakten = useCallback(() => {
    if (emailId && onOpenVeraktung) {
      onOpenVeraktung(emailId);
    }
  }, [emailId, onOpenVeraktung]);

  const handleTicket = useCallback(() => {
    if (emailId && onOpenTicket) {
      onOpenTicket(emailId);
    }
  }, [emailId, onOpenTicket]);

  // Remove veraktung
  const handleRemoveVeraktung = useCallback(
    async (veraktungId: string) => {
      if (!emailId) return;
      try {
        const res = await fetch(`/api/emails/${emailId}/veraktung`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ veraktungId }),
        });
        if (res.ok) {
          toast.success("Veraktung aufgehoben");
          // Refresh email data
          const refreshRes = await fetch(`/api/emails/${emailId}`);
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            setEmail((prev) =>
              prev
                ? {
                    ...prev,
                    veraktet: data.veraktet,
                    veraktungen: data.veraktungen,
                  }
                : null
            );
          }
        }
      } catch {
        toast.error("Fehler beim Aufheben der Veraktung");
      }
    },
    [emailId]
  );

  // Verantwortlicher assignment
  const handleAssignVerantwortlicher = useCallback(
    async (userId: string, userName: string) => {
      if (!emailId) return;
      try {
        const res = await fetch(
          `/api/emails/${emailId}/verantwortlicher`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          }
        );
        if (res.ok) {
          toast.success(`Verantwortlich: ${userName}`);
          setEmail((prev) =>
            prev
              ? {
                  ...prev,
                  verantwortlichId: userId,
                  verantwortlichName: userName,
                }
              : null
          );
          setShowUserDropdown(false);
        } else {
          const err = await res.json();
          toast.error(err.error || "Fehler bei Zuweisung");
        }
      } catch {
        toast.error("Fehler bei Zuweisung");
      }
    },
    [emailId]
  );

  // Load users for Verantwortlicher dropdown
  useEffect(() => {
    if (!showUserDropdown) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users?take=50");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setUsers(
            (data.users ?? data ?? []).map((u: any) => ({
              id: u.id,
              name: u.name,
            }))
          );
        }
      } catch {
        // Silently fail
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showUserDropdown]);

  // No email selected
  if (!emailId) {
    return <EmailEmptyState type="no-selection" />;
  }

  // Loading
  if (loading) {
    return (
      <div className="flex flex-col h-full glass-panel rounded-r-2xl">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  // Error / not found
  if (!email) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">
          E-Mail konnte nicht geladen werden.
        </p>
      </div>
    );
  }

  const dateStr = email.empfangenAm ?? email.gesendetAm;
  const date = dateStr ? new Date(dateStr) : null;
  const senderInitial = (email.absenderName || email.absender)
    .charAt(0)
    .toUpperCase();

  const totalRecipients = email.empfaenger.length + email.cc.length;
  const hasMultipleRecipients = totalRecipients > 2;

  const activeVeraktungen = (email.veraktungen ?? []).filter(
    (v) => !v.aufgehoben
  );

  return (
    <div className="flex flex-col h-full glass-panel rounded-r-2xl">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Subject */}
          <h2 className="text-lg font-semibold text-foreground leading-tight">
            {email.betreff || "(Kein Betreff)"}
          </h2>

          {/* Actions bar */}
          <EmailActionsBar
            emailId={email.id}
            isVeraktet={email.veraktet}
            onReplyAction={handleReplyAction}
            onEmailDeleted={handleEmailDeleted}
            onVerakten={handleVerakten}
            onTicket={handleTicket}
          />

          {/* Veraktung info section */}
          {activeVeraktungen.length > 0 && (
            <div className="space-y-2">
              {activeVeraktungen.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-brand-50/50 dark:bg-brand-950/20 border border-brand-200/50 dark:border-brand-800/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderInput className="w-4 h-4 text-brand-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-mono font-medium text-brand-700 dark:text-brand-300">
                        {v.akte?.aktenzeichen}
                      </p>
                      <p className="text-xs text-brand-600/70 dark:text-brand-400/70 truncate">
                        {v.akte?.kurzrubrum}
                        {v.notiz && ` -- ${v.notiz}`}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Veraktet von {v.user?.name} am{" "}
                        {new Date(v.createdAt).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-slate-500 hover:text-rose-600 flex-shrink-0"
                    onClick={() => handleRemoveVeraktung(v.id)}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Aufheben
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Email header */}
          <div className="flex items-start gap-3 pt-2">
            {/* Sender avatar */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-sm font-semibold text-brand-700 dark:text-brand-300">
              {senderInitial}
            </div>

            <div className="flex-1 min-w-0">
              {/* Sender name + email */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {email.absenderName || email.absender}
                  </p>
                  {email.absenderName && (
                    <p className="text-xs text-slate-500">{email.absender}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Verantwortlicher indicator (Kanzlei mailbox only) */}
                  {email.istKanzlei && (
                    <div className="relative">
                      <button
                        onClick={() =>
                          setShowUserDropdown(!showUserDropdown)
                        }
                        className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title={
                          email.verantwortlichName
                            ? `Verantwortlich: ${email.verantwortlichName}`
                            : "Verantwortlichen zuweisen"
                        }
                      >
                        <UserCircle
                          className={cn(
                            "w-4 h-4",
                            email.verantwortlichId
                              ? "text-brand-600"
                              : "text-slate-400"
                          )}
                        />
                        {email.verantwortlichName && (
                          <span className="text-xs text-brand-600 dark:text-brand-400">
                            {email.verantwortlichName}
                          </span>
                        )}
                      </button>

                      {/* User dropdown */}
                      {showUserDropdown && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-lg max-h-48 overflow-y-auto">
                          {users.map((u) => (
                            <button
                              key={u.id}
                              onClick={() =>
                                handleAssignVerantwortlicher(
                                  u.id,
                                  u.name
                                )
                              }
                              className={cn(
                                "w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                                email.verantwortlichId === u.id &&
                                  "bg-brand-50 dark:bg-brand-950/20"
                              )}
                            >
                              {u.name}
                            </button>
                          ))}
                          {users.length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-400">
                              Laden...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Date */}
                  {date && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      {date.toLocaleDateString("de-DE", {
                        weekday: "short",
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
                  )}
                </div>
              </div>

              {/* Recipients (collapsible) */}
              <div className="mt-1.5 text-xs text-slate-500 space-y-0.5">
                <p>
                  <span className="text-slate-400 mr-1.5">An:</span>
                  {hasMultipleRecipients && !showAllRecipients
                    ? `${email.empfaenger[0]}${email.empfaenger.length > 1 ? ` (+${email.empfaenger.length - 1})` : ""}`
                    : email.empfaenger.join(", ")}
                </p>

                {showAllRecipients && email.cc.length > 0 && (
                  <p>
                    <span className="text-slate-400 mr-1.5">CC:</span>
                    {email.cc.join(", ")}
                  </p>
                )}

                {showAllRecipients && email.bcc.length > 0 && (
                  <p>
                    <span className="text-slate-400 mr-1.5">BCC:</span>
                    {email.bcc.join(", ")}
                  </p>
                )}

                {hasMultipleRecipients && (
                  <button
                    onClick={() => setShowAllRecipients(!showAllRecipients)}
                    className="text-brand-600 hover:text-brand-700 flex items-center gap-0.5 mt-0.5"
                  >
                    {showAllRecipients ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        Weniger
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        Alle anzeigen ({totalRecipients})
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Attachment strip */}
          {email.anhaenge.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap py-2 border-y border-slate-100 dark:border-slate-800">
              <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-500 mr-1">
                {email.anhaenge.length} Anhang
                {email.anhaenge.length > 1 ? "e" : ""}
              </span>
              {email.anhaenge.map((attachment) => (
                <AttachmentChip
                  key={attachment.id}
                  attachment={attachment}
                />
              ))}
            </div>
          )}

          {/* Email body */}
          <div className="pt-2">
            <EmailHtmlBody html={email.inhalt} text={email.inhaltText} />
          </div>

          {/* Inline reply */}
          {replyMode && (
            <EmailInlineReply
              mode={replyMode}
              originalEmail={email}
              onClose={handleCloseReply}
              onSent={handleSent}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Attachment chip ────────────────────────────────────────────────────────

function AttachmentChip({
  attachment,
}: {
  attachment: {
    id: string;
    dateiname: string;
    mimeType: string;
    groesse: number;
    downloadUrl?: string;
  };
}) {
  const Icon = getFileIcon(attachment.mimeType);

  return (
    <a
      href={attachment.downloadUrl ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md glass-input hover:opacity-80 transition-opacity group"
      title={`${attachment.dateiname} (${formatFileSize(attachment.groesse)})`}
    >
      <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
      <span className="text-xs text-foreground/80 truncate max-w-[120px]">
        {attachment.dateiname}
      </span>
      <span className="text-[10px] text-slate-400">
        {formatFileSize(attachment.groesse)}
      </span>
      <Download className="w-3 h-3 text-slate-300 group-hover:text-brand-600 flex-shrink-0" />
    </a>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getFileIcon(mimeType: string): React.ElementType {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return FileSpreadsheet;
  if (mimeType.includes("document") || mimeType.includes("word"))
    return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
