"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import type { MessageListItem } from "@/lib/messaging/types";
import { EmptyState } from "@/components/ui/empty-state";
import { PortalMessageBubble } from "./portal-message-bubble";

interface PortalMessageListProps {
  akteId: string;
  channelId: string;
  currentUserId: string;
}

/**
 * Determine if consecutive messages should be grouped:
 * same author, within 5 minutes, neither is system.
 */
function shouldGroup(
  prev: MessageListItem,
  curr: MessageListItem
): boolean {
  if (prev.authorId !== curr.authorId) return false;
  if (prev.isSystem || curr.isSystem) return false;
  const prevTime = new Date(prev.createdAt).getTime();
  const currTime = new Date(curr.createdAt).getTime();
  return Math.abs(currTime - prevTime) < 5 * 60 * 1000;
}

export function PortalMessageList({
  akteId,
  channelId,
  currentUserId,
}: PortalMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Track whether we should scroll to bottom
  const shouldScrollRef = useRef(true);

  // Fetch messages
  const fetchMessages = useCallback(
    async (cursor?: string) => {
      try {
        const url = cursor
          ? `/api/portal/akten/${akteId}/messages?cursor=${cursor}&limit=50`
          : `/api/portal/akten/${akteId}/messages?limit=50`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        // API returns desc order, reverse for asc display (oldest at top)
        const reversed = [...(data.messages ?? [])].reverse();

        if (cursor) {
          // Loading older messages -- prepend
          setMessages((prev) => [...reversed, ...prev]);
        } else {
          // Fresh load
          setMessages(reversed);
          shouldScrollRef.current = true;
        }
        setNextCursor(data.nextCursor ?? null);
      } catch {
        // Silently fail
      }
    },
    [akteId]
  );

  // Initial load
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setNextCursor(null);
    fetchMessages().finally(() => setLoading(false));
  }, [fetchMessages]);

  // Scroll to bottom on initial load and when new messages arrive
  useEffect(() => {
    if (scrollRef.current && shouldScrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      shouldScrollRef.current = false;
    }
  }, [messages]);

  // Poll for new messages every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refetch fresh (no cursor) to get newest messages
      fetchMessages().then(() => {
        // Auto-scroll to bottom if user is near the bottom
        if (scrollRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
          const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
          if (isNearBottom) {
            shouldScrollRef.current = true;
          }
        }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Load older messages
  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await fetchMessages(nextCursor);
    setLoadingMore(false);
  }, [nextCursor, loadingMore, fetchMessages]);

  // Expose refetch for parent to call after sending a message
  // Using a data attribute approach so parent can trigger refetch
  const refetch = useCallback(() => {
    shouldScrollRef.current = true;
    fetchMessages();
  }, [fetchMessages]);

  // Store refetch on the DOM element for parent access
  useEffect(() => {
    const el = scrollRef.current?.parentElement;
    if (el) {
      (el as any).__portalMessageRefetch = refetch;
    }
  }, [refetch]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
          >
            <div
              className="h-12 rounded-xl bg-white/5 dark:bg-white/[0.03] animate-pulse"
              style={{ width: `${40 + Math.random() * 30}%` }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          icon={MessageSquare}
          title="Noch keine Nachrichten"
          description="Senden Sie eine Nachricht an Ihre Kanzlei."
        />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
      {/* Load older button */}
      {nextCursor && (
        <div className="flex justify-center pb-3">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="text-xs text-violet-500 hover:text-violet-400 transition-colors disabled:opacity-50"
          >
            {loadingMore ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Laden...
              </span>
            ) : (
              "Aeltere Nachrichten laden"
            )}
          </button>
        </div>
      )}

      {messages.map((msg, idx) => {
        const prev = idx > 0 ? messages[idx - 1] : null;
        const showAuthor = !prev || !shouldGroup(prev, msg);

        return (
          <PortalMessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.authorId === currentUserId}
            showHeader={showAuthor}
            akteId={akteId}
          />
        );
      })}
    </div>
  );
}
