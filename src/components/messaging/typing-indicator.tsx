"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSocket } from "@/components/socket-provider";
import type { TypingPayload } from "@/lib/messaging/types";

interface TypingIndicatorProps {
  channelId: string;
  currentUserId: string;
}

interface TypingUser {
  name: string;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Ephemeral typing indicator showing who is currently typing in a channel.
 *
 * - Listens for typing:start / typing:stop Socket.IO events
 * - Auto-cleans stale typers after 5 seconds
 * - Fixed height (h-5) to prevent layout shift
 */
export function TypingIndicator({ channelId, currentUserId }: TypingIndicatorProps) {
  const { socket } = useSocket();
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  const channelIdRef = useRef(channelId);

  // Keep channelId ref in sync
  useEffect(() => {
    channelIdRef.current = channelId;
  }, [channelId]);

  // Clear all timeouts and reset on channel change
  useEffect(() => {
    setTypingUsers((prev) => {
      prev.forEach((user) => clearTimeout(user.timeout));
      return new Map();
    });
  }, [channelId]);

  const removeTyper = useCallback((userId: string) => {
    setTypingUsers((prev) => {
      const next = new Map(prev);
      const existing = next.get(userId);
      if (existing) {
        clearTimeout(existing.timeout);
        next.delete(userId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!socket) return;

    function handleTypingStart(data: TypingPayload) {
      if (data.channelId !== channelIdRef.current) return;
      if (data.userId === currentUserId) return;

      setTypingUsers((prev) => {
        const next = new Map(prev);
        // Clear existing timeout for this user
        const existing = next.get(data.userId);
        if (existing) {
          clearTimeout(existing.timeout);
        }
        // Set auto-cleanup after 5 seconds
        const timeout = setTimeout(() => {
          removeTyper(data.userId);
        }, 5000);
        next.set(data.userId, { name: data.userName, timeout });
        return next;
      });
    }

    function handleTypingStop(data: { channelId: string; userId: string }) {
      if (data.channelId !== channelIdRef.current) return;
      removeTyper(data.userId);
    }

    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    return () => {
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
    };
  }, [socket, currentUserId, removeTyper]);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      setTypingUsers((prev) => {
        prev.forEach((user) => clearTimeout(user.timeout));
        return new Map();
      });
    };
  }, []);

  const names = Array.from(typingUsers.values()).map((u) => u.name);

  let text = "";
  if (names.length === 1) {
    text = `${names[0]} tippt...`;
  } else if (names.length === 2) {
    text = `${names[0]} und ${names[1]} tippen...`;
  } else if (names.length >= 3) {
    text = "Mehrere Personen tippen...";
  }

  return (
    <div className="h-5 px-4 flex items-center">
      {text && (
        <span className="text-xs text-muted-foreground italic">{text}</span>
      )}
    </div>
  );
}
