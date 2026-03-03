"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

interface PortalMessageComposerProps {
  akteId: string;
  channelId: string;
  onMessageSent: () => void;
}

interface PendingFile {
  file: File;
  id: string; // client-side ID for key/removal
}

interface UploadedAttachment {
  dokumentId: string;
  name: string;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "application/rtf",
];

const ACCEPTED_EXTENSIONS =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.rtf";

/**
 * Portal message composer with file attachment upload.
 * - Enter = send, Shift+Enter = newline
 * - Paperclip button to attach files (max 5, max 25 MB each)
 * - Files uploaded to MinIO via /api/portal/akten/[id]/dokumente/upload before sending
 * - No @mention picker, no @Helena button (portal simplicity)
 */
export function PortalMessageComposer({
  akteId,
  channelId,
  onMessageSent,
}: PortalMessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      const ta = e.target;
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    },
    []
  );

  // Add files from file picker
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const newFiles: PendingFile[] = [];
      const currentCount = pendingFiles.length;

      for (let i = 0; i < files.length; i++) {
        if (currentCount + newFiles.length >= MAX_FILES) {
          toast.error(`Maximal ${MAX_FILES} Dateien pro Nachricht`);
          break;
        }

        const file = files[i];

        if (file.size > MAX_FILE_SIZE) {
          toast.error(`"${file.name}" ist groesser als 25 MB`);
          continue;
        }

        newFiles.push({
          file,
          id: `${Date.now()}-${i}-${file.name}`,
        });
      }

      if (newFiles.length > 0) {
        setPendingFiles((prev) => [...prev, ...newFiles]);
      }

      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [pendingFiles.length]
  );

  // Remove a pending file
  const removePendingFile = useCallback((id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // Upload a single file to MinIO and return the attachment reference
  const uploadOneFile = async (file: File): Promise<UploadedAttachment> => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(
      `/api/portal/akten/${akteId}/dokumente/upload`,
      { method: "POST", body: formData }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `Upload von "${file.name}" fehlgeschlagen`);
    }

    const data = await res.json();
    return {
      dokumentId: data.dokument.id,
      name: data.dokument.name,
    };
  };

  // Send message (with optional file attachments)
  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    const hasText = trimmed.length > 0;
    const hasFiles = pendingFiles.length > 0;

    if ((!hasText && !hasFiles) || sending) return;

    setSending(true);
    try {
      // Step 1: Upload files first (if any)
      let attachments: UploadedAttachment[] | undefined;

      if (hasFiles) {
        const uploadResults = await Promise.all(
          pendingFiles.map((pf) => uploadOneFile(pf.file))
        );
        attachments = uploadResults;
      }

      // Step 2: Send message with text + attachment references
      const messageBody = hasText ? trimmed : `[${pendingFiles.length} Datei${pendingFiles.length > 1 ? "en" : ""} angehaengt]`;

      const res = await fetch(`/api/portal/akten/${akteId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: messageBody,
          ...(attachments && attachments.length > 0 ? { attachments } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Senden");
      }

      // Clear state
      setText("");
      setPendingFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      onMessageSent();

      // Refocus
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Fehler beim Senden"
      );
    } finally {
      setSending(false);
    }
  }, [text, sending, akteId, pendingFiles, onMessageSent]);

  // Keyboard: Enter = send, Shift+Enter = newline
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const canSend = text.trim().length > 0 || pendingFiles.length > 0;

  return (
    <div className="border-t border-white/10 dark:border-white/[0.06] p-3 flex-shrink-0">
      {/* Pending file chips */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {pendingFiles.map((pf) => (
            <span
              key={pf.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/30 dark:bg-white/[0.04] border border-white/20 dark:border-white/[0.08] rounded-full text-xs"
            >
              <Paperclip className="w-3 h-3 text-muted-foreground" />
              <span className="max-w-[180px] truncate text-foreground">
                {pf.file.name}
              </span>
              <button
                type="button"
                onClick={() => removePendingFile(pf.id)}
                className="text-muted-foreground hover:text-red-500 transition-colors"
                disabled={sending}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Composer row */}
      <div className="flex items-end gap-2">
        {/* Paperclip button -- file picker */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || pendingFiles.length >= MAX_FILES}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Datei anhaengen"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={handleFileSelect}
          disabled={sending}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Nachricht schreiben..."
          className="flex-1 resize-none glass-input bg-transparent text-sm text-foreground placeholder:text-slate-400 focus:outline-none min-h-[40px] max-h-[120px] px-3 py-2 rounded-lg"
          rows={1}
          disabled={sending}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={sending || !canSend}
          className="p-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
