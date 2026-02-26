import { Suspense } from "react";
import { HelenaTab } from "./helena-tab";
import { GlassPanel } from "@/components/ui/glass-panel";

/**
 * /ki-chat page — Helena AI assistant with Chat and Vorschlaege tabs.
 * Accepts optional searchParams for Akte pre-selection, queries, and tab selection.
 */
interface KiChatPageProps {
  searchParams: Promise<{
    akteId?: string;
    q?: string;
    conversationId?: string;
    tab?: string;
  }>;
}

export default async function KiChatPage({ searchParams }: KiChatPageProps) {
  const { akteId, q, conversationId, tab } = await searchParams;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-2xl font-semibold text-foreground">
          Helena KI-Assistentin
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ihre digitale Rechtsanwaltsfachangestellte
        </p>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <Suspense fallback={<GlassPanel elevation="panel" className="h-96" />}>
          <HelenaTab
            initialAkteId={akteId}
            initialQuery={q}
            initialConversationId={conversationId}
            initialTab={tab}
          />
        </Suspense>
      </div>
    </div>
  );
}
