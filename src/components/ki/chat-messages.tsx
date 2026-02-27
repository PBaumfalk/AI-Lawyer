"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { UIMessage } from "@ai-sdk/ui-utils";
import { Bot, User, Copy, Link2, FileDown, Sparkles, AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SourceCitations, type SourceData } from "@/components/ki/source-citations";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ---------------------------------------------------------------------------
// Parse <think>...</think> tags from model output (qwen3.5 reasoning)
// ---------------------------------------------------------------------------

function parseThinking(content: string): {
  thinking: string | null;
  thinkingComplete: boolean;
  response: string;
} {
  // Completed thinking: <think>...</think> followed by response
  const match = content.match(/^<think>([\s\S]*?)<\/think>([\s\S]*)$/);
  if (match) {
    return {
      thinking: match[1].trim(),
      thinkingComplete: true,
      response: match[2].trim(),
    };
  }

  // Still streaming thinking (open tag, no closing tag yet)
  const openMatch = content.match(/^<think>([\s\S]*)$/);
  if (openMatch) {
    return {
      thinking: openMatch[1].trim(),
      thinkingComplete: false,
      response: "",
    };
  }

  // No thinking tags at all
  return { thinking: null, thinkingComplete: false, response: content };
}

// ---------------------------------------------------------------------------
// Parse <!--schriftsatz:{...}--> metadata from pipeline-injected messages
// ---------------------------------------------------------------------------

interface SchriftsatzMeta {
  _schriftsatz?: boolean;
  round?: number;
  maxRounds?: number;
  filledSlots?: Record<string, unknown>;
  _conflict?: boolean;
  pendingRueckfrage?: string;
}

function parseSchriftsatzMeta(content: string): {
  isSchriftsatz: boolean;
  meta: SchriftsatzMeta | null;
  cleanContent: string;
} {
  const match = content.match(/<!--schriftsatz:([\s\S]*?)-->/);
  if (!match) return { isSchriftsatz: false, meta: null, cleanContent: content };
  try {
    const meta = JSON.parse(match[1]) as SchriftsatzMeta;
    const cleanContent = content.replace(/\n?<!--schriftsatz:[\s\S]*?-->/, "").trim();
    return { isSchriftsatz: true, meta, cleanContent };
  } catch {
    return { isSchriftsatz: false, meta: null, cleanContent: content };
  }
}

// ---------------------------------------------------------------------------
// RueckfrageMessage -- renders a pipeline Rueckfrage with round counter
// and collapsible "Bisherige Angaben" section
// ---------------------------------------------------------------------------

function RueckfrageMessage({
  text,
  filledSlots,
  round,
  maxRounds,
}: {
  text: string;
  filledSlots: Record<string, unknown>;
  round: number;
  maxRounds: number;
}) {
  const slotEntries = Object.entries(filledSlots).filter(([, v]) => v !== null);

  return (
    <div>
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-li:my-0.5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
      <span className="text-xs text-muted-foreground ml-1">
        ({round}/{maxRounds})
      </span>
      {slotEntries.length > 0 && (
        <details className="mt-2 text-sm text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground transition-colors">
            Bisherige Angaben ({slotEntries.length})
          </summary>
          <ul className="mt-1.5 ml-4 list-disc space-y-0.5">
            {slotEntries.map(([key, value]) => (
              <li key={key}>
                <span className="font-medium">{key}:</span>{" "}
                {String(value)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PendingReminderBanner -- proactive reminder for pending Rueckfrage
// ---------------------------------------------------------------------------

function PendingReminderBanner({
  reminder,
  onDismiss,
}: {
  reminder: {
    rueckfrage: string;
    round: number;
    maxRounds: number;
    filledSlots: Record<string, unknown>;
  };
  onDismiss: () => void;
}) {
  return (
    <div className="mx-4 mb-3 p-3 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
            Offene Rueckfrage ({reminder.round}/{reminder.maxRounds})
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {reminder.rueckfrage}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 px-2 py-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors whitespace-nowrap"
        >
          Verwerfen
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatMessages -- main component
// ---------------------------------------------------------------------------

interface ChatMessagesProps {
  messages: UIMessage[];
  isLoading: boolean;
  error?: Error | undefined;
  sources: SourceData[];
  conversationId: string | null;
  pendingReminder?: {
    rueckfrage: string;
    round: number;
    maxRounds: number;
    filledSlots: Record<string, unknown>;
  } | null;
  onDismissPending?: () => void;
}

interface StoredMessage {
  role: string;
  content: string;
  timestamp?: string;
  sources?: SourceData[];
}

export function ChatMessages({
  messages,
  isLoading,
  error,
  sources,
  conversationId,
  pendingReminder,
  onDismissPending,
}: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [historicalMessages, setHistoricalMessages] = useState<StoredMessage[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState<Record<string, boolean>>({});

  // Load existing conversation messages from DB
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
        setHistoricalMessages(data.conversation?.messages ?? []);
      })
      .catch(() => {
        setHistoricalMessages([]);
      });
  }, [conversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, historicalMessages, isLoading]);

  const handleCopyLink = useCallback(() => {
    if (!conversationId) return;
    const url = `${window.location.origin}/ki-chat?conversationId=${conversationId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }, [conversationId]);

  // Combine historical (from DB) + live (from useChat) messages
  const allMessages = [
    ...historicalMessages.map((m, i) => ({
      id: `hist-${i}`,
      role: m.role as "user" | "assistant",
      content: m.content,
      sources: m.sources,
    })),
    ...messages
      .filter((m) => !(isLoading && m.role === "assistant" && !m.content))
      .map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: typeof m.content === "string" ? m.content : "",
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
            Frage — zu Ihren Akten oder allgemein zu rechtlichen Themen.
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
      {/* Conversation link copy */}
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

      {/* Proactive reminder for pending Rueckfrage */}
      {pendingReminder && onDismissPending && (
        <PendingReminderBanner
          reminder={pendingReminder}
          onDismiss={onDismissPending}
        />
      )}

      {allMessages.map((msg, idx) => {
        const isUser = msg.role === "user";
        const isLastAssistant =
          !isUser && idx === allMessages.length - 1 && !isLoading;

        return (
          <div
            key={msg.id}
            className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}
          >
            {/* Helena avatar */}
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
                (() => {
                  // Check for Schriftsatz pipeline metadata in message
                  const { isSchriftsatz, meta, cleanContent } = parseSchriftsatzMeta(msg.content);

                  if (isSchriftsatz && meta?._schriftsatz) {
                    return (
                      <RueckfrageMessage
                        text={cleanContent}
                        filledSlots={meta.filledSlots ?? {}}
                        round={meta.round ?? 1}
                        maxRounds={meta.maxRounds ?? 5}
                      />
                    );
                  }

                  // Use cleanContent (metadata stripped) for normal rendering
                  const contentForParsing = isSchriftsatz ? cleanContent : msg.content;
                  const { thinking, thinkingComplete, response } = parseThinking(contentForParsing);
                  const isStreaming = isLoading && idx === allMessages.length - 1;
                  const isThinkingPhase = isStreaming && thinking !== null && !thinkingComplete;

                  // Auto-expand while thinking is streaming, auto-collapse once response starts
                  const isExpanded =
                    thinkingExpanded[msg.id] !== undefined
                      ? thinkingExpanded[msg.id]
                      : isThinkingPhase
                        ? true
                        : !thinkingComplete;

                  return (
                    <>
                      {/* Thinking collapsible section */}
                      {thinking !== null && (
                        <div className="mb-2">
                          <button
                            onClick={() =>
                              setThinkingExpanded((prev) => ({
                                ...prev,
                                [msg.id]: !isExpanded,
                              }))
                            }
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group"
                          >
                            <ChevronRight
                              className={cn(
                                "w-3 h-3 transition-transform duration-200",
                                isExpanded && "rotate-90"
                              )}
                            />
                            <span>Helena denkt nach</span>
                            {isThinkingPhase && (
                              <span className="flex gap-0.5 ml-1">
                                <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                                <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                                <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
                              </span>
                            )}
                          </button>
                          {isExpanded && (
                            <div className="mt-1.5 pl-3 border-l-2 border-violet-200 dark:border-violet-800">
                              <p className="text-xs text-muted-foreground/70 whitespace-pre-wrap">
                                {thinking || "\u2026"}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Response text (or full content when no thinking tags) */}
                      {response && (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2 prose-pre:bg-slate-800 prose-pre:text-slate-100 prose-code:text-brand-600 dark:prose-code:text-brand-400 prose-a:text-brand-600 dark:prose-a:text-brand-400">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {response}
                          </ReactMarkdown>
                        </div>
                      )}
                    </>
                  );
                })()
              )}

              {/* Source citations */}
              {!isUser &&
                (msg.sources ?? (isLastAssistant ? sources : [])).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10 dark:border-white/[0.06]">
                    <SourceCitations
                      sources={msg.sources ?? (isLastAssistant ? sources : [])}
                    />
                  </div>
                )}

              {/* Action buttons */}
              {!isUser && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10 dark:border-white/[0.06]">
                  <button
                    onClick={() => {
                      const { cleanContent: cleaned } = parseSchriftsatzMeta(msg.content);
                      const { response } = parseThinking(cleaned);
                      navigator.clipboard.writeText(response);
                    }}
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

      {/* Error indicator */}
      {error && !isLoading && (
        <div className="flex gap-3 justify-start">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
          </div>
          <div className="rounded-2xl rounded-bl-sm px-4 py-3 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-800/30">
            <p className="text-sm text-rose-700 dark:text-rose-300 font-medium">
              Helena konnte nicht antworten
            </p>
            <p className="text-xs text-rose-600/80 dark:text-rose-400/70 mt-1">
              {error.message.includes("Nicht authentifiziert")
                ? "Sitzung abgelaufen — bitte Seite neu laden."
                : error.message.includes("Failed to fetch")
                  ? "Verbindung zum Server fehlgeschlagen. Bitte pruefen Sie Ihre Internetverbindung."
                  : "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut."}
            </p>
          </div>
        </div>
      )}

      {/* Loading indicator — only before any streaming content arrives */}
      {isLoading && !messages.some((m) => m.role === "assistant" && m.content) && (
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
