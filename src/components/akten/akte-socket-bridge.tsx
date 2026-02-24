"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/components/socket-provider";
import { toast } from "sonner";

interface AkteSocketBridgeProps {
  akteId: string;
}

/**
 * Invisible bridge component that manages Socket.IO akte room membership
 * and global OCR toast notifications.
 *
 * - Joins akte:{akteId} room on mount, leaves on unmount
 * - Listens for document:ocr-complete events globally for toast notifications
 */
export function AkteSocketBridge({ akteId }: AkteSocketBridgeProps) {
  const { socket, isConnected } = useSocket();
  const router = useRouter();

  // Join/leave akte room for real-time document updates
  // Follows the exact pattern from inbox-layout.tsx mailbox room join/leave
  useEffect(() => {
    if (!socket || !isConnected || !akteId) return;

    socket.emit("join:akte", akteId);

    return () => {
      socket.emit("leave:akte", akteId);
    };
  }, [socket, isConnected, akteId]);

  // Listen for OCR completion/failure events globally (separate useEffect)
  useEffect(() => {
    if (!socket) return;

    const handleOcrComplete = (data: {
      dokumentId: string;
      akteId: string;
      fileName: string;
      status: string;
      error?: string;
    }) => {
      if (data.status === "ABGESCHLOSSEN") {
        toast.success(`OCR abgeschlossen: ${data.fileName}`, {
          action: {
            label: "Anzeigen",
            onClick: () =>
              router.push(
                `/akten/${data.akteId}/dokumente/${data.dokumentId}`
              ),
          },
        });
      } else if (data.status === "FEHLGESCHLAGEN") {
        toast.error(`OCR fehlgeschlagen: ${data.fileName}`, {
          action: {
            label: "Wiederholen",
            onClick: () =>
              fetch(`/api/dokumente/${data.dokumentId}/ocr`, {
                method: "POST",
              }),
          },
        });
      }
    };

    socket.on("document:ocr-complete", handleOcrComplete);
    return () => {
      socket.off("document:ocr-complete", handleOcrComplete);
    };
  }, [socket, router]);

  return null;
}
