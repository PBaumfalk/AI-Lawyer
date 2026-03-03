"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { MessageSquare, Loader2, RefreshCw } from "lucide-react";
import { PortalMessageList } from "./portal-message-list";
import { PortalMessageComposer } from "./portal-message-composer";

interface PortalMessagingProps {
  akteId: string;
}

interface PortalChannel {
  id: string;
  name: string;
  typ: string;
}

export function PortalMessaging({ akteId }: PortalMessagingProps) {
  const { data: session } = useSession();
  const [channel, setChannel] = useState<PortalChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const currentUserId = session?.user?.id ?? "";

  // Fetch or create the PORTAL channel
  const fetchChannel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/akten/${akteId}/channel`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Laden des Nachrichtenkanals");
      }
      const data = await res.json();
      setChannel(data.channel);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Fehler beim Laden des Nachrichtenkanals"
      );
    } finally {
      setLoading(false);
    }
  }, [akteId]);

  useEffect(() => {
    fetchChannel();
  }, [fetchChannel]);

  // Trigger message list refetch after sending
  const handleMessageSent = useCallback(() => {
    // Access the refetch function stored by PortalMessageList on the DOM
    const el = listContainerRef.current;
    if (el && (el as any).__portalMessageRefetch) {
      (el as any).__portalMessageRefetch();
    }
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 glass-card rounded-2xl flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nachrichten werden geladen...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 glass-card rounded-2xl flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <MessageSquare className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          <button
            type="button"
            onClick={fetchChannel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-white/10 hover:bg-white/20 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-white/10 dark:border-white/[0.06] rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  if (!channel) return null;

  return (
    <div className="flex-1 glass-card rounded-2xl flex flex-col overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 dark:border-white/[0.06]">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          Nachrichten an Ihre Kanzlei
        </h2>
      </div>

      {/* Message list */}
      <div ref={listContainerRef} className="flex-1 flex flex-col overflow-hidden">
        <PortalMessageList
          akteId={akteId}
          channelId={channel.id}
          currentUserId={currentUserId}
        />
      </div>

      {/* Composer */}
      <PortalMessageComposer
        akteId={akteId}
        channelId={channel.id}
        onMessageSent={handleMessageSent}
      />
    </div>
  );
}
