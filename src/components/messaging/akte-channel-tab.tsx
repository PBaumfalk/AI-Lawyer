"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, UserCircle, ArrowLeft } from "lucide-react";
import { MessageView } from "@/components/messaging/message-view";
import { Badge } from "@/components/ui/badge";
import type { ChannelListItem } from "@/lib/messaging/types";

interface AkteChannelTabProps {
  akteId: string;
}

/**
 * Akte Nachrichten tab content.
 *
 * Lazy-loads the AKTE channel on tab activation via GET /api/akten/[id]/channel.
 * The API creates the channel on first access if it does not exist.
 * Once channelId is available, renders the full MessageView component.
 */
export function AkteChannelTab({ akteId }: AkteChannelTabProps) {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChannel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/akten/${akteId}/channel`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Laden des Kanals");
      }
      const data = await res.json();
      setChannelId(data.channel?.id ?? null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Kanal konnte nicht geladen werden"
      );
    } finally {
      setLoading(false);
    }
  }, [akteId]);

  useEffect(() => {
    fetchChannel();
  }, [fetchChannel]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !channelId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-sm text-muted-foreground">
          {error ?? "Kanal konnte nicht geladen werden"}
        </p>
        <button
          type="button"
          onClick={fetchChannel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-500 hover:text-violet-400 bg-violet-500/10 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="h-[600px] flex flex-col">
      <MessageView channelId={channelId} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PortalChannelTab -- shows PORTAL channels for an Akte (Anwalt-side)
// ---------------------------------------------------------------------------

interface PortalChannelTabProps {
  akteId: string;
}

/**
 * Portal-Nachrichten section for Akte-Detail.
 *
 * Fetches PORTAL channels for this Akte via GET /api/akten/[id]/portal-channels.
 * If single Mandant, directly shows MessageView.
 * If multiple Mandanten, shows a list to select from.
 */
export function PortalChannelTab({ akteId }: PortalChannelTabProps) {
  const [channels, setChannels] = useState<ChannelListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/akten/${akteId}/portal-channels`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Laden der Portal-Kanaele");
      }
      const data = await res.json();
      setChannels(data.channels ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Portal-Kanaele konnten nicht geladen werden"
      );
    } finally {
      setLoading(false);
    }
  }, [akteId]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Auto-select if only one channel
  useEffect(() => {
    if (channels.length === 1 && !selectedChannelId) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={fetchChannels}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-500 hover:text-violet-400 bg-violet-500/10 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <UserCircle className="w-8 h-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Noch keine Portal-Nachrichten
        </p>
        <p className="text-xs text-muted-foreground/60">
          Mandanten koennen ueber das Portal Nachrichten senden.
        </p>
      </div>
    );
  }

  // If a channel is selected, show the MessageView with a back button (for multi-channel)
  if (selectedChannelId) {
    return (
      <div className="h-[600px] flex flex-col">
        {channels.length > 1 && (
          <button
            type="button"
            onClick={() => setSelectedChannelId(null)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Zurueck zur Uebersicht
          </button>
        )}
        <MessageView channelId={selectedChannelId} />
      </div>
    );
  }

  // Multiple channels: show list
  return (
    <div className="space-y-2 py-4">
      <p className="text-xs text-muted-foreground px-1 mb-3">
        {channels.length} Mandant{channels.length !== 1 ? "en" : ""} mit Portal-Nachrichten
      </p>
      {channels.map((ch) => (
        <button
          key={ch.id}
          type="button"
          onClick={() => setSelectedChannelId(ch.id)}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 dark:hover:bg-white/[0.03] transition-colors text-left"
        >
          <UserCircle className="w-5 h-5 text-violet-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {ch.mandantUserName || ch.name}
            </p>
            {ch.lastMessageAt && (
              <p className="text-xs text-muted-foreground/60">
                Letzte Nachricht: {new Date(ch.lastMessageAt).toLocaleDateString("de-DE")}
              </p>
            )}
          </div>
          {ch.unreadCount > 0 && (
            <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 border-0">
              {ch.unreadCount}
            </Badge>
          )}
        </button>
      ))}
    </div>
  );
}
