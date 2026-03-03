"use client";

import { Bot, Download, FileText } from "lucide-react";
import type { MessageListItem } from "@/lib/messaging/types";

interface PortalMessageBubbleProps {
  message: MessageListItem;
  isOwn: boolean;
  showHeader: boolean;
  akteId: string;
}

/**
 * Generate a deterministic color from a name string for avatar background.
 */
function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `oklch(65% 0.15 ${hue})`;
}

/**
 * Get initials from a name string (max 2 chars).
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name[0] ?? "?").toUpperCase();
}

/**
 * Format a timestamp: today shows HH:mm, older shows dd.MM. HH:mm
 */
function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const time = `${hours}:${minutes}`;

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return time;

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}.${month}. ${time}`;
}

export function PortalMessageBubble({
  message,
  isOwn,
  showHeader,
  akteId,
}: PortalMessageBubbleProps) {
  // Deleted message
  if (message.deletedAt) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs italic text-muted-foreground/60">
          [Nachricht geloescht]
        </span>
      </div>
    );
  }

  // System message
  if (message.isSystem) {
    return (
      <div className="flex justify-center py-1">
        <div className="flex items-center gap-2 max-w-[80%]">
          <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-violet-400" />
          </div>
          <div className="glass-card rounded-xl px-3 py-2 text-sm text-muted-foreground">
            {message.body}
          </div>
        </div>
      </div>
    );
  }

  // Handle attachment download
  const handleDownload = async (att: { dokumentId?: string; name?: string }) => {
    if (!att.dokumentId) return;

    // Check if the attachment already has a URL (pre-signed from API)
    const attWithUrl = att as { dokumentId?: string; name?: string; url?: string };
    if (attWithUrl.url) {
      window.open(attWithUrl.url, "_blank");
      return;
    }

    // Fallback: fetch download URL from portal endpoint
    try {
      const res = await fetch(
        `/api/portal/akten/${akteId}/dokumente/${att.dokumentId}/download`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      // Silently fail
    }
  };

  // Regular message
  return (
    <div
      className={`flex flex-col ${
        isOwn ? "items-end" : "items-start"
      } ${showHeader ? "mt-3" : "mt-0.5"}`}
    >
      {/* Author header */}
      {showHeader && (
        <div
          className={`flex items-center gap-2 mb-1 ${
            isOwn ? "flex-row-reverse" : "flex-row"
          }`}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
            style={{ backgroundColor: nameToColor(message.authorName) }}
          >
            {getInitials(message.authorName)}
          </div>
          <span className="text-xs font-medium text-foreground">
            {message.authorName}
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            {formatTime(message.createdAt)}
            {message.editedAt && " (bearbeitet)"}
          </span>
        </div>
      )}

      {/* Message body */}
      <div
        className={`max-w-[70%] glass-card rounded-xl px-3 py-2 text-sm ${
          isOwn
            ? "bg-[oklch(45%_0.2_260/0.15)] text-foreground"
            : "text-foreground"
        }`}
      >
        {message.body}
      </div>

      {/* Attachments as downloadable chips */}
      {message.attachments &&
        Array.isArray(message.attachments) &&
        message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1 max-w-[70%]">
            {message.attachments.map((att: unknown, i: number) => {
              const a = att as { dokumentId?: string; name?: string; url?: string };
              return (
                <button
                  key={a.dokumentId ?? i}
                  type="button"
                  onClick={() => handleDownload(a)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white/10 dark:bg-white/[0.04] border border-white/10 dark:border-white/[0.06] rounded-full text-muted-foreground hover:text-foreground hover:bg-white/20 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <FileText className="w-3 h-3" />
                  <span className="max-w-[150px] truncate">
                    {a.name ?? "Dokument"}
                  </span>
                  <Download className="w-3 h-3" />
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
}
