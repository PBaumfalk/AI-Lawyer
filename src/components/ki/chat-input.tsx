"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import {
  Send,
  FileText,
  Clock,
  Users,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  akteId: string | null;
  conversationId: string | null;
  crossAkte: boolean;
  onMessageSent?: () => void;
}

const quickActions = [
  {
    label: "Zusammenfassung",
    prompt: "Erstelle eine ausfuehrliche Zusammenfassung aller Dokumente in dieser Akte.",
    icon: ScrollText,
  },
  {
    label: "Fristen pruefen",
    prompt: "Pruefe alle Dokumente auf genannte Fristen und Termine. Liste sie chronologisch auf.",
    icon: Clock,
  },
  {
    label: "Schriftsatz entwerfen",
    prompt: "Entwirf basierend auf den Akten-Dokumenten einen Schriftsatz-Entwurf.",
    icon: FileText,
  },
  {
    label: "Beteiligte identifizieren",
    prompt: "Identifiziere alle in den Dokumenten genannten Personen, Parteien und Institutionen mit ihren Rollen.",
    icon: Users,
  },
];

export function ChatInput({
  akteId,
  conversationId,
  crossAkte,
  onMessageSent,
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { append, isLoading } = useChat({
    api: "/api/ki-chat",
    body: {
      akteId,
      conversationId,
      crossAkte,
    },
    onFinish: () => {
      onMessageSent?.();
    },
  });

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [inputValue]);

  const handleSubmit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setInputValue("");
      // Dispatch a custom event so the ChatMessages component picks up the message
      // The parent ChatLayout re-keys ChatMessages, so we use the shared useChat instance
      // in ChatMessages instead. We post to the API directly here for a simpler approach.

      try {
        await append({
          role: "user",
          content: trimmed,
        });
      } catch {
        // Error handled by useChat
      }
    },
    [isLoading, append]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(inputValue);
      }
    },
    [inputValue, handleSubmit]
  );

  const handleQuickAction = useCallback(
    (prompt: string) => {
      handleSubmit(prompt);
    },
    [handleSubmit]
  );

  // Drag & drop zone (stub)
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    // Stub: show info about document processing
    alert(
      "Dokument wird verarbeitet, bitte warten... (Diese Funktion wird in einer spaeteren Version vollstaendig implementiert.)"
    );
  }, []);

  return (
    <div
      className={cn(
        "border-t border-white/10 dark:border-white/[0.06] px-4 py-3",
        isDragOver && "bg-brand-500/10 border-brand-500/30"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Quick action buttons */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => handleQuickAction(action.prompt)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/20 dark:border-white/10 text-muted-foreground hover:text-foreground hover:border-brand-500/30 hover:bg-brand-500/5 transition-colors disabled:opacity-50"
          >
            <action.icon className="w-3 h-3" />
            {action.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isDragOver
                ? "Dokument hier ablegen fuer sofortige Analyse..."
                : "Frage an Helena stellen..."
            }
            rows={1}
            className="w-full resize-none bg-white/50 dark:bg-white/[0.03] border border-white/20 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/30 transition-colors"
            disabled={isLoading}
          />
        </div>
        <button
          onClick={() => handleSubmit(inputValue)}
          disabled={!inputValue.trim() || isLoading}
          className="flex-shrink-0 p-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Senden"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Drag indicator */}
      {isDragOver && (
        <p className="text-xs text-brand-600 dark:text-brand-400 mt-1.5 text-center">
          Dokument hier ablegen fuer sofortige Analyse
        </p>
      )}
    </div>
  );
}
