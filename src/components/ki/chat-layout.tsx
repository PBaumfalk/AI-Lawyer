"use client";

import { useState, useEffect, useCallback } from "react";
import { ConversationSidebar } from "@/components/ki/conversation-sidebar";
import { ChatMessages } from "@/components/ki/chat-messages";
import { ChatInput } from "@/components/ki/chat-input";
import { PanelLeftClose, PanelLeft, Plus } from "lucide-react";

interface ChatLayoutProps {
  initialAkteId?: string;
  initialQuery?: string;
  initialConversationId?: string;
}

interface AkteOption {
  id: string;
  aktenzeichen: string;
  kurzrubrum: string;
}

export function ChatLayout({
  initialAkteId,
  initialQuery,
  initialConversationId,
}: ChatLayoutProps) {
  const [selectedAkteId, setSelectedAkteId] = useState<string | null>(
    initialAkteId ?? null
  );
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(initialConversationId ?? null);
  const [crossAkte, setCrossAkte] = useState(!initialAkteId);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [akten, setAkten] = useState<AkteOption[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch available Akten for the selector
  useEffect(() => {
    fetch("/api/akten?take=200")
      .then((r) => r.json())
      .then((data) => {
        setAkten(data.akten ?? []);
      })
      .catch(() => {});
  }, []);

  // Handle Akte selection
  const handleAkteChange = useCallback((akteId: string | null) => {
    if (akteId === "__all__") {
      setSelectedAkteId(null);
      setCrossAkte(true);
    } else {
      setSelectedAkteId(akteId);
      setCrossAkte(false);
    }
  }, []);

  // Start a new chat
  const handleNewChat = useCallback(() => {
    setSelectedConversationId(null);
    setRefreshKey((k) => k + 1);
  }, []);

  // Conversation selected from sidebar
  const handleSelectConversation = useCallback(
    (convId: string, akteId: string | null) => {
      setSelectedConversationId(convId);
      if (akteId) {
        setSelectedAkteId(akteId);
        setCrossAkte(false);
      }
    },
    []
  );

  // Refresh conversation list after a message is sent
  const handleMessageSent = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Conversation sidebar */}
      {sidebarOpen && (
        <div className="w-[280px] flex-shrink-0 border-r border-white/10 dark:border-white/[0.06] flex flex-col bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center justify-between px-3 py-3 border-b border-white/10 dark:border-white/[0.06]">
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Neuer Chat
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-muted-foreground"
              title="Sidebar ausblenden"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
          <ConversationSidebar
            selectedConversationId={selectedConversationId}
            akteIdFilter={crossAkte ? null : selectedAkteId}
            onSelectConversation={handleSelectConversation}
            refreshKey={refreshKey}
          />
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar: Akte selector */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 dark:border-white/[0.06]">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-muted-foreground"
              title="Sidebar anzeigen"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}

          <label className="text-xs text-muted-foreground font-medium">
            Akte:
          </label>
          <select
            value={crossAkte ? "__all__" : selectedAkteId ?? ""}
            onChange={(e) => handleAkteChange(e.target.value || null)}
            className="text-sm bg-transparent border border-white/20 dark:border-white/10 rounded-md px-2 py-1 text-foreground max-w-[300px] truncate focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="__all__">Alle Akten</option>
            {akten.map((a) => (
              <option key={a.id} value={a.id}>
                {a.aktenzeichen} - {a.kurzrubrum}
              </option>
            ))}
          </select>

          <span className="text-[10px] text-muted-foreground ml-1">
            {crossAkte
              ? "Suche in allen zugewiesenen Akten"
              : "Suche in ausgewaehlter Akte"}
          </span>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-hidden">
          <ChatMessages
            key={`${selectedConversationId ?? "new"}-${refreshKey}`}
            akteId={selectedAkteId}
            conversationId={selectedConversationId}
            crossAkte={crossAkte}
            initialQuery={initialQuery}
            onConversationCreated={handleMessageSent}
          />
        </div>

        {/* Input area */}
        <ChatInput
          akteId={selectedAkteId}
          conversationId={selectedConversationId}
          crossAkte={crossAkte}
          onMessageSent={handleMessageSent}
        />
      </div>
    </div>
  );
}
