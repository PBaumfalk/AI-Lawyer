"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight, Sparkles, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DraftCard, type DraftCardDraft } from "@/components/helena/draft-card";
import {
  DraftDetailModal,
  type DraftDetailDraft,
} from "@/components/helena/draft-detail-modal";
import type { RejectFormData } from "@/components/helena/draft-reject-form";
import { useSocket } from "@/components/socket-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DraftPinnedSectionProps {
  akteId: string;
  className?: string;
}

interface DraftFromApi {
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
}

// Type grouping labels
const typeLabels: Record<string, string> = {
  DOKUMENT: "Dokument-Entwuerfe",
  FRIST: "Frist-Entwuerfe",
  NOTIZ: "Notiz-Entwuerfe",
  ALERT: "Alert-Entwuerfe",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Pinned section showing pending Helena drafts grouped by type at the top of the Akte feed.
 * Listens for Socket.IO events for "new draft" banner pattern.
 */
export function DraftPinnedSection({
  akteId,
  className,
}: DraftPinnedSectionProps) {
  const [drafts, setDrafts] = useState<DraftFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [newDraftBanner, setNewDraftBanner] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<DraftDetailDraft | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { socket } = useSocket();

  // Fetch pending drafts
  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/helena/drafts?akteId=${akteId}&status=PENDING`
      );
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.drafts ?? []);
      }
    } catch {
      // Silent fail -- non-critical
    } finally {
      setLoading(false);
      setNewDraftBanner(false);
    }
  }, [akteId]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  // Listen for new draft Socket.IO events -- show banner instead of auto-inserting
  useEffect(() => {
    if (!socket) return;

    function handleNewDraft() {
      setNewDraftBanner(true);
    }

    socket.on("helena:draft-created", handleNewDraft);
    socket.on("helena:draft-revision", handleNewDraft);

    return () => {
      socket.off("helena:draft-created", handleNewDraft);
      socket.off("helena:draft-revision", handleNewDraft);
    };
  }, [socket]);

  // Group drafts by type
  const groupedDrafts = useMemo(() => {
    const groups: Record<string, DraftFromApi[]> = {};
    for (const draft of drafts) {
      if (!groups[draft.typ]) groups[draft.typ] = [];
      groups[draft.typ].push(draft);
    }
    return groups;
  }, [drafts]);

  const totalPending = drafts.length;
  const allDraftIds = useMemo(() => drafts.map((d) => d.id), [drafts]);

  const toggleGroup = useCallback((typ: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(typ)) {
        next.delete(typ);
      } else {
        next.add(typ);
      }
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Draft action handlers
  // ---------------------------------------------------------------------------

  const handleAccept = useCallback(
    async (draftId: string) => {
      const res = await fetch(`/api/helena/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (!res.ok) throw new Error("Accept failed");
      const data = await res.json();
      // Remove from local list
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      return { createdId: data.createdId, typ: data.typ };
    },
    []
  );

  const handleEdit = useCallback((draftId: string) => {
    // Navigate to edit -- for now open in the akte page with draft param
    window.location.href = `?draft=${draftId}&edit=true`;
  }, []);

  const handleReject = useCallback(
    async (draftId: string, data: RejectFormData) => {
      const res = await fetch(`/api/helena/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          categories: data.categories,
          text: data.text,
          noRevise: data.noRevise,
        }),
      });
      if (!res.ok) throw new Error("Reject failed");
      // Remove from local list
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    },
    []
  );

  const handleOpenDetail = useCallback(
    async (draftId: string) => {
      // Fetch full draft detail
      try {
        const res = await fetch(`/api/helena/drafts/${draftId}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedDraft(data);
          setModalOpen(true);
        }
      } catch {
        toast.error("Entwurf konnte nicht geladen werden");
      }
    },
    []
  );

  const handleNavigate = useCallback(
    (draftId: string) => {
      handleOpenDetail(draftId);
    },
    [handleOpenDetail]
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedDraft(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) return null;
  if (totalPending === 0 && !newDraftBanner) return null;

  const currentIndex = selectedDraft
    ? allDraftIds.indexOf(selectedDraft.id)
    : -1;

  return (
    <div className={cn("space-y-2", className)}>
      {/* New draft banner */}
      {newDraftBanner && (
        <button
          onClick={fetchDrafts}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg",
            "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
            "text-sm font-medium cursor-pointer hover:bg-violet-200 dark:hover:bg-violet-900/50",
            "transition-colors"
          )}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Neue Entwuerfe verfuegbar -- klicken zum Laden
        </button>
      )}

      {/* Section header */}
      {totalPending > 0 && (
        <div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 w-full text-left py-1.5"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-violet-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-violet-500" />
            )}
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
              Helena-Entwuerfe
            </span>
            <Badge
              variant="secondary"
              className="ml-1 bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
            >
              {totalPending}
            </Badge>
          </button>

          {!collapsed && (
            <div className="space-y-3 mt-2">
              {Object.entries(groupedDrafts).map(([typ, typDrafts]) => (
                <div key={typ}>
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(typ)}
                    className="flex items-center gap-1.5 mb-1.5 text-xs font-medium text-muted-foreground"
                  >
                    {collapsedGroups.has(typ) ? (
                      <ChevronRight className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    {typDrafts.length} {typeLabels[typ] ?? typ}
                  </button>

                  {/* Draft cards */}
                  {!collapsedGroups.has(typ) && (
                    <div className="space-y-2">
                      {typDrafts.map((draft) => (
                        <DraftCard
                          key={draft.id}
                          draft={draft as DraftCardDraft}
                          onAccept={async (id) => {
                            try {
                              const result = await handleAccept(id);
                              toast.success("Angenommen", {
                                action: {
                                  label: "Rueckgaengig",
                                  onClick: async () => {
                                    try {
                                      await fetch(
                                        `/api/helena/drafts/${id}/undo`,
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            createdId: result.createdId,
                                            typ: result.typ,
                                          }),
                                        }
                                      );
                                      toast.info("Rueckgaengig gemacht");
                                      fetchDrafts();
                                    } catch {
                                      toast.error("Undo fehlgeschlagen");
                                    }
                                  },
                                },
                                duration: 5000,
                              });
                            } catch {
                              toast.error("Fehler beim Annehmen");
                            }
                          }}
                          onEdit={handleEdit}
                          onReject={(id) => handleOpenDetail(id)}
                          onOpenDetail={handleOpenDetail}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail modal */}
      <DraftDetailModal
        draft={selectedDraft}
        allDraftIds={allDraftIds}
        currentIndex={currentIndex}
        onAccept={handleAccept}
        onEdit={handleEdit}
        onReject={handleReject}
        onNavigate={handleNavigate}
        onClose={handleCloseModal}
        open={modalOpen}
      />
    </div>
  );
}
