"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Calendar,
  StickyNote,
  Bell,
  Check,
  Pencil,
  X,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { DraftLockIndicator } from "@/components/helena/draft-lock-indicator";
import {
  DraftRejectForm,
  type RejectFormData,
} from "@/components/helena/draft-reject-form";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftDetailDraft {
  id: string;
  typ: string;
  titel: string;
  inhalt: string;
  status: string;
  createdAt: string;
  meta?: Record<string, unknown> | null;
  feedback?: string | null;
  user: { id: string; name: string | null };
  akte?: { id: string; aktenzeichen: string; kurzrubrum: string } | null;
  parentDraftId?: string | null;
  parentDraft?: { feedback?: string | null } | null;
  revisionCount?: number;
  lockedBy?: string | null;
}

interface DraftDetailModalProps {
  draft: DraftDetailDraft | null;
  allDraftIds: string[];
  currentIndex: number;
  onAccept: (draftId: string) => Promise<{ createdId: string; typ: string } | void>;
  onEdit: (draftId: string) => void;
  onReject: (draftId: string, data: RejectFormData) => Promise<void>;
  onNavigate: (draftId: string) => void;
  onClose: () => void;
  open: boolean;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Detail modal for reviewing a Helena draft.
 * Full content, keyboard shortcuts (A/B/R), arrow navigation, lock acquisition.
 */
export function DraftDetailModal({
  draft,
  allDraftIds,
  currentIndex,
  onAccept,
  onEdit,
  onReject,
  onNavigate,
  onClose,
  open,
}: DraftDetailModalProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const lockAcquired = useRef(false);

  // Reset state when draft changes
  useEffect(() => {
    setShowRejectForm(false);
    setIsSubmitting(false);
    setLockError(null);
  }, [draft?.id]);

  // Lock acquisition on open, release on close
  useEffect(() => {
    if (!open || !draft?.id) return;

    let cancelled = false;

    async function acquireLock() {
      try {
        const res = await fetch(`/api/helena/drafts/${draft!.id}/lock`, {
          method: "POST",
        });
        if (!cancelled) {
          if (res.ok) {
            lockAcquired.current = true;
            setLockError(null);
          } else if (res.status === 409) {
            const data = await res.json();
            setLockError(data.lockedBy ?? "Anderer Benutzer");
          }
        }
      } catch {
        // Non-fatal -- lock is best-effort
      }
    }

    acquireLock();

    return () => {
      cancelled = true;
      if (lockAcquired.current && draft?.id) {
        // Fire and forget lock release
        fetch(`/api/helena/drafts/${draft.id}/lock`, {
          method: "DELETE",
        }).catch(() => {});
        lockAcquired.current = false;
      }
    };
  }, [open, draft?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open || !draft) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in a text input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "a":
          if (!showRejectForm && draft!.status === "PENDING") {
            e.preventDefault();
            handleAccept();
          }
          break;
        case "b":
          if (!showRejectForm && draft!.status === "PENDING") {
            e.preventDefault();
            onEdit(draft!.id);
          }
          break;
        case "r":
          if (draft!.status === "PENDING") {
            e.preventDefault();
            setShowRejectForm(true);
          }
          break;
        case "arrowleft":
          e.preventDefault();
          navigatePrev();
          break;
        case "arrowright":
          e.preventDefault();
          navigateNext();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, draft, showRejectForm, allDraftIds, currentIndex]);

  const navigatePrev = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(allDraftIds[currentIndex - 1]);
    }
  }, [currentIndex, allDraftIds, onNavigate]);

  const navigateNext = useCallback(() => {
    if (currentIndex < allDraftIds.length - 1) {
      onNavigate(allDraftIds[currentIndex + 1]);
    }
  }, [currentIndex, allDraftIds, onNavigate]);

  const handleAccept = useCallback(async () => {
    if (!draft || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await onAccept(draft.id);
      toast.success("Angenommen", {
        description: `${typeLabels[draft.typ] ?? draft.typ}-Entwurf wurde angenommen.`,
        action: result
          ? {
              label: "Rueckgaengig",
              onClick: async () => {
                try {
                  await fetch(`/api/helena/drafts/${draft.id}/undo`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      createdId: result.createdId,
                      typ: result.typ,
                    }),
                  });
                  toast.info("Rueckgaengig gemacht");
                } catch {
                  toast.error("Undo fehlgeschlagen");
                }
              },
            }
          : undefined,
        duration: 5000,
      });
      onClose();
    } catch {
      toast.error("Fehler beim Annehmen");
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, isSubmitting, onAccept, onClose]);

  const handleReject = useCallback(
    async (draftId: string, data: RejectFormData) => {
      setIsSubmitting(true);
      try {
        await onReject(draftId, data);
        toast.success("Abgelehnt", {
          description: data.noRevise
            ? "Entwurf abgelehnt, keine Revision."
            : "Entwurf abgelehnt, Helena ueberarbeitet.",
        });
        onClose();
      } catch {
        toast.error("Fehler beim Ablehnen");
      } finally {
        setIsSubmitting(false);
      }
    },
    [onReject, onClose]
  );

  if (!draft) return null;

  const TypeIcon = typeIcons[draft.typ] ?? FileText;
  const typeLabel = typeLabels[draft.typ] ?? draft.typ;
  const isPending = draft.status === "PENDING";
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allDraftIds.length - 1;

  // Parse parent feedback for revision context
  let parentFeedback: { categories?: string[]; text?: string } | null = null;
  if (draft.parentDraft?.feedback) {
    try {
      parentFeedback = JSON.parse(draft.parentDraft.feedback);
    } catch {
      parentFeedback = null;
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <TypeIcon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <DialogTitle className="text-lg">
              {typeLabel}-Entwurf: {draft.titel}
            </DialogTitle>
          </div>
          <DialogDescription>
            {draft.akte
              ? `${draft.akte.aktenzeichen} - ${draft.akte.kurzrubrum}`
              : "Helena-Entwurf"}
          </DialogDescription>
        </DialogHeader>

        {/* Lock error */}
        {lockError && (
          <DraftLockIndicator lockedBy={lockError} className="mb-2" />
        )}

        {/* Revision context box */}
        {draft.parentDraftId && parentFeedback && (
          <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3 mb-2">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                Revision basiert auf Feedback:
              </span>
            </div>
            {parentFeedback.categories && parentFeedback.categories.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {parentFeedback.categories.map((cat) => (
                  <Badge key={cat} variant="outline" className="text-xs">
                    {cat}
                  </Badge>
                ))}
              </div>
            )}
            {parentFeedback.text && (
              <p className="text-xs text-muted-foreground">{parentFeedback.text}</p>
            )}
          </div>
        )}

        {/* Draft content */}
        <div className="space-y-3">
          {/* FRIST: show date prominently */}
          {draft.typ === "FRIST" && !!draft.meta?.datum && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Calendar className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-medium">
                Fristdatum:{" "}
                {new Date(draft.meta.datum as string).toLocaleDateString("de-DE", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          )}

          {/* Content body */}
          <div
            className={cn(
              "prose prose-sm dark:prose-invert max-w-none",
              "rounded-lg border p-4 bg-muted/20"
            )}
          >
            {draft.typ === "NOTIZ" || draft.typ === "ALERT" ? (
              // Render markdown-like content (simple whitespace preservation)
              <div className="whitespace-pre-wrap text-sm">{draft.inhalt}</div>
            ) : (
              <div className="text-sm">{draft.inhalt}</div>
            )}
          </div>
        </div>

        {/* Navigation arrows */}
        {allDraftIds.length > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={!hasPrev}
              onClick={navigatePrev}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Vorheriger
            </Button>
            <span>
              {currentIndex + 1} / {allDraftIds.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={!hasNext}
              onClick={navigateNext}
            >
              Naechster
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        )}

        {/* Reject form */}
        {showRejectForm && isPending ? (
          <div className="border-t pt-4 mt-2">
            <DraftRejectForm
              draftId={draft.id}
              onReject={handleReject}
              onCancel={() => setShowRejectForm(false)}
              isSubmitting={isSubmitting}
            />
          </div>
        ) : (
          /* Action buttons */
          <div className="flex items-center gap-2 pt-4 border-t mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              disabled={!isPending || isSubmitting || !!lockError}
              onClick={handleAccept}
            >
              <Check className="w-4 h-4 mr-1.5" />
              Annehmen
              <kbd className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                A
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!isPending || isSubmitting || !!lockError}
              onClick={() => onEdit(draft.id)}
            >
              <Pencil className="w-4 h-4 mr-1.5" />
              Bearbeiten
              <kbd className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                B
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-700 hover:text-rose-800 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
              disabled={!isPending || isSubmitting || !!lockError}
              onClick={() => setShowRejectForm(true)}
            >
              <X className="w-4 h-4 mr-1.5" />
              Ablehnen
              <kbd className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                R
              </kbd>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
