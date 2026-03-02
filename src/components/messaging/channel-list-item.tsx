"use client";

import { Hash, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ChannelListItem } from "@/lib/messaging/types";

interface ChannelListItemProps {
  channel: ChannelListItem;
  isSelected: boolean;
  onSelect: () => void;
}

export function ChannelListItemComponent({
  channel,
  isSelected,
  onSelect,
}: ChannelListItemProps) {
  const Icon = channel.typ === "ALLGEMEIN" ? Hash : FolderOpen;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
        isSelected
          ? "bg-[oklch(45%_0.2_260/0.15)] border-l-2 border-violet-500"
          : "hover:bg-white/5 dark:hover:bg-white/[0.03]"
      }`}
    >
      <Icon
        className={`w-3.5 h-3.5 flex-shrink-0 ${
          isSelected ? "text-violet-400" : "text-muted-foreground"
        }`}
      />
      <span
        className={`flex-1 text-sm truncate ${
          isSelected ? "text-foreground font-medium" : "text-muted-foreground"
        }`}
      >
        {channel.name}
      </span>
      {channel.unreadCount > 0 && (
        <Badge
          className="h-5 min-w-[20px] px-1.5 text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 border-0"
        >
          {channel.unreadCount}
        </Badge>
      )}
    </button>
  );
}
