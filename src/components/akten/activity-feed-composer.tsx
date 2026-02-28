"use client";

import { useState, useRef, useCallback } from "react";
import { Bot, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { FeedEntryData } from "./activity-feed-entry";

interface ActivityFeedComposerProps {
  akteId: string;
  onNoteCreated: (entry: FeedEntryData) => void;
  onHelenaTaskStarted?: (taskId: string) => void;
}

export function ActivityFeedComposer({
  akteId,
  onNoteCreated,
  onHelenaTaskStarted,
}: ActivityFeedComposerProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as user types
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      const ta = e.target;
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    },
    []
  );

  // Insert @Helena at cursor position
  const insertHelenaMention = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = text.slice(0, start);
    const after = text.slice(end);

    // Only insert if not already present
    if (text.includes("@Helena")) {
      ta.focus();
      return;
    }

    const mention = "@Helena ";
    const newText = before + mention + after;
    setText(newText);

    // Set cursor after the mention
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + mention.length;
      ta.selectionEnd = start + mention.length;
    });
  }, [text]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/akten/${akteId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Senden");
      }

      const data = await res.json();

      // Optimistic prepend of new note
      onNoteCreated(data.activity);

      // Notify about Helena task if created
      if (data.taskId && onHelenaTaskStarted) {
        onHelenaTaskStarted(data.taskId);
      }

      // Clear textarea
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Fehler beim Senden"
      );
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, akteId, onNoteCreated, onHelenaTaskStarted]);

  // Enter to submit, Shift+Enter for newline
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
    <div className="glass-card rounded-xl p-3 flex-shrink-0 border-t border-slate-200 dark:border-slate-700">
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={insertHelenaMention}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-brand-600 transition-colors"
          title="@Helena erwaehnen"
        >
          <Bot className="w-5 h-5" />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Notiz schreiben oder @Helena erwaehnen..."
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-slate-400 focus:outline-none min-h-[40px] max-h-[120px]"
          rows={1}
          disabled={submitting}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
          className="p-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
