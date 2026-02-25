"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { Bot, User, Copy, Link2, FileDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SourceCitations, type SourceData } from "@/components/ki/source-citations";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessagesProps {
  akteId: string | null;
  conversationId: string | null;
  crossAkte: boolean;
  initialQuery?: string;
  onConversationCreated?: () => void;
}

interface StoredMessage {
  role: string;
  content: string;
  timestamp?: string;
  sources?: SourceData[];
}

export function ChatMessages({
  akteId,
  conversationId,
  crossAkte,
  initialQuery,
  onConversationCreated,
}: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sources, setSources] = useState<SourceData[]>([]);
  const [historicalMessages, setHistoricalMessages] = useState<
    StoredMessage[]
  >([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const hasInitialQuerySent = useRef(false);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
    append,
  } = useChat({
    api: "/api/ki-chat",
    body: {
      akteId,
      conversationId,
      crossAkte,
    },
    onResponse: (response) => {
      // Extract sources from custom header
      const sourcesHeader = response.headers.get("X-Sources");
      if (sourcesHeader) {
        try {
          const parsed = JSON.parse(decodeURIComponent(sourcesHeader));
          setSources(parsed);
        } catch {
          setSources([]);
        }
      }
    },
    onFinish: () => {
      onConversationCreated?.();
    },
  });

  // Load existing conversation messages
  useEffect(() => {
    if (!conversationId) {
      setHistoricalMessages([]);
      return;
    }

    fetch(`/api/ki-chat/conversations/${conversationId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        const msgs = data.conversation?.messages ?? [];
        setHistoricalMessages(msgs);

        // Extract sources from the last assistant message
        const lastAssistant = [...msgs]
          .reverse()
          .find((m: StoredMessage) => m.role === "assistant");
        if (lastAssistant?.sources) {
          setSources(lastAssistant.sources);
        }
      })
      .catch(() => {
        setHistoricalMessages([]);
      });
  }, [conversationId]);

  // Auto-send initial query from Cmd+K or Fallzusammenfassung button
  useEffect(() => {
    if (initialQuery && !hasInitialQuerySent.current && !conversationId) {
      hasInitialQuerySent.current = true;
      // Small delay to allow component mount
      setTimeout(() => {
        append({ role: "user", content: initialQuery });
      }, 200);
    }
  }, [initialQuery, conversationId, append]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, historicalMessages, isLoading]);

  // Copy conversation link
  const handleCopyLink = useCallback(() => {
    if (!conversationId) return;
    const url = `${window.location.origin}/ki-chat?conversationId=${conversationId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }, [conversationId]);

  // Combine historical + live messages
  const allMessages = [
    ...historicalMessages.map((m, i) => ({
      id: `hist-${i}`,
      role: m.role as "user" | "assistant",
      content: m.content,
      sources: m.sources,
    })),
    ...messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content:
        typeof m.content === "string"
          ? m.content
          : "",
      sources: undefined as SourceData[] | undefined,
    })),
  ];

  // Empty state
  if (allMessages.length === 0 && !isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-violet-600 dark:text-violet-400" />
          </div>
          <h2 className="text-lg font-heading text-foreground mb-2">
            Hallo! Ich bin Helena.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ihre digitale Rechtsanwaltsfachangestellte. Stellen Sie mir eine
            Frage zu Ihren Akten-Dokumenten. Ich durchsuche die relevanten
            Unterlagen und antworte mit Quellenangaben.
          </p>
          <p className="text-xs text-muted-foreground mt-3 italic">
            Hinweis: Dieser Assistent ersetzt keine anwaltliche Pruefung.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-4 py-4 space-y-4">
      {/* Conversation header with link copy button */}
      {conversationId && (
        <div className="flex justify-end">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-white/50 dark:hover:bg-white/[0.05]"
            title="Link kopieren"
          >
            <Link2 className="w-3 h-3" />
            {copiedLink ? "Link kopiert!" : "Link kopieren"}
          </button>
        </div>
      )}

      {allMessages.map((msg, idx) => {
        const isUser = msg.role === "user";
        const isLastAssistant =
          !isUser &&
          idx === allMessages.length - 1 &&
          !isLoading;

        return (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3",
              isUser ? "justify-end" : "justify-start"
            )}
          >
            {/* Avatar */}
            {!isUser && (
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
            )}

            {/* Message bubble */}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                isUser
                  ? "bg-brand-600 text-white rounded-br-sm"
                  : "glass rounded-bl-sm"
              )}
            >
              {isUser ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2 prose-pre:bg-slate-800 prose-pre:text-slate-100 prose-code:text-brand-600 dark:prose-code:text-brand-400 prose-a:text-brand-600 dark:prose-a:text-brand-400">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}

              {/* Source citations for assistant messages */}
              {!isUser &&
                (msg.sources ?? (isLastAssistant ? sources : [])).length >
                  0 && (
                  <div className="mt-3 pt-3 border-t border-white/10 dark:border-white/[0.06]">
                    <SourceCitations
                      sources={
                        msg.sources ??
                        (isLastAssistant ? sources : [])
                      }
                    />
                  </div>
                )}

              {/* Action buttons for assistant messages */}
              {!isUser && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10 dark:border-white/[0.06]">
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(msg.content)
                    }
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-white/50 dark:hover:bg-white/[0.05]"
                    title="Kopieren"
                  >
                    <Copy className="w-3 h-3" />
                    Kopieren
                  </button>
                  <button
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-white/50 dark:hover:bg-white/[0.05]"
                    title="Als Entwurf speichern"
                  >
                    <FileDown className="w-3 h-3" />
                    Als Entwurf
                  </button>
                </div>
              )}
            </div>

            {/* User avatar */}
            {isUser && (
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950 flex items-center justify-center">
                  <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex gap-3 justify-start">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
              <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <div className="glass rounded-2xl rounded-bl-sm px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Helena denkt nach</span>
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
