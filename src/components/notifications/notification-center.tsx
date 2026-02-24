"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import {
  CheckCircle2,
  XCircle,
  FileText,
  FilePenLine,
  Mail,
  Clock,
  AlertTriangle,
  X,
  RefreshCw,
  CheckCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/components/notifications/notification-provider";
import type { NotificationResponse, NotificationType } from "@/lib/notifications/types";

/** Map notification types to lucide-react icons */
const typeIcons: Record<NotificationType, React.ElementType> = {
  "job:completed": CheckCircle2,
  "job:failed": XCircle,
  "document:created": FileText,
  "document:updated": FilePenLine,
  "email:received": Mail,
  "deadline:approaching": Clock,
  "system:alert": AlertTriangle,
};

/** Map notification types to icon colors */
const typeColors: Record<NotificationType, string> = {
  "job:completed": "text-emerald-500",
  "job:failed": "text-rose-500",
  "document:created": "text-blue-500",
  "document:updated": "text-blue-400",
  "email:received": "text-amber-500",
  "deadline:approaching": "text-orange-500",
  "system:alert": "text-rose-600",
};

/**
 * Notification center dropdown showing the last 50 notifications.
 *
 * Features:
 * - Icon per notification type
 * - Bold title for unread notifications
 * - Relative time via date-fns (German locale)
 * - Navigate to link on click, mark as read
 * - Dismiss button (X icon)
 * - Retry button for job:failed notifications
 * - "Alle gelesen" bulk action
 * - Empty state message
 */
export function NotificationCenter() {
  const router = useRouter();
  const { notifications, markAsRead, markAllAsRead, dismiss } =
    useNotifications();

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold">Benachrichtigungen</h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 px-2"
          onClick={markAllAsRead}
        >
          <CheckCheck className="w-3.5 h-3.5 mr-1" />
          Alle gelesen
        </Button>
      </div>

      <Separator />

      {/* Notification list */}
      <ScrollArea className="max-h-[400px]">
        {notifications.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Keine neuen Benachrichtigungen
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={() => markAsRead(notification.id)}
                onDismiss={() => dismiss(notification.id)}
                onNavigate={(link) => {
                  markAsRead(notification.id);
                  router.push(link);
                }}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/** Individual notification row */
function NotificationItem({
  notification,
  onRead,
  onDismiss,
  onNavigate,
}: {
  notification: NotificationResponse;
  onRead: () => void;
  onDismiss: () => void;
  onNavigate: (link: string) => void;
}) {
  const [retrying, setRetrying] = useState(false);

  const Icon = typeIcons[notification.type] || AlertTriangle;
  const iconColor = typeColors[notification.type] || "text-muted-foreground";
  const link = notification.data?.link as string | undefined;
  const isJobFailed = notification.type === "job:failed";
  const jobId = notification.data?.jobId as string | undefined;

  const handleClick = () => {
    if (link) {
      onNavigate(link);
    } else if (!notification.read) {
      onRead();
    }
  };

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!jobId || retrying) return;

    setRetrying(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
      if (res.ok) {
        toast.success("Job wird erneut verarbeitet");
        onDismiss();
      } else {
        toast.error("Wiederholung fehlgeschlagen");
      }
    } catch {
      toast.error("Wiederholung fehlgeschlagen");
    } finally {
      setRetrying(false);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss();
  };

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: de,
  });

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group",
        !notification.read && "bg-muted/30"
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleClick();
      }}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <Icon className={cn("w-4.5 h-4.5", iconColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm leading-snug",
            !notification.read ? "font-semibold" : "font-normal"
          )}
        >
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-muted-foreground/70">
            {timeAgo}
          </span>
          {isJobFailed && jobId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[11px] text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying ? (
                <Loader2 className="w-3 h-3 mr-0.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-0.5" />
              )}
              Erneut versuchen
            </Button>
          )}
        </div>
      </div>

      {/* Dismiss button */}
      <button
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
        onClick={handleDismiss}
        aria-label="Benachrichtigung verwerfen"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
      </button>
    </div>
  );
}
