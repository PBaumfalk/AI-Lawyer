"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Sparkles, Filter, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DraftCard, type DraftCardDraft } from "@/components/helena/draft-card";
import {
  DraftDetailModal,
  type DraftDetailDraft,
} from "@/components/helena/draft-detail-modal";
import type { RejectFormData } from "@/components/helena/draft-reject-form";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

const DRAFT_TYPES = [
  { value: "", label: "Alle Typen" },
  { value: "DOKUMENT", label: "Dokument" },
  { value: "FRIST", label: "Frist" },
  { value: "NOTIZ", label: "Notiz" },
  { value: "ALERT", label: "Alert" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Global draft inbox showing all pending drafts with Akte and type filters.
 */
export function DraftInbox() {
  const [drafts, setDrafts] = useState<DraftFromApi[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [akteFilter, setAkteFilter] = useState("");
  const [selectedDraft, setSelectedDraft] = useState<DraftDetailDraft | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const limit = 20;

  // Derive unique Akten from loaded drafts for the filter dropdown
  const uniqueAkten = useMemo(() => {
    const seen = new Map<string, { id: string; label: string }>();
    for (const draft of drafts) {
      if (draft.akte && !seen.has(draft.akte.id)) {
        seen.set(draft.akte.id, {
          id: draft.akte.id,
          label: `${draft.akte.aktenzeichen} - ${draft.akte.kurzrubrum}`,
        });
      }
    }
    return Array.from(seen.values());
  }, [drafts]);

  // Fetch drafts
  const fetchDrafts = useCallback(
    async (p: number = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          status: "PENDING",
          page: String(p),
          limit: String(limit),
        });
        if (typeFilter) params.set("typ", typeFilter);
        if (akteFilter) params.set("akteId", akteFilter);

        const res = await fetch(`/api/helena/drafts?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (p === 1) {
            setDrafts(data.drafts ?? []);
          } else {
            setDrafts((prev) => [...prev, ...(data.drafts ?? [])]);
          }
          setTotal(data.total ?? 0);
          setPage(p);
        }
      } catch {
        toast.error("Entwuerfe konnten nicht geladen werden");
      } finally {
        setLoading(false);
      }
    },
    [typeFilter, akteFilter]
  );

  useEffect(() => {
    fetchDrafts(1);
  }, [fetchDrafts]);

  const allDraftIds = useMemo(() => drafts.map((d) => d.id), [drafts]);
  const hasMore = drafts.length < total;

  // ---------------------------------------------------------------------------
  // Draft action handlers
  // ---------------------------------------------------------------------------

  const handleAccept = useCallback(async (draftId: string) => {
    const res = await fetch(`/api/helena/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (!res.ok) throw new Error("Accept failed");
    const data = await res.json();
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    setTotal((prev) => Math.max(0, prev - 1));
    return { createdId: data.createdId, typ: data.typ };
  }, []);

  const handleEdit = useCallback((draftId: string) => {
    // Find the draft to get its akteId
    const draft = drafts.find((d) => d.id === draftId);
    if (draft?.akte) {
      window.location.href = `/akten/${draft.akte.id}?draft=${draftId}&edit=true`;
    }
  }, [drafts]);

  const handleReject = useCallback(async (draftId: string, data: RejectFormData) => {
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
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  const handleOpenDetail = useCallback(async (draftId: string) => {
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
  }, []);

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

  const currentIndex = selectedDraft
    ? allDraftIds.indexOf(selectedDraft.id)
    : -1;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="glass-card rounded-xl p-3 flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />

        {/* Type filter buttons */}
        <div className="flex items-center gap-1">
          {DRAFT_TYPES.map((dt) => (
            <Button
              key={dt.value}
              variant={typeFilter === dt.value ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setTypeFilter(dt.value)}
            >
              {dt.label}
            </Button>
          ))}
        </div>

        {/* Akte filter dropdown */}
        {uniqueAkten.length > 0 && (
          <div className="relative ml-auto">
            <select
              value={akteFilter}
              onChange={(e) => setAkteFilter(e.target.value)}
              className={cn(
                "h-7 pl-2 pr-6 text-xs rounded-md border border-input bg-background",
                "appearance-none cursor-pointer",
                "focus:outline-none focus:ring-2 focus:ring-ring"
              )}
            >
              <option value="">Alle Akten</option>
              {uniqueAkten.map((akte) => (
                <option key={akte.id} value={akte.id}>
                  {akte.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Draft list */}
      {loading && drafts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Lade Entwuerfe...
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-violet-300 dark:text-violet-700" />
          <p className="text-muted-foreground text-sm">
            Keine ausstehenden Entwuerfe
          </p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            Helena-Entwuerfe erscheinen hier zur Pruefung
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{total}</Badge>
            <span>ausstehende Entwuerfe</span>
          </div>

          <div className="space-y-3">
            {drafts.map((draft) => (
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
                            await fetch(`/api/helena/drafts/${id}/undo`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                createdId: result.createdId,
                                typ: result.typ,
                              }),
                            });
                            toast.info("Rueckgaengig gemacht");
                            fetchDrafts(1);
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

          {/* Load more */}
          {hasMore && (
            <div className="text-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchDrafts(page + 1)}
                disabled={loading}
              >
                {loading ? "Wird geladen..." : "Mehr laden"}
              </Button>
            </div>
          )}
        </>
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
