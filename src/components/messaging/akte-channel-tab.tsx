"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { MessageView } from "@/components/messaging/message-view";

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
