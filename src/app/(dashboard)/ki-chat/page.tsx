import { ChatLayout } from "@/components/ki/chat-layout";

/**
 * /ki-chat page — Helena AI document chat.
 * Accepts optional searchParams for Akte pre-selection and pre-filled queries.
 */
interface KiChatPageProps {
  searchParams: Promise<{
    akteId?: string;
    q?: string;
    conversationId?: string;
  }>;
}

export default async function KiChatPage({ searchParams }: KiChatPageProps) {
  const { akteId, q, conversationId } = await searchParams;

  return (
    <ChatLayout
      initialAkteId={akteId}
      initialQuery={q}
      initialConversationId={conversationId}
    />
  );
}
