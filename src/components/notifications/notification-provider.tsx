"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSocket } from "@/components/socket-provider";
import type { NotificationResponse } from "@/lib/notifications/types";

interface NotificationContextValue {
  notifications: NotificationResponse[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismiss: (notificationId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  dismiss: async () => {},
});

/**
 * Manages notification state: fetches initial data, handles real-time events,
 * and provides CRUD actions to child components.
 *
 * Features:
 * - Fetches unread notifications on mount
 * - Listens for real-time "notification" events via Socket.IO
 * - Shows sonner toast for new notifications (with optional navigation)
 * - Shows browser push notifications when tab is backgrounded
 * - Catches up on missed notifications after reconnect
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastSeenRef = useRef<string | null>(null);
  const wasDisconnectedRef = useRef(false);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);

      // Track latest notification time for catch-up
      if (data.notifications.length > 0) {
        lastSeenRef.current = data.notifications[0].createdAt;
      }
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, []);

  // Fetch missed notifications after reconnect
  const fetchMissed = useCallback(async () => {
    if (!lastSeenRef.current) return;

    try {
      const res = await fetch(
        `/api/notifications?since=${encodeURIComponent(lastSeenRef.current)}`
      );
      if (!res.ok) return;
      const data = await res.json();

      if (data.notifications.length > 0) {
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const newNotifs = data.notifications.filter(
            (n: NotificationResponse) => !existingIds.has(n.id)
          );
          return [...newNotifs, ...prev].slice(0, 50);
        });
        setUnreadCount(data.unreadCount);
        lastSeenRef.current = data.notifications[0].createdAt;
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Request browser notification permission on first render
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // Handle real-time notifications from Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notification: NotificationResponse) => {
      // Add to local state (prepend, cap at 50)
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      setUnreadCount((prev) => prev + 1);

      // Update last seen timestamp
      lastSeenRef.current = notification.createdAt;

      // Show sonner toast
      const link = notification.data?.link as string | undefined;
      toast(notification.title, {
        description: notification.message,
        action: link
          ? {
              label: "Anzeigen",
              onClick: () => router.push(link),
            }
          : undefined,
      });

      // Show browser notification when tab is backgrounded
      if (
        typeof document !== "undefined" &&
        document.hidden &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification(notification.title, {
          body: notification.message,
          tag: notification.id, // Prevent duplicates
        });
      }
    };

    socket.on("notification", handleNotification);

    return () => {
      socket.off("notification", handleNotification);
    };
  }, [socket, router]);

  // Handle reconnect catch-up
  useEffect(() => {
    if (!isConnected && socket) {
      wasDisconnectedRef.current = true;
    }

    if (isConnected && wasDisconnectedRef.current) {
      wasDisconnectedRef.current = false;
      fetchMissed();
    }
  }, [isConnected, socket, fetchMissed]);

  // CRUD actions
  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      try {
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "read", notificationId }),
        });
        if (!res.ok) return;
        const data = await res.json();

        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount(data.unreadCount);
      } catch {
        // Silently fail
      }
    },
    []
  );

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "readAll" }),
      });
      if (!res.ok) return;
      const data = await res.json();

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(data.unreadCount);
    } catch {
      // Silently fail
    }
  }, []);

  const handleDismiss = useCallback(async (notificationId: string) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", notificationId }),
      });
      if (!res.ok) return;
      const data = await res.json();

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setUnreadCount(data.unreadCount);
    } catch {
      // Silently fail
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead: handleMarkAsRead,
        markAllAsRead: handleMarkAllAsRead,
        dismiss: handleDismiss,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Hook to access notification state and actions.
 *
 * Returns: `{ notifications, unreadCount, markAsRead, markAllAsRead, dismiss }`
 */
export function useNotifications(): NotificationContextValue {
  return useContext(NotificationContext);
}
