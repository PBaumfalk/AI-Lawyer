"use client";

import { useRef, useEffect } from "react";
import type { MessageListItem } from "@/lib/messaging/types";
import { MessageBubble } from "./message-bubble";

interface MessageListProps {
  messages: MessageListItem[];
  loading: boolean;
  currentUserId: string;
  onLoadMore: () => void;
  hasMore: boolean;
  onReaction: (messageId: string, emoji: string) => void;
  scrollToBottomTrigger: number;
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

export function MessageList({
  messages,
  loading,
  currentUserId,
  onLoadMore,
  hasMore,
  onReaction,
  scrollToBottomTrigger,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on initial load and when trigger changes
  useEffect(() => {
    if (scrollRef.current && scrollToBottomTrigger > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [scrollToBottomTrigger]);

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
        <p className="text-sm text-muted-foreground">
          Noch keine Nachrichten
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
      {/* Load older button */}
      {hasMore && (
        <div className="flex justify-center pb-3">
          <button
            type="button"
            onClick={onLoadMore}
            className="text-xs text-violet-500 hover:text-violet-400 transition-colors"
          >
            Aeltere laden
          </button>
        </div>
      )}

      {messages.map((msg, idx) => {
        const prev = idx > 0 ? messages[idx - 1] : null;
        const showAuthor = !prev || !shouldGroup(prev, msg);

        return (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwnMessage={msg.authorId === currentUserId}
            showAuthor={showAuthor}
            currentUserId={currentUserId}
            onReaction={onReaction}
          />
        );
      })}
    </div>
  );
}
