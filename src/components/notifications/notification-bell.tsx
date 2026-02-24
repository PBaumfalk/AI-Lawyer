"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications } from "@/components/notifications/notification-provider";
import { NotificationCenter } from "@/components/notifications/notification-center";

/**
 * Header bell icon with unread notification count badge.
 * Click opens the notification center dropdown via Popover.
 */
export function NotificationBell() {
  const { unreadCount } = useNotifications();

  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-white/20 dark:hover:bg-white/[0.08]"
          aria-label={`Benachrichtigungen${unreadCount > 0 ? ` (${unreadCount} ungelesen)` : ""}`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 shadow-sm">
              {displayCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] p-0"
      >
        <NotificationCenter />
      </PopoverContent>
    </Popover>
  );
}
