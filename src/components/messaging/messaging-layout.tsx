"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChannelListItem } from "@/lib/messaging/types";
import { ChannelSidebar } from "./channel-sidebar";
import { MessageView } from "./message-view";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-media-query";

export function MessagingLayout() {
  const [channels, setChannels] = useState<ChannelListItem[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  // Below md only one pane is shown: the channel list or the conversation
  const isMobile = useIsMobile();
  const [mobileShowList, setMobileShowList] = useState(true);
  const handleSelectChannel = useCallback((id: string) => {
    setSelectedChannelId(id);
    setMobileShowList(false);
  }, []);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/channels");
      if (!res.ok) return;
      const data = await res.json();
      setChannels(data.channels ?? []);
    } catch {
      // Silently fail -- user will see empty list
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Auto-select first channel when channels load and none is selected
  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  const handleChannelsChange = useCallback(
    (updated: ChannelListItem[]) => {
      setChannels(updated);
    },
    []
  );

  const handleMessageSent = useCallback(() => {
    // Refetch channels to update lastMessageAt ordering and unread counts
    fetchChannels();
  }, [fetchChannels]);

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  if (isMobile) {
    return (
      <div className="flex flex-col gap-3 h-[calc(100vh-120px)]">
        {mobileShowList || !selectedChannelId ? (
          <ChannelSidebar
            channels={channels}
            selectedId={selectedChannelId}
            onSelect={handleSelectChannel}
            onChannelsChange={handleChannelsChange}
            loading={loading}
            refetchChannels={fetchChannels}
            className="w-full flex-1"
          />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMobileShowList(true)}
              className="flex min-h-11 items-center gap-2 self-start rounded-xl px-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Kanäle
              {selectedChannel && (
                <span className="truncate text-muted-foreground font-normal">
                  · {selectedChannel.name}
                </span>
              )}
            </button>
            <MessageView
              channelId={selectedChannelId}
              onMessageSent={handleMessageSent}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-140px)]">
      {/* Left: Channel sidebar */}
      <ChannelSidebar
        channels={channels}
        selectedId={selectedChannelId}
        onSelect={handleSelectChannel}
        onChannelsChange={handleChannelsChange}
        loading={loading}
        refetchChannels={fetchChannels}
      />

      {/* Right: Message view or empty state */}
      {selectedChannelId ? (
        <MessageView
          channelId={selectedChannelId}
          onMessageSent={handleMessageSent}
        />
      ) : (
        <div className="flex-1 glass-card rounded-2xl flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Kanal auswählen</p>
          </div>
        </div>
      )}
    </div>
  );
}
