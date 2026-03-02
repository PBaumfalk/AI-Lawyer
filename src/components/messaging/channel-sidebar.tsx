"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { ChannelListItem } from "@/lib/messaging/types";
import { ChannelListItemComponent } from "./channel-list-item";
import { CreateChannelDialog } from "./create-channel-dialog";

interface ChannelSidebarProps {
  channels: ChannelListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChannelsChange: (channels: ChannelListItem[]) => void;
  loading: boolean;
  refetchChannels: () => Promise<void>;
}

export function ChannelSidebar({
  channels,
  selectedId,
  onSelect,
  onChannelsChange,
  loading,
  refetchChannels,
}: ChannelSidebarProps) {
  const [allgemeinExpanded, setAllgemeinExpanded] = useState(true);
  const [aktenExpanded, setAktenExpanded] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Split channels by type
  const allgemeinChannels = channels
    .filter((ch) => ch.typ === "ALLGEMEIN")
    .sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt)
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return a.name.localeCompare(b.name);
    });

  const akteChannels = channels
    .filter((ch) => ch.typ === "AKTE")
    .sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt)
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return a.name.localeCompare(b.name);
    });

  const handleChannelCreated = async (newChannel: {
    id: string;
    name: string;
    slug: string;
  }) => {
    // Refetch the full channel list to get proper ChannelListItem shape
    await refetchChannels();
    // Select the newly created channel
    onSelect(newChannel.id);
  };

  return (
    <div className="glass-panel rounded-2xl w-60 flex-shrink-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b border-white/10 dark:border-white/[0.06]">
        <h2 className="text-sm font-semibold text-foreground">Kanaele</h2>
      </div>

      {/* Scrollable channel list */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="px-3 py-4 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-8 rounded-lg bg-white/5 dark:bg-white/[0.03] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {/* ALLGEMEIN section */}
            <div>
              <button
                type="button"
                onClick={() => setAllgemeinExpanded(!allgemeinExpanded)}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
              >
                {allgemeinExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                Allgemein
                <span className="ml-auto text-muted-foreground/60">
                  {allgemeinChannels.length}
                </span>
              </button>
              {allgemeinExpanded && (
                <div className="px-1">
                  {allgemeinChannels.map((ch) => (
                    <ChannelListItemComponent
                      key={ch.id}
                      channel={ch}
                      isSelected={ch.id === selectedId}
                      onSelect={() => onSelect(ch.id)}
                    />
                  ))}
                  {allgemeinChannels.length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground/60">
                      Keine Kanaele
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* AKTEN section */}
            {akteChannels.length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setAktenExpanded(!aktenExpanded)}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                >
                  {aktenExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  Akten
                  <span className="ml-auto text-muted-foreground/60">
                    {akteChannels.length}
                  </span>
                </button>
                {aktenExpanded && (
                  <div className="px-1">
                    {akteChannels.map((ch) => (
                      <ChannelListItemComponent
                        key={ch.id}
                        channel={ch}
                        isSelected={ch.id === selectedId}
                        onSelect={() => onSelect(ch.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer: New channel button */}
      <div className="px-3 py-2 border-t border-white/10 dark:border-white/[0.06]">
        <button
          type="button"
          onClick={() => setCreateDialogOpen(true)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 dark:hover:bg-white/[0.03] rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Neuer Kanal
        </button>
      </div>

      <CreateChannelDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleChannelCreated}
      />
    </div>
  );
}
