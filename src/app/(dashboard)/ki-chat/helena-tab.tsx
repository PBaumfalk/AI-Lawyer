"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChatLayout } from "@/components/ki/chat-layout";
import { HelenaFeed } from "@/components/ki/helena-feed";
import { MessageSquare, Sparkles } from "lucide-react";

interface HelenaTabProps {
  initialAkteId?: string;
  initialQuery?: string;
  initialConversationId?: string;
  initialTab?: string;
}

/**
 * Helena tab component that provides Chat and Vorschlaege views
 * within the /ki-chat page.
 *
 * Modes:
 * - "chat" (default): Direct chat with Helena AI
 * - "vorschlaege": Card-based suggestions feed
 *
 * Tab bar at top shows count badge for new suggestions.
 */
export function HelenaTab({
  initialAkteId,
  initialQuery,
  initialConversationId,
  initialTab,
}: HelenaTabProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") || initialTab;
  const [activeTab, setActiveTab] = useState(
    tabParam === "vorschlaege" ? "vorschlaege" : "chat"
  );
  const [neuCount, setNeuCount] = useState(0);

  // Fetch NEU count for badge
  useEffect(() => {
    fetch("/api/helena/suggestions?status=NEU&limit=1")
      .then((res) => (res.ok ? res.json() : { neuCount: 0 }))
      .then((data) => setNeuCount(data.neuCount ?? 0))
      .catch(() => {});
  }, [activeTab]); // Re-fetch when switching tabs

  const tabs = [
    {
      id: "chat",
      label: "Chat",
      icon: MessageSquare,
    },
    {
      id: "vorschlaege",
      label: "Vorschlaege",
      icon: Sparkles,
      count: neuCount,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-lg border border-white/20 dark:border-white/[0.08] p-1 w-fit bg-white/30 dark:bg-white/[0.03] mb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-foreground/70 hover:bg-white/50 dark:hover:bg-white/[0.06]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "chat" ? (
          <ChatLayout
            initialAkteId={initialAkteId}
            initialQuery={initialQuery}
            initialConversationId={initialConversationId}
          />
        ) : (
          <div className="overflow-y-auto h-full">
            <HelenaFeed />
          </div>
        )}
      </div>
    </div>
  );
}
