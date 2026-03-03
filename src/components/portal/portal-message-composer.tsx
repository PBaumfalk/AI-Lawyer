"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PortalMessageComposerProps {
  akteId: string;
  channelId: string;
  onMessageSent: () => void;
}

/**
 * Portal message composer -- simple textarea with Enter=send.
 * File attachment support will be added in Task 2.
 */
export function PortalMessageComposer({
  akteId,
  channelId,
  onMessageSent,
}: PortalMessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Send message
  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/portal/akten/${akteId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Senden");
      }

      // Clear
      setText("");
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
  }, [text, sending, akteId, onMessageSent]);

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

  return (
    <div className="border-t border-white/10 dark:border-white/[0.06] p-3 flex-shrink-0">
      <div className="flex items-end gap-2">
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
          disabled={sending || !text.trim()}
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
