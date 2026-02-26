"use client";

import { Badge } from "@/components/ui/badge";
import { Bot, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AI tag type labels and colors.
 * Tags prefixed with "ai:" are highlighted with special styling.
 */
const AI_TAG_CONFIG: Record<string, { label: string; description: string }> = {
  "ai:summary": { label: "KI: Zusammenfassung", description: "KI erstellt eine Zusammenfassung" },
  "ai:draft": { label: "KI: Entwurf", description: "KI erstellt einen Entwurf" },
  "ai:auto": { label: "KI: Automatisch", description: "KI wählt die passende Aktion" },
  "ai:check": { label: "KI: Prüfen", description: "KI prüft den Vorgang" },
  "ai:monitor": { label: "KI: Überwachen", description: "KI überwacht den Vorgang" },
  "ai:done": { label: "KI: Erledigt", description: "KI-Verarbeitung abgeschlossen" },
};

interface TicketTagBadgeProps {
  tag: string;
  onRemove?: () => void;
  className?: string;
}

/**
 * Displays a single ticket tag with special styling for ai:-prefixed tags.
 * AI tags get a purple/violet accent; regular tags use the muted variant.
 */
export function TicketTagBadge({ tag, onRemove, className }: TicketTagBadgeProps) {
  const isAiTag = tag.startsWith("ai:");
  const aiConfig = AI_TAG_CONFIG[tag];
  const displayLabel = aiConfig?.label ?? tag;

  if (isAiTag) {
    return (
      <Badge
        className={cn(
          "gap-1 bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
          className
        )}
        title={aiConfig?.description}
      >
        <Bot className="w-3 h-3" />
        {displayLabel}
        {onRemove && tag !== "ai:done" && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="ml-0.5 hover:text-rose-600 dark:hover:text-rose-400"
          >
            ×
          </button>
        )}
      </Badge>
    );
  }

  return (
    <Badge variant="muted" className={cn("gap-1", className)}>
      <Tag className="w-3 h-3" />
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 hover:text-rose-600 dark:hover:text-rose-400"
        >
          ×
        </button>
      )}
    </Badge>
  );
}

/**
 * Displays a list of ticket tags with proper ai: highlighting.
 */
export function TicketTagList({
  tags,
  onRemove,
  className,
}: {
  tags: string[];
  onRemove?: (tag: string) => void;
  className?: string;
}) {
  if (tags.length === 0) return null;

  // Sort: ai: tags first, then alphabetical
  const sorted = [...tags].sort((a, b) => {
    const aIsAi = a.startsWith("ai:");
    const bIsAi = b.startsWith("ai:");
    if (aIsAi && !bIsAi) return -1;
    if (!aIsAi && bIsAi) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {sorted.map((tag) => (
        <TicketTagBadge
          key={tag}
          tag={tag}
          onRemove={onRemove ? () => onRemove(tag) : undefined}
        />
      ))}
    </div>
  );
}

/**
 * Known AI tag prefixes for validation and autocomplete.
 */
export const KNOWN_AI_TAGS = Object.keys(AI_TAG_CONFIG);

export { AI_TAG_CONFIG };
