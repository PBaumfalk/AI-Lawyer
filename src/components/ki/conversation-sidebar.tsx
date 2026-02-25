"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Trash2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  akteId: string | null;
  titel: string | null;
  updatedAt: string;
  messageCount: number;
  akte: {
    aktenzeichen: string;
    kurzrubrum: string;
  } | null;
}

interface ConversationSidebarProps {
  selectedConversationId: string | null;
  akteIdFilter: string | null;
  onSelectConversation: (convId: string, akteId: string | null) => void;
  refreshKey: number;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "gerade eben";
  if (diffMins < 60) return `vor ${diffMins} Min.`;
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function ConversationSidebar({
  selectedConversationId,
  akteIdFilter,
  onSelectConversation,
  refreshKey,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const url = akteIdFilter
        ? `/api/ki-chat/conversations?akteId=${encodeURIComponent(akteIdFilter)}`
        : "/api/ki-chat/conversations";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch {
      // Network error -- ignore
    } finally {
      setLoading(false);
    }
  }, [akteIdFilter]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations, refreshKey]);

  const handleDelete = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (!confirm("Unterhaltung loeschen?")) return;

    setDeletingId(convId);
    try {
      const res = await fetch(`/api/ki-chat/conversations/${convId}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        setConversations((prev) => prev.filter((c) => c.id !== convId));
      }
    } catch {
      // Ignore
    } finally {
      setDeletingId(null);
    }
  };

  // Group conversations by Akte
  const grouped: Record<string, Conversation[]> = {};
  for (const conv of conversations) {
    const groupKey = conv.akte
      ? `${conv.akte.aktenzeichen} - ${conv.akte.kurzrubrum}`
      : "Ohne Akten-Zuordnung";
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(conv);
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 bg-slate-200/50 dark:bg-slate-800/50 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Noch keine Unterhaltungen</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-4">
      {Object.entries(grouped).map(([groupName, convs]) => (
        <div key={groupName}>
          <div className="flex items-center gap-1.5 px-2 mb-1">
            <FolderOpen className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
              {groupName}
            </span>
          </div>
          <div className="space-y-0.5">
            {convs.map((conv) => (
              <button
                key={conv.id}
                onClick={() =>
                  onSelectConversation(conv.id, conv.akteId)
                }
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors group",
                  selectedConversationId === conv.id
                    ? "bg-brand-500/15 text-brand-700 dark:text-brand-300"
                    : "text-foreground/80 hover:bg-white/50 dark:hover:bg-white/[0.05]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate font-medium text-xs">
                    {conv.titel ?? "Neue Unterhaltung"}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, conv.id)}
                    className={cn(
                      "opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-500 transition-opacity shrink-0",
                      deletingId === conv.id && "opacity-100"
                    )}
                    title="Loeschen"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                  <span>{formatRelativeTime(conv.updatedAt)}</span>
                  <span>{conv.messageCount} Nachrichten</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
