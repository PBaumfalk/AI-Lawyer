"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { ArrowDown } from "lucide-react";
import type { MessageListItem } from "@/lib/messaging/types";
import type {
  MessageNewPayload,
  MessageEditedPayload,
  MessageDeletedPayload,
} from "@/lib/messaging/types";
import { useSocket } from "@/components/socket-provider";
import { MessageList } from "./message-list";
import { MessageComposer } from "./message-composer";
import { MessagingSocketBridge } from "./messaging-socket-bridge";
import { TypingIndicator } from "./typing-indicator";

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
  const { socket } = useSocket();
  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [scrollToBottomTrigger, setScrollToBottomTrigger] = useState(0);

  const currentUserId = session?.user?.id ?? "";

  // Ref to avoid stale closures in Socket.IO callbacks
  const channelIdRef = useRef(channelId);
  useEffect(() => {
    channelIdRef.current = channelId;
  }, [channelId]);

  // Typing debounce ref
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ─── Socket.IO real-time event listeners ──────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    function handleMessageNew(data: MessageNewPayload) {
      if (data.channelId !== channelIdRef.current) return;
      // Banner refetch pattern: do NOT auto-insert
      // If it's our own message, we already refetch via handleSent
      if (data.authorId !== currentUserId) {
        setHasNewMessages(true);
      }
    }

    function handleMessageEdited(data: MessageEditedPayload) {
      if (data.channelId !== channelIdRef.current) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.id
            ? { ...msg, body: data.body, editedAt: data.editedAt }
            : msg
        )
      );
    }

    function handleMessageDeleted(data: MessageDeletedPayload) {
      if (data.channelId !== channelIdRef.current) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.id
            ? { ...msg, deletedAt: new Date().toISOString() }
            : msg
        )
      );
    }

    socket.on("message:new", handleMessageNew);
    socket.on("message:edited", handleMessageEdited);
    socket.on("message:deleted", handleMessageDeleted);

    return () => {
      socket.off("message:new", handleMessageNew);
      socket.off("message:edited", handleMessageEdited);
      socket.off("message:deleted", handleMessageDeleted);
    };
  }, [socket, currentUserId]);

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

  // Typing emission handler -- passed to MessageComposer
  const handleTyping = useCallback(() => {
    if (!socket) return;

    // Emit typing:start
    socket.emit("typing:start", channelIdRef.current);

    // Clear existing debounce timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set a 3s timeout to emit typing:stop when typing pauses
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing:stop", channelIdRef.current);
      typingTimeoutRef.current = null;
    }, 3000);
  }, [socket]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex-1 glass-card rounded-2xl flex flex-col overflow-hidden">
      {/* Invisible socket bridge for channel room management */}
      <MessagingSocketBridge channelId={channelId} />

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

      {/* Typing indicator */}
      <TypingIndicator channelId={channelId} currentUserId={currentUserId} />

      {/* Composer */}
      <MessageComposer
        channelId={channelId}
        members={members}
        onSent={handleSent}
        onTyping={handleTyping}
      />
    </div>
  );
}
