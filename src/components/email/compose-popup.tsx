"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Minimize2,
  Maximize2,
  X,
  Send,
  Clock,
  ChevronDown,
  GripHorizontal,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { ComposeEditor, type ComposeEditorRef } from "./compose-editor";
import { ComposeRecipients } from "./compose-recipients";
import {
  ComposeAttachments,
  type AttachmentFile,
} from "./compose-attachments";

interface ComposePopupProps {
  id: string;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  isMaximized?: boolean;
}

interface ScheduleOption {
  label: string;
  getDate: () => Date;
}

function getNextBusinessDay(hour: number, minute: number = 0): Date {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  target.setDate(target.getDate() + 1);
  // Skip weekends
  while (target.getDay() === 0 || target.getDay() === 6) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

function getNextMonday(hour: number): Date {
  const now = new Date();
  const target = new Date(now);
  const daysUntilMonday = ((1 - now.getDay() + 7) % 7) || 7;
  target.setDate(target.getDate() + daysUntilMonday);
  target.setHours(hour, 0, 0, 0);
  return target;
}

const SCHEDULE_OPTIONS: ScheduleOption[] = [
  {
    label: "Morgen 08:00",
    getDate: () => getNextBusinessDay(8),
  },
  {
    label: "Naechster Montag 09:00",
    getDate: () => getNextMonday(9),
  },
];

export function ComposePopup({
  id,
  onMinimize,
  onMaximize,
  onClose,
  isMaximized,
}: ComposePopupProps) {
  // Form state
  const [kontoId, setKontoId] = useState("");
  const [empfaenger, setEmpfaenger] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [betreff, setBetreff] = useState("");
  const [akteId, setAkteId] = useState<string | null>(null);
  const [akteSearch, setAkteSearch] = useState("");
  const [akteResults, setAkteResults] = useState<any[]>([]);
  const [prioritaet, setPrioritaet] = useState<"NIEDRIG" | "NORMAL" | "HOCH">(
    "NORMAL"
  );
  const [lesebestaetigung, setLesebestaetigung] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [customScheduleDate, setCustomScheduleDate] = useState("");
  const [sending, setSending] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Mailbox options
  const [konten, setKonten] = useState<
    { id: string; name: string; emailAdresse: string }[]
  >([]);

  const editorRef = useRef<ComposeEditorRef>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval>>();
  const draftIdRef = useRef<string | null>(null);
  const [signatureHtml, setSignatureHtml] = useState("");

  // Load user's mailboxes
  useEffect(() => {
    fetch("/api/email-konten")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setKonten(list);
        if (list.length > 0 && !kontoId) {
          setKontoId(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Load signature when kontoId changes
  useEffect(() => {
    if (!kontoId) return;
    fetch(`/api/email-signature?kontoId=${kontoId}`)
      .then((r) => {
        if (r.ok) return r.json();
        return null;
      })
      .then((data) => {
        if (data?.signature) {
          setSignatureHtml(data.signature);
          // Insert signature into editor
          if (editorRef.current) {
            editorRef.current.insertHTML(
              `<br/><br/><div class="email-signature">${data.signature}</div>`
            );
          }
        }
      })
      .catch(() => {});
  }, [kontoId]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      if (dirty) {
        saveDraft();
      }
    }, 30_000);

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [dirty, kontoId, empfaenger, betreff]);

  // Akte search
  useEffect(() => {
    if (!akteSearch || akteSearch.length < 2) {
      setAkteResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/akten?search=${encodeURIComponent(akteSearch)}&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          setAkteResults(Array.isArray(data) ? data : data?.data ?? []);
        }
      } catch {
        setAkteResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [akteSearch]);

  const saveDraft = useCallback(async () => {
    if (!kontoId) return;
    try {
      const html = editorRef.current?.getHTML() || "";
      const text = editorRef.current?.getText() || "";

      const body = {
        kontoId,
        empfaenger,
        cc,
        bcc,
        betreff: betreff || "(Kein Betreff)",
        inhalt: html,
        inhaltText: text,
        sendeStatus: "ENTWURF",
      };

      if (draftIdRef.current) {
        // Update existing draft
        await fetch(`/api/emails/${draftIdRef.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        // Create new draft
        const res = await fetch("/api/email-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            anhaenge: [],
            prioritaet,
            lesebestaetigung,
            geplanterVersand: undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          draftIdRef.current = data.emailId;
        }
      }
      setDirty(false);
    } catch {
      // Draft save failed silently
    }
  }, [kontoId, empfaenger, cc, bcc, betreff, prioritaet, lesebestaetigung]);

  const handleEditorChange = () => {
    setDirty(true);
  };

  const handleSend = async (scheduledDate?: Date) => {
    // Validation
    if (empfaenger.length === 0) {
      toast.error("Bitte geben Sie mindestens einen Empfaenger an.");
      return;
    }

    if (!betreff.trim()) {
      const proceed = window.confirm("Ohne Betreff senden?");
      if (!proceed) return;
    }

    if (!kontoId) {
      toast.error("Bitte waehlen Sie ein Postfach aus.");
      return;
    }

    // Reply-All safety: warn if 5+ recipients
    const totalRecipients = empfaenger.length + cc.length + bcc.length;
    if (totalRecipients >= 5) {
      const proceed = window.confirm(
        `Sie senden an ${totalRecipients} Empfaenger. Fortfahren?`
      );
      if (!proceed) return;
    }

    setSending(true);

    try {
      const html = editorRef.current?.getHTML() || "";
      const text = editorRef.current?.getText() || "";

      const payload: any = {
        kontoId,
        empfaenger,
        cc,
        bcc,
        betreff: betreff || "(Kein Betreff)",
        inhalt: html,
        inhaltText: text,
        akteId: akteId || undefined,
        anhaenge: attachments
          .filter((a) => a.storageKey)
          .map((a) => a.storageKey!),
        prioritaet,
        lesebestaetigung,
      };

      if (scheduledDate) {
        payload.geplanterVersand = scheduledDate.toISOString();
      }

      const res = await fetch("/api/email-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Fehler beim Senden der E-Mail");
        return;
      }

      const data = await res.json();

      if (scheduledDate) {
        // Scheduled send confirmation
        const formatted = scheduledDate.toLocaleString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        toast.success(`Geplant fuer ${formatted}`);
        onClose();
      } else {
        // Show 10-second undo toast
        toast("E-Mail wird in 10s gesendet", {
          duration: 10_000,
          action: {
            label: "Rueckgaengig",
            onClick: async () => {
              try {
                const cancelRes = await fetch("/api/email-send/cancel", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ emailId: data.emailId }),
                });
                if (cancelRes.ok) {
                  toast.success("E-Mail-Versand abgebrochen");
                } else {
                  toast.error(
                    "Konnte nicht abgebrochen werden - E-Mail wurde bereits gesendet"
                  );
                }
              } catch {
                toast.error("Fehler beim Abbrechen");
              }
            },
          },
        });
        onClose();
      }
    } finally {
      setSending(false);
    }
  };

  const handleDiscard = () => {
    if (dirty) {
      const proceed = window.confirm(
        "Nicht gespeicherte Aenderungen verwerfen?"
      );
      if (!proceed) return;
    }
    onClose();
  };

  const handleAddAttachments = (files: AttachmentFile[]) => {
    setAttachments((prev) => [...prev, ...files]);
    setDirty(true);
  };

  const handleRemoveAttachment = (fileId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== fileId));
    setDirty(true);
  };

  // Position and size classes
  const popupClasses = isMaximized
    ? "fixed inset-4 z-[90]"
    : "fixed bottom-0 right-4 w-[560px] h-[620px] z-[90]";

  return (
    <div
      className={`${popupClasses} flex flex-col bg-white dark:bg-slate-900 rounded-t-xl shadow-2xl border border-white/20 dark:border-white/[0.08] overflow-hidden`}
    >
      {/* Header / drag bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 dark:bg-slate-950 cursor-move select-none">
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-white truncate max-w-[300px]">
            {betreff || "Neue Nachricht"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMinimize}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Minimieren"
          >
            <Minimize2 className="w-3.5 h-3.5 text-white/70" />
          </button>
          <button
            type="button"
            onClick={onMaximize}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title={isMaximized ? "Verkleinern" : "Maximieren"}
          >
            <Maximize2 className="w-3.5 h-3.5 text-white/70" />
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Schliessen"
          >
            <X className="w-3.5 h-3.5 text-white/70" />
          </button>
        </div>
      </div>

      {/* Form fields */}
      <div className="flex-shrink-0 border-b border-white/10 dark:border-white/[0.06]">
        {/* Von (sender mailbox) */}
        <div className="flex items-center border-b border-white/10 dark:border-white/[0.06]">
          <label className="px-4 py-2.5 text-sm text-muted-foreground w-14 flex-shrink-0">
            Von:
          </label>
          <select
            value={kontoId}
            onChange={(e) => setKontoId(e.target.value)}
            className="flex-1 bg-transparent border-0 text-sm text-foreground focus:outline-none py-2"
          >
            {konten.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} &lt;{k.emailAdresse}&gt;
              </option>
            ))}
          </select>
        </div>

        {/* An (recipients) */}
        <ComposeRecipients
          label="An"
          value={empfaenger}
          onChange={(v) => {
            setEmpfaenger(v);
            setDirty(true);
          }}
        />

        {/* CC/BCC toggles */}
        {!showCc && !showBcc && (
          <div className="flex items-center gap-2 px-4 py-1 border-b border-white/10 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setShowCc(true)}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
            >
              CC
            </button>
            <button
              type="button"
              onClick={() => setShowBcc(true)}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
            >
              BCC
            </button>
          </div>
        )}

        {showCc && (
          <ComposeRecipients
            label="CC"
            value={cc}
            onChange={(v) => {
              setCc(v);
              setDirty(true);
            }}
          />
        )}

        {showBcc && (
          <ComposeRecipients
            label="BCC"
            value={bcc}
            onChange={(v) => {
              setBcc(v);
              setDirty(true);
            }}
          />
        )}

        {/* Betreff */}
        <div className="flex items-center border-b border-white/10 dark:border-white/[0.06]">
          <label className="px-4 py-2.5 text-sm text-muted-foreground w-14 flex-shrink-0">
            Betr.:
          </label>
          <input
            type="text"
            value={betreff}
            onChange={(e) => {
              setBetreff(e.target.value);
              setDirty(true);
            }}
            placeholder="Betreff eingeben..."
            className="flex-1 bg-transparent border-0 text-sm text-foreground font-medium placeholder:text-muted-foreground focus:outline-none py-2.5"
          />
        </div>

        {/* Akte (optional) */}
        <div className="flex items-center border-b border-white/10 dark:border-white/[0.06] relative">
          <label className="px-4 py-2.5 text-sm text-muted-foreground w-14 flex-shrink-0">
            Akte:
          </label>
          <div className="flex-1 relative">
            {akteId ? (
              <div className="flex items-center gap-2 py-2">
                <span className="text-sm text-foreground">
                  {akteResults.find((a: any) => a.id === akteId)?.aktenzeichen ||
                    akteId}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAkteId(null);
                    setAkteSearch("");
                  }}
                  className="text-muted-foreground hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={akteSearch}
                  onChange={(e) => setAkteSearch(e.target.value)}
                  placeholder="Akte suchen (optional)..."
                  className="w-full bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none py-2.5"
                />
                {akteResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-white/20 dark:border-white/[0.08] max-h-36 overflow-y-auto">
                    {akteResults.map((a: any) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          setAkteId(a.id);
                          setAkteSearch("");
                          setAkteResults([]);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/50 dark:hover:bg-white/[0.04] transition-colors"
                      >
                        <span className="font-medium text-foreground">
                          {a.aktenzeichen}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          {a.kurzrubrum}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto">
        <ComposeEditor
          ref={editorRef}
          onChange={handleEditorChange}
          initialContent=""
        />
      </div>

      {/* Attachments */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-white/10 dark:border-white/[0.06]">
        <ComposeAttachments
          attachments={attachments}
          onAdd={handleAddAttachments}
          onRemove={handleRemoveAttachment}
          akteId={akteId}
        />
      </div>

      {/* Footer with send actions */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-white/10 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Send button */}
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
            {sending ? "Wird gesendet..." : "Senden"}
          </button>

          {/* Schedule dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSchedule(!showSchedule)}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/20 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
              title="Spaeter senden"
            >
              <Clock className="w-4 h-4" />
              <ChevronDown className="w-3 h-3" />
            </button>

            {showSchedule && (
              <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-white/20 dark:border-white/[0.08] w-64 z-50">
                <div className="p-2 text-xs font-medium text-muted-foreground border-b border-white/10 dark:border-white/[0.06]">
                  Spaeter senden
                </div>
                {SCHEDULE_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      setShowSchedule(false);
                      handleSend(opt.getDate());
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/50 dark:hover:bg-white/[0.04] transition-colors flex items-center gap-2"
                  >
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    {opt.label}
                  </button>
                ))}

                {/* Custom datetime */}
                <div className="border-t border-white/10 dark:border-white/[0.06] p-2">
                  <input
                    type="datetime-local"
                    value={customScheduleDate}
                    onChange={(e) => setCustomScheduleDate(e.target.value)}
                    className="w-full text-sm bg-transparent border border-white/20 dark:border-white/[0.08] rounded px-2 py-1 text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customScheduleDate) {
                        setShowSchedule(false);
                        handleSend(new Date(customScheduleDate));
                      }
                    }}
                    disabled={!customScheduleDate}
                    className="mt-1 w-full px-3 py-1.5 text-xs bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    Planen
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Priority dropdown */}
          <select
            value={prioritaet}
            onChange={(e) =>
              setPrioritaet(e.target.value as "NIEDRIG" | "NORMAL" | "HOCH")
            }
            className="text-xs bg-transparent border border-white/20 dark:border-white/[0.08] rounded px-2 py-1.5 text-muted-foreground"
          >
            <option value="NIEDRIG">Niedrig</option>
            <option value="NORMAL">Normal</option>
            <option value="HOCH">Hoch</option>
          </select>

          {/* Read receipt */}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={lesebestaetigung}
              onChange={(e) => setLesebestaetigung(e.target.checked)}
              className="rounded border-white/30"
            />
            Lesebestaetigung
          </label>
        </div>

        {/* Discard button */}
        <button
          type="button"
          onClick={handleDiscard}
          className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
          title="Verwerfen"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
