"use client";

import {
  FileText,
  Calendar,
  StickyNote,
  Bell,
  Check,
  Pencil,
  X,
  GitBranch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DraftLockIndicator } from "@/components/helena/draft-lock-indicator";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftCardDraft {
  id: string;
  typ: string;
  titel: string;
  status: string;
  createdAt: string;
  user: { id: string; name: string | null };
  meta?: Record<string, unknown> | null;
  lockedBy?: string | null;
  parentDraftId?: string | null;
  revisionCount?: number;
}

interface DraftCardProps {
  draft: DraftCardDraft;
  onAccept: (draftId: string) => void;
  onEdit: (draftId: string) => void;
  onReject: (draftId: string) => void;
  onOpenDetail: (draftId: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  DOKUMENT: FileText,
  FRIST: Calendar,
  NOTIZ: StickyNote,
  ALERT: Bell,
};

const typeLabels: Record<string, string> = {
  DOKUMENT: "Dokument",
  FRIST: "Frist",
  NOTIZ: "Notiz",
  ALERT: "Alert",
};

const statusLabels: Record<string, string> = {
  PENDING: "ausstehend",
  ACCEPTED: "angenommen",
  REJECTED: "abgelehnt",
  EDITED: "bearbeitet",
};

/**
 * Format a timestamp as a relative time string in German.
 * E.g., "vor 5 Minuten", "vor 2 Stunden", "vor 3 Tagen"
 */
function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "gerade eben";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `vor ${diffMin} ${diffMin === 1 ? "Minute" : "Minuten"}`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `vor ${diffHrs} ${diffHrs === 1 ? "Stunde" : "Stunden"}`;
  const diffDays = Math.floor(diffHrs / 24);
  return `vor ${diffDays} ${diffDays === 1 ? "Tag" : "Tagen"}`;
}

/**
 * Format a date for FRIST drafts.
 */
function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Card showing a Helena draft in the Akte feed.
 * Dashed violet border, type icon, status badge, action buttons.
 */
export function DraftCard({
  draft,
  onAccept,
  onEdit,
  onReject,
  onOpenDetail,
  className,
}: DraftCardProps) {
  const TypeIcon = typeIcons[draft.typ] ?? FileText;
  const typeLabel = typeLabels[draft.typ] ?? draft.typ;
  const statusLabel = statusLabels[draft.status] ?? draft.status;
  const isLocked = !!draft.lockedBy;
  const isPending = draft.status === "PENDING";
  const actionsDisabled = isLocked || !isPending;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(draft.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail(draft.id);
        }
      }}
      className={cn(
        "relative rounded-lg p-4 cursor-pointer transition-colors",
        "border-2 border-dashed border-violet-300 dark:border-violet-700",
        "bg-violet-50/50 dark:bg-violet-950/20",
        "hover:bg-violet-50 dark:hover:bg-violet-950/30",
        className
      )}
    >
      {/* Header: type icon + label + status badge */}
      <div className="flex items-center gap-2 mb-2">
        <TypeIcon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
        <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
          Entwurf: {typeLabel}
        </span>
        <Badge variant="outline" className="ml-auto text-xs">
          {statusLabel}
        </Badge>
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-foreground mb-1 line-clamp-2">
        {draft.titel}
      </h4>

      {/* FRIST: show proposed deadline date */}
      {draft.typ === "FRIST" && !!draft.meta?.datum && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <Calendar className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
            Fristdatum: {formatDate(draft.meta.datum as string)}
          </span>
        </div>
      )}

      {/* Revision label */}
      {draft.parentDraftId && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Revision {draft.revisionCount ?? 1} von Original
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-xs text-muted-foreground ml-1"
            disabled
            title="Vergleich kommt in Phase 26"
            onClick={(e) => e.stopPropagation()}
          >
            Vergleichen
          </Button>
        </div>
      )}

      {/* Meta: timestamp, user */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
        <span>{formatRelativeTime(draft.createdAt)}</span>
        <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
        <span>{draft.user.name ?? "Helena"}</span>
      </div>

      {/* Lock indicator */}
      {isLocked && draft.lockedBy && (
        <div className="mt-2">
          <DraftLockIndicator lockedBy={draft.lockedBy} />
        </div>
      )}

      {/* Action buttons -- always visible */}
      <div className="flex items-center gap-2 mt-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          disabled={actionsDisabled}
          onClick={(e) => {
            e.stopPropagation();
            onAccept(draft.id);
          }}
        >
          <Check className="w-3.5 h-3.5 mr-1.5" />
          Annehmen
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs"
          disabled={actionsDisabled}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(draft.id);
          }}
        >
          <Pencil className="w-3.5 h-3.5 mr-1.5" />
          Bearbeiten
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs text-rose-700 hover:text-rose-800 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
          disabled={actionsDisabled}
          onClick={(e) => {
            e.stopPropagation();
            onReject(draft.id);
          }}
        >
          <X className="w-3.5 h-3.5 mr-1.5" />
          Ablehnen
        </Button>
      </div>
    </div>
  );
}
