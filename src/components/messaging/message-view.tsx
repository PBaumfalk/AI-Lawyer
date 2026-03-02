"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ArrowDown } from "lucide-react";
import type { MessageListItem } from "@/lib/messaging/types";
import { MessageList } from "./message-list";
import { MessageComposer } from "./message-composer";

interface MessageViewProps {
  channelId: string;
  onMessageSent?: () => void;
}

interface ChannelMember {
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
}

export function MessageView({ channelId, onMessageSent }: MessageViewProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [scrollToBottomTrigger, setScrollToBottomTrigger] = useState(0);

  const currentUserId = session?.user?.id ?? "";

  // Fetch messages for the current channel
  const fetchMessages = useCallback(
    async (cursor?: string) => {
      try {
        const url = cursor
          ? `/api/channels/${channelId}/messages?cursor=${cursor}&limit=50`
          : `/api/channels/${channelId}/messages?limit=50`;
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
          setScrollToBottomTrigger((c) => c + 1);
        }
        setNextCursor(data.nextCursor ?? null);
      } catch {
        // Silently fail
      }
    },
    [channelId]
  );

  // Fetch members for @mention picker
  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/channels/${channelId}/members`);
      if (!res.ok) return;
      const data = await res.json();
      setMembers(
        (data.members ?? []).map((m: ChannelMember) => ({
          userId: m.userId,
          userName: m.userName,
          userAvatarUrl: m.userAvatarUrl,
        }))
      );
    } catch {
      // Silently fail
    }
  }, [channelId]);

  // Mark channel as read (fire-and-forget)
  const markAsRead = useCallback(() => {
    fetch(`/api/channels/${channelId}/read`, { method: "PATCH" }).catch(
      () => {}
    );
  }, [channelId]);

  // On channel change: refetch messages + members
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setNextCursor(null);
    setHasNewMessages(false);

    Promise.all([fetchMessages(), fetchMembers()]).finally(() => {
      setLoading(false);
      markAsRead();
    });
  }, [channelId, fetchMessages, fetchMembers, markAsRead]);

  // Load older messages
  const handleLoadMore = useCallback(() => {
    if (nextCursor) {
      fetchMessages(nextCursor);
    }
  }, [nextCursor, fetchMessages]);

  // Handle new messages banner refetch
  const handleBannerRefetch = useCallback(async () => {
    setHasNewMessages(false);
    await fetchMessages();
    markAsRead();
  }, [fetchMessages, markAsRead]);

  // Handle message sent
  const handleSent = useCallback(() => {
    // Refetch messages to show the new one
    fetchMessages();
    markAsRead();
    onMessageSent?.();
  }, [fetchMessages, markAsRead, onMessageSent]);

  // Handle reaction toggle
  const handleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;

      const existingReaction = msg.reactions.find((r) => r.emoji === emoji);
      const userAlreadyReacted = existingReaction?.userIds.includes(currentUserId);

      try {
        if (userAlreadyReacted) {
          // Remove reaction
          await fetch(`/api/channels/${channelId}/reactions`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId, emoji }),
          });
        } else {
          // Add reaction
          await fetch(`/api/channels/${channelId}/reactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId, emoji }),
          });
        }

        // Refetch messages to get updated reactions
        await fetchMessages();
      } catch {
        // Silently fail
      }
    },
    [messages, currentUserId, channelId, fetchMessages]
  );

  return (
    <div className="flex-1 glass-card rounded-2xl flex flex-col overflow-hidden">
      {/* Message list */}
      <MessageList
        messages={messages}
        loading={loading}
        currentUserId={currentUserId}
        onLoadMore={handleLoadMore}
        hasMore={!!nextCursor}
        onReaction={handleReaction}
        scrollToBottomTrigger={scrollToBottomTrigger}
      />

      {/* New messages banner */}
      {hasNewMessages && (
        <div className="px-4 py-1">
          <button
            type="button"
            onClick={handleBannerRefetch}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-violet-500 hover:text-violet-400 bg-violet-500/10 rounded-lg transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            Neue Nachrichten
          </button>
        </div>
      )}

      {/* Composer */}
      <MessageComposer
        channelId={channelId}
        members={members}
        onSent={handleSent}
      />
    </div>
  );
}
