"use client";

import { useState } from "react";
import {
  FileText,
  AlertTriangle,
  Mail,
  Bot,
  Bell,
  StickyNote,
  UserPlus,
  ArrowRightLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Feed entry data shape (from API response)
export interface FeedEntryData {
  id: string;
  akteId: string;
  typ: string; // AktenActivityTyp
  titel: string;
  inhalt: string | null;
  meta: Record<string, any> | null;
  createdAt: string;
  user: { id: string; name: string } | null; // null = Helena
}

interface ActivityFeedEntryProps {
  entry: FeedEntryData;
}

// Icon mapping per activity type
const typIcons: Record<string, React.ElementType> = {
  DOKUMENT: FileText,
  FRIST: AlertTriangle,
  EMAIL: Mail,
  HELENA_DRAFT: Bot,
  HELENA_ALERT: Bell,
  NOTIZ: StickyNote,
  BETEILIGTE: UserPlus,
  STATUS_CHANGE: ArrowRightLeft,
};

// Severity-based left border color for Helena alerts
function severityBorderClass(severity?: number): string {
  if (!severity) return "border-l-2 border-l-amber-500";
  if (severity >= 7) return "border-l-2 border-l-rose-500";
  if (severity >= 4) return "border-l-2 border-l-amber-500";
  return "border-l-2 border-l-emerald-500";
}

// German relative time formatting
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} Tagen`;
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Link target for expanded entry navigation
function getDeepLink(entry: FeedEntryData): string | null {
  switch (entry.typ) {
    case "DOKUMENT":
      return `/akten/${entry.akteId}?tab=dokumente`;
    case "FRIST":
      return `/akten/${entry.akteId}?tab=kalender`;
    default:
      return null;
  }
}

export function ActivityFeedEntry({ entry }: ActivityFeedEntryProps) {
  const [expanded, setExpanded] = useState(false);

  const isHelena = entry.user === null;
  const Icon = typIcons[entry.typ] ?? FileText;

  // Border styling based on Helena vs Human and entry type
  const borderClass = isHelena
    ? entry.typ === "HELENA_ALERT"
      ? severityBorderClass(entry.meta?.severity)
      : entry.typ === "HELENA_DRAFT"
        ? "border-l-2 border-l-[oklch(45%_0.2_260)]"
        : ""
    : "";

  const deepLink = getDeepLink(entry);

  return (
    <div className={cn("glass-card rounded-xl overflow-hidden", borderClass)}>
      {/* Header -- always visible, clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/20 dark:hover:bg-white/[0.03] transition-colors"
      >
        {/* Expand indicator */}
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}

        {/* Type icon */}
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            isHelena
              ? "bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          )}
        >
          <Icon className="w-4 h-4" />
        </div>

        {/* Title + attribution */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {entry.titel}
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {isHelena ? (
              <span className="flex items-center gap-1">
                <Bot className="w-3 h-3" />
                Helena
              </span>
            ) : (
              <span>{entry.user?.name ?? "System"}</span>
            )}
            <span>·</span>
            <span>{relativeTime(entry.createdAt)}</span>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800">
          <ExpandedContent entry={entry} />

          {/* Deep link to relevant tab */}
          {deepLink && (
            <a
              href={deepLink}
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline mt-3"
            >
              <ExternalLink className="w-3 h-3" />
              Details anzeigen
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// Render expanded content based on entry type
function ExpandedContent({ entry }: { entry: FeedEntryData }) {
  const meta = entry.meta;

  switch (entry.typ) {
    case "DOKUMENT":
      return (
        <div className="text-sm text-foreground/80">
          {entry.inhalt && <p>{entry.inhalt}</p>}
          {meta?.dokumentName && (
            <p className="text-xs text-slate-500 mt-1">
              Datei: {meta.dokumentName}
            </p>
          )}
        </div>
      );

    case "FRIST":
      return (
        <div className="text-sm text-foreground/80">
          {entry.inhalt && <p>{entry.inhalt}</p>}
          {meta?.datum && (
            <p className="text-xs text-slate-500 mt-1">
              Faellig: {new Date(meta.datum).toLocaleDateString("de-DE")}
            </p>
          )}
        </div>
      );

    case "EMAIL":
      return (
        <div className="text-sm text-foreground/80">
          {meta?.betreff && (
            <p className="font-medium text-xs">{meta.betreff}</p>
          )}
          {entry.inhalt && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-3">
              {entry.inhalt}
            </p>
          )}
        </div>
      );

    case "HELENA_DRAFT":
      return (
        <div className="text-sm text-foreground/80">
          {entry.inhalt && (
            <p className="whitespace-pre-wrap line-clamp-5">{entry.inhalt}</p>
          )}
          {meta?.schriftsatzTyp && (
            <p className="text-xs text-slate-500 mt-1">
              Typ: {meta.schriftsatzTyp}
            </p>
          )}
        </div>
      );

    case "HELENA_ALERT":
      return (
        <div className="text-sm text-foreground/80">
          {entry.inhalt && <p>{entry.inhalt}</p>}
          {meta?.severity && (
            <p className="text-xs text-slate-500 mt-1">
              Schweregrad: {meta.severity}/10
            </p>
          )}
          {meta?.empfehlung && (
            <p className="text-xs text-slate-500 mt-1">
              Empfehlung: {meta.empfehlung}
            </p>
          )}
        </div>
      );

    case "NOTIZ":
      return (
        <div className="text-sm text-foreground/80">
          {entry.inhalt && (
            <p className="whitespace-pre-wrap">{entry.inhalt}</p>
          )}
        </div>
      );

    case "BETEILIGTE":
      return (
        <div className="text-sm text-foreground/80">
          {entry.inhalt && <p>{entry.inhalt}</p>}
          {meta?.kontaktName && (
            <p className="text-xs text-slate-500 mt-1">
              Kontakt: {meta.kontaktName}
              {meta?.rolle && ` (${meta.rolle})`}
            </p>
          )}
        </div>
      );

    case "STATUS_CHANGE":
      return (
        <div className="text-sm text-foreground/80">
          {meta?.alt && meta?.neu && (
            <p className="text-xs">
              <span className="text-slate-400 line-through">{meta.alt}</span>
              <span className="text-slate-400 mx-2">&rarr;</span>
              <span className="text-foreground">{meta.neu}</span>
            </p>
          )}
          {entry.inhalt && !meta?.alt && <p>{entry.inhalt}</p>}
        </div>
      );

    default:
      return entry.inhalt ? (
        <p className="text-sm text-foreground/80">{entry.inhalt}</p>
      ) : null;
  }
}
