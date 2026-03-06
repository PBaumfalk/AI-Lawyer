"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { Bot, Plus, Send, PanelLeft, PanelLeftClose, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Conversation {
  id: string;
  titel: string;
  updatedAt: string;
  messages: any[];
}

interface SourceData {
  index: number;
  dokumentId: string;
  name: string;
  akteAktenzeichen: string;
  passage: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Strip <think>...</think> tags from assistant messages
// ---------------------------------------------------------------------------

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

// ---------------------------------------------------------------------------
// Global KI-Chat Page
// ---------------------------------------------------------------------------

export default function GlobalKiChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [sourcesMap, setSourcesMap] = useState<Record<string, SourceData[]>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // useChat with crossAkte=true, no specific Akte
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    setMessages,
    setInput,
  } = useChat({
    api: "/api/ki-chat",
    body: {
      crossAkte: true,
      akteId: null,
      conversationId: activeConversationId,
    },
    onResponse: (response) => {
      // Extract sources from X-Sources header
      const sourcesHeader = response.headers.get("X-Sources");
      if (sourcesHeader) {
        try {
          const parsed: SourceData[] = JSON.parse(decodeURIComponent(sourcesHeader));
          if (parsed.length > 0) {
            setSourcesMap((prev) => {
              const key = `msg-${Date.now()}`;
              return { ...prev, [key]: parsed };
            });
          }
        } catch {
          // Ignore parse errors
        }
      }
    },
    onFinish: () => {
      // Refresh conversations list after a message completes
      fetchConversations();
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Fetch conversations on mount
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/ki-chat/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };

  // Handle Enter to submit, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleSubmit(e as any);
        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }
    }
  };

  // Start new conversation
  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setSourcesMap({});
    setInput("");
  };

  // Load a conversation
  const handleLoadConversation = async (conv: Conversation) => {
    setActiveConversationId(conv.id);
    setSourcesMap({});
    // Convert stored messages to useChat format
    if (conv.messages && Array.isArray(conv.messages)) {
      const chatMessages = conv.messages.map((m: any, i: number) => ({
        id: `${conv.id}-${i}`,
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      setMessages(chatMessages);
    }
  };

  // Collect latest sources for a message (simple heuristic: last added)
  const latestSources = Object.values(sourcesMap).at(-1) ?? [];

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 overflow-hidden">
      {/* Sidebar: Conversation history */}
      <div
        className={cn(
          "flex-shrink-0 border-r border-white/10 dark:border-white/[0.06] bg-white/30 dark:bg-white/[0.02] backdrop-blur-md transition-all duration-200 flex flex-col",
          sidebarOpen ? "w-64" : "w-0 overflow-hidden",
          "max-md:absolute max-md:z-20 max-md:h-full"
        )}
      >
        {/* Sidebar header */}
        <div className="p-3 border-b border-white/10 dark:border-white/[0.06]">
          <button
            onClick={handleNewConversation}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[oklch(45%_0.2_260)] text-white text-sm font-medium hover:bg-[oklch(40%_0.2_260)] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neues Gespraech
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingConversations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Noch keine Gespraeche
            </p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleLoadConversation(conv)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate",
                  activeConversationId === conv.id
                    ? "bg-[oklch(45%_0.2_260/0.15)] text-[oklch(45%_0.2_260)] font-medium"
                    : "text-foreground/70 hover:bg-white/50 dark:hover:bg-white/[0.06]"
                )}
                title={conv.titel}
              >
                {conv.titel}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 dark:border-white/[0.06] bg-white/30 dark:bg-white/[0.02] backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors"
            aria-label={sidebarOpen ? "Sidebar schliessen" : "Sidebar oeffnen"}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-5 h-5 text-foreground/60" />
            ) : (
              <PanelLeft className="w-5 h-5 text-foreground/60" />
            )}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[oklch(45%_0.2_260)] flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Helena KI-Chat</h1>
              <p className="text-xs text-muted-foreground">Aktenuebergreifende Recherche</p>
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-[oklch(45%_0.2_260/0.1)] flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-[oklch(45%_0.2_260)]" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                Aktenuebergreifende Recherche
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Stelle Fragen ueber alle Akten hinweg. Helena durchsucht den gesamten Aktenbestand und
                liefert Antworten mit Quellenangaben.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                  message.role === "user"
                    ? "bg-[oklch(45%_0.2_260)] text-white"
                    : "bg-white/50 dark:bg-white/[0.05] backdrop-blur-md border border-white/20 dark:border-white/[0.08] text-foreground"
                )}
              >
                {message.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                    <ReactMarkdown>{stripThinkTags(message.content)}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}

                {/* Source citations for the last assistant message */}
                {message.role === "assistant" &&
                  index === messages.length - 1 &&
                  latestSources.length > 0 && (
                    <SourceCitations sources={latestSources} />
                  )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md border border-white/20 dark:border-white/[0.08] rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[oklch(45%_0.2_260)] rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-[oklch(45%_0.2_260)] rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-[oklch(45%_0.2_260)] rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="px-4 py-3 border-t border-white/10 dark:border-white/[0.06] bg-white/30 dark:bg-white/[0.02] backdrop-blur-md">
          <form
            onSubmit={(e) => {
              handleSubmit(e);
              if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
              }
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Frage ueber alle Akten stellen..."
              rows={1}
              className="flex-1 resize-none rounded-xl glass-input px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(45%_0.2_260)] max-h-40"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                input.trim() && !isLoading
                  ? "bg-[oklch(45%_0.2_260)] text-white hover:bg-[oklch(40%_0.2_260)]"
                  : "bg-white/30 dark:bg-white/[0.05] text-foreground/30 cursor-not-allowed"
              )}
              aria-label="Senden"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source Citations Component
// ---------------------------------------------------------------------------

function SourceCitations({ sources }: { sources: SourceData[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3 pt-2 border-t border-white/10 dark:border-white/[0.06]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs font-medium text-[oklch(45%_0.2_260)] hover:underline"
      >
        {expanded ? "Quellen ausblenden" : `${sources.length} Quellen anzeigen`}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {sources.map((src) => (
            <div
              key={src.index}
              className="text-xs text-muted-foreground bg-white/30 dark:bg-white/[0.03] rounded-lg px-2.5 py-1.5"
            >
              <span className="font-medium text-foreground/70">
                [{src.index}] {src.name}
              </span>
              <span className="ml-1 text-muted-foreground">
                (Akte {src.akteAktenzeichen})
              </span>
              {src.passage && (
                <p className="mt-0.5 text-muted-foreground/70 line-clamp-2">
                  {src.passage}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
