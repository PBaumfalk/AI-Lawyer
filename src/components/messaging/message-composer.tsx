"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Bot,
  Send,
  Loader2,
  Paperclip,
  X,
  Search,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { MentionPicker } from "./mention-picker";

interface MessageComposerProps {
  channelId: string;
  members: { userId: string; userName: string }[];
  onSent: () => void;
}

interface Attachment {
  dokumentId: string;
  name: string;
}

export function MessageComposer({
  channelId,
  members,
  onSent,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mention picker state
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);

  // DMS document picker state
  const [dmsPickerOpen, setDmsPickerOpen] = useState(false);
  const [dmsDocuments, setDmsDocuments] = useState<
    { id: string; name: string }[]
  >([]);
  const [dmsLoading, setDmsLoading] = useState(false);
  const [dmsSearch, setDmsSearch] = useState("");

  // Reset state when channel changes
  useEffect(() => {
    setText("");
    setAttachments([]);
    setMentionOpen(false);
    setDmsPickerOpen(false);
  }, [channelId]);

  // Auto-resize textarea
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setText(newText);

      const ta = e.target;
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;

      // Detect @mention trigger
      const cursorPos = ta.selectionStart;
      const textBeforeCursor = newText.slice(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex >= 0) {
        const textBetween = textBeforeCursor.slice(lastAtIndex + 1);
        // Only trigger if @ is at start or preceded by space, and no space in query
        const charBefore = lastAtIndex > 0 ? newText[lastAtIndex - 1] : " ";
        if (
          (charBefore === " " || charBefore === "\n" || lastAtIndex === 0) &&
          !textBetween.includes(" ")
        ) {
          setMentionQuery(textBetween);
          setMentionOpen(true);
          setMentionIndex(0);
          setMentionStartPos(lastAtIndex);
          return;
        }
      }

      setMentionOpen(false);
      setMentionStartPos(null);
    },
    []
  );

  // Extract mention user IDs from text
  const extractMentions = useCallback(
    (messageText: string): string[] => {
      const mentionIds: string[] = [];

      // Check for @alle
      if (messageText.includes("@alle")) {
        mentionIds.push("__alle__");
      }

      // Check for @Name patterns against members list
      for (const member of members) {
        if (messageText.includes(`@${member.userName}`)) {
          mentionIds.push(member.userId);
        }
      }

      return Array.from(new Set(mentionIds));
    },
    [members]
  );

  // Send message
  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const mentions = extractMentions(trimmed);

      const res = await fetch(`/api/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmed,
          mentions: mentions.length > 0 ? mentions : undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Senden");
      }

      // Clear state
      setText("");
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      onSent();

      // Refocus textarea
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
  }, [text, sending, channelId, attachments, extractMentions, onSent]);

  // Keyboard handling
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIndex((prev) => prev + 1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          // Selection is handled by MentionPicker via onSelect
          // We trigger the selection by dispatching a custom event-like callback
          // The MentionPicker will call onSelect for the selectedIndex item
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setMentionOpen(false);
          return;
        }
      }

      // Normal Enter: send
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [mentionOpen, handleSubmit]
  );

  // Handle mention selection
  const handleMentionSelect = useCallback(
    (member: { userId: string; userName: string }) => {
      if (mentionStartPos === null) return;

      const ta = textareaRef.current;
      if (!ta) return;

      const before = text.slice(0, mentionStartPos);
      const cursorPos = ta.selectionStart;
      const after = text.slice(cursorPos);
      const mention = `@${member.userName} `;
      const newText = before + mention + after;

      setText(newText);
      setMentionOpen(false);
      setMentionStartPos(null);

      requestAnimationFrame(() => {
        ta.focus();
        const newPos = before.length + mention.length;
        ta.selectionStart = newPos;
        ta.selectionEnd = newPos;
      });
    },
    [text, mentionStartPos]
  );

  // Insert @Helena at cursor
  const insertHelenaMention = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = text.slice(0, start);
    const after = text.slice(end);

    if (text.includes("@Helena")) {
      ta.focus();
      return;
    }

    const mention = "@Helena ";
    const newText = before + mention + after;
    setText(newText);

    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + mention.length;
      ta.selectionEnd = start + mention.length;
    });
  }, [text]);

  // Open DMS document picker
  const openDmsPicker = useCallback(async () => {
    setDmsPickerOpen(true);
    setDmsLoading(true);
    setDmsSearch("");
    try {
      const res = await fetch("/api/dokumente?limit=50");
      if (res.ok) {
        const data = await res.json();
        const docs = Array.isArray(data)
          ? data
          : data?.dokumente ?? data?.data ?? [];
        setDmsDocuments(
          docs.map((d: { id: string; dateiname?: string; name?: string }) => ({
            id: d.id,
            name: d.dateiname ?? d.name ?? "Dokument",
          }))
        );
      }
    } catch {
      setDmsDocuments([]);
    } finally {
      setDmsLoading(false);
    }
  }, []);

  // Add DMS attachment
  const addAttachment = useCallback(
    (doc: { id: string; name: string }) => {
      // Avoid duplicates
      if (attachments.some((a) => a.dokumentId === doc.id)) return;
      setAttachments((prev) => [
        ...prev,
        { dokumentId: doc.id, name: doc.name },
      ]);
    },
    [attachments]
  );

  // Remove attachment
  const removeAttachment = useCallback((dokumentId: string) => {
    setAttachments((prev) => prev.filter((a) => a.dokumentId !== dokumentId));
  }, []);

  // Filter DMS documents by search
  const filteredDocs = dmsSearch
    ? dmsDocuments.filter((d) =>
        d.name.toLowerCase().includes(dmsSearch.toLowerCase())
      )
    : dmsDocuments;

  return (
    <div className="border-t border-white/10 dark:border-white/[0.06] p-3 flex-shrink-0 relative">
      {/* Mention picker -- positioned above composer */}
      {mentionOpen && (
        <MentionPicker
          members={members}
          query={mentionQuery}
          isOpen={mentionOpen}
          onSelect={handleMentionSelect}
          selectedIndex={mentionIndex}
        />
      )}

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {attachments.map((att) => (
            <span
              key={att.dokumentId}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/30 dark:bg-white/[0.04] border border-white/20 dark:border-white/[0.08] rounded-full text-xs"
            >
              <Paperclip className="w-3 h-3 text-muted-foreground" />
              <span className="max-w-[180px] truncate text-foreground">
                {att.name}
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(att.dokumentId)}
                className="text-muted-foreground hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Composer row */}
      <div className="flex items-end gap-2">
        {/* Paperclip button -- DMS document picker */}
        <button
          type="button"
          onClick={openDmsPicker}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-foreground transition-colors"
          title="Dokument anhaengen"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* @Helena button */}
        <button
          type="button"
          onClick={insertHelenaMention}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-brand-600 transition-colors"
          title="@Helena erwaehnen"
        >
          <Bot className="w-5 h-5" />
        </button>

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

      {/* DMS Document Picker Dialog */}
      {dmsPickerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="glass-panel-elevated rounded-xl shadow-2xl w-full max-w-md max-h-[60vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 dark:border-white/[0.06]">
              <h3 className="font-semibold text-sm text-foreground">
                Dokument anhaengen
              </h3>
              <button
                type="button"
                onClick={() => setDmsPickerOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-2 border-b border-white/10 dark:border-white/[0.06]">
              <div className="flex items-center gap-2 glass-input rounded-lg px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={dmsSearch}
                  onChange={(e) => setDmsSearch(e.target.value)}
                  placeholder="Dokument suchen..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Document list */}
            <div className="flex-1 overflow-y-auto p-3">
              {dmsLoading ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Lade Dokumente...
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Keine Dokumente gefunden
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredDocs.map((doc) => {
                    const isAttached = attachments.some(
                      (a) => a.dokumentId === doc.id
                    );
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => {
                          addAttachment(doc);
                          setDmsPickerOpen(false);
                        }}
                        disabled={isAttached}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                          isAttached
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-white/20 dark:hover:bg-white/[0.04]"
                        }`}
                      >
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-foreground truncate">
                          {doc.name}
                        </span>
                        {isAttached && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            angehaengt
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
