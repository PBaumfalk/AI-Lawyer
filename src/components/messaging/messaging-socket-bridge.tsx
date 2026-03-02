"use client";

import { useEffect } from "react";
import { useSocket } from "@/components/socket-provider";

interface MessagingSocketBridgeProps {
  channelId: string;
}

/**
 * Invisible bridge component that manages Socket.IO channel room membership.
 *
 * - Joins channel:{channelId} room on mount, leaves on unmount/channel switch
 * - Follows the exact AkteSocketBridge pattern
 */
export function MessagingSocketBridge({ channelId }: MessagingSocketBridgeProps) {
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected || !channelId) return;

    socket.emit("join:channel", channelId);

    return () => {
      socket.emit("leave:channel", channelId);
    };
  }, [socket, isConnected, channelId]);

  return null;
}
