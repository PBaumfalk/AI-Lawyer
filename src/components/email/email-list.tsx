"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckSquare, FolderInput, MailOpen, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailFilters } from "@/components/email/email-filters";
import { EmailListRow, type EmailListItem } from "@/components/email/email-list-row";
import { EmailEmptyState } from "@/components/email/email-empty-state";
import type { EmailFiltersState } from "@/hooks/use-email-store";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EmailListProps {
  selectedKontoId: string | null;
  selectedOrdnerId: string | null;
  selectedEmailId: string | null;
  filters: EmailFiltersState;
  checkedEmailIds: Set<string>;
  onSelectEmail: (emailId: string | null) => void;
  onToggleCheck: (emailId: string) => void;
  onToggleCheckRange: (fromId: string, toId: string, emailIds: string[]) => void;
  onClearChecked: () => void;
  onCheckAll: (emailIds: string[]) => void;
  onUpdateFilters: (partial: Partial<EmailFiltersState>) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EmailList({
  selectedKontoId,
  selectedOrdnerId,
  selectedEmailId,
  filters,
  checkedEmailIds,
  onSelectEmail,
  onToggleCheck,
  onToggleCheckRange,
  onClearChecked,
  onCheckAll,
  onUpdateFilters,
}: EmailListProps) {
  const [emails, setEmails] = useState<EmailListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const parentRef = useRef<HTMLDivElement>(null);
  const lastCheckRef = useRef<string | null>(null);

  // All email IDs for shift-click range select
  const emailIds = useMemo(() => emails.map((e) => e.id), [emails]);

  // Build query parameters from filters
  const buildQueryParams = useCallback(
    (extraCursor?: string | null) => {
      const params = new URLSearchParams();
      if (selectedKontoId) params.set("kontoId", selectedKontoId);
      if (selectedOrdnerId) params.set("ordnerId", selectedOrdnerId);
      if (filters.gelesen === false) params.set("gelesen", "false");
      if (filters.gelesen === true) params.set("gelesen", "true");
      if (filters.veraktet === "veraktet") params.set("veraktet", "true");
      if (filters.veraktet === "unveraktet") params.set("veraktet", "false");
      if (filters.akteId) params.set("akteId", filters.akteId);
      if (filters.verantwortlichId) params.set("verantwortlichId", filters.verantwortlichId);
      if (filters.search) params.set("search", filters.search);
      if (filters.sort) params.set("sortBy", filters.sort === "akte" ? "empfangenAm" : filters.sort);
      if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
      params.set("limit", "50");
      if (extraCursor) params.set("cursor", extraCursor);
      return params.toString();
    },
    [selectedKontoId, selectedOrdnerId, filters]
  );

  // Fetch emails (initial or paginated)
  const fetchEmails = useCallback(
    async (isLoadMore = false) => {
      if (!selectedKontoId && !selectedOrdnerId) return;
      setLoading(true);

      try {
        const params = buildQueryParams(isLoadMore ? cursor : null);
        const res = await fetch(`/api/emails?${params}`);
        if (!res.ok) throw new Error("Fehler beim Laden der E-Mails");

        const data = await res.json();
        const newEmails: EmailListItem[] = (data.data ?? data.emails ?? []).map(
          (e: any) => ({
            id: e.id,
            betreff: e.betreff,
            absender: e.absender,
            absenderName: e.absenderName,
            empfaenger: e.empfaenger,
            inhaltText: e.inhaltText,
            empfangenAm: e.empfangenAm,
            gesendetAm: e.gesendetAm,
            gelesen: e.gelesen,
            veraktet: e.veraktet,
            prioritaet: e.prioritaet ?? "NORMAL",
            richtung: e.richtung,
            anhaengeCount: e._count?.anhaenge ?? e.anhaengeCount ?? 0,
            veraktungen: e.veraktungen,
            createdAt: e.createdAt,
          })
        );

        if (isLoadMore) {
          setEmails((prev) => [...prev, ...newEmails]);
        } else {
          setEmails(newEmails);
        }

        setCursor(data.nextCursor ?? null);
        setHasMore(!!data.nextCursor);
        if (data.total != null) setTotalCount(data.total);
      } catch (err) {
        console.error("Email fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [selectedKontoId, selectedOrdnerId, buildQueryParams, cursor]
  );

  // Re-fetch when folder or filters change
  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    fetchEmails(false);
  }, [selectedKontoId, selectedOrdnerId, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: emails.length + (hasMore ? 1 : 0), // +1 for loading indicator
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated row height
    overscan: 10,
  });

  // Infinite scroll: load more when reaching bottom
  useEffect(() => {
    const virtualItems = rowVirtualizer.getVirtualItems();
    if (virtualItems.length === 0) return;

    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    if (lastItem.index >= emails.length - 5 && hasMore && !loading) {
      fetchEmails(true);
    }
  }, [rowVirtualizer.getVirtualItems(), hasMore, loading, emails.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shift-click handler
  const handleShiftClick = useCallback(
    (emailId: string) => {
      const fromId = lastCheckRef.current;
      if (fromId) {
        onToggleCheckRange(fromId, emailId, emailIds);
      } else {
        onToggleCheck(emailId);
      }
      lastCheckRef.current = emailId;
    },
    [emailIds, onToggleCheckRange, onToggleCheck]
  );

  const handleToggleCheck = useCallback(
    (emailId: string) => {
      lastCheckRef.current = emailId;
      onToggleCheck(emailId);
    },
    [onToggleCheck]
  );

  // Select all / deselect
  const handleToggleAll = useCallback(() => {
    if (checkedEmailIds.size > 0) {
      onClearChecked();
    } else {
      onCheckAll(emailIds);
    }
  }, [checkedEmailIds.size, onClearChecked, onCheckAll, emailIds]);

  if (!selectedKontoId && !selectedOrdnerId) {
    return <EmailEmptyState type="no-selection" />;
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950">
      {/* Filters */}
      <EmailFilters filters={filters} onUpdateFilters={onUpdateFilters} />

      {/* Bulk action bar */}
      {checkedEmailIds.size > 0 && (
        <div className="px-3 py-2 bg-brand-50 dark:bg-brand-950/30 border-b border-brand-200 dark:border-brand-800/50 flex items-center gap-2">
          <button
            onClick={handleToggleAll}
            className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline"
          >
            {checkedEmailIds.size === emails.length
              ? "Auswahl aufheben"
              : "Alle auswaehlen"}
          </button>
          <span className="text-xs text-brand-600 dark:text-brand-400">
            {checkedEmailIds.size} ausgewaehlt
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <FolderInput className="w-3.5 h-3.5" />
              Verakten
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <MailOpen className="w-3.5 h-3.5" />
              Gelesen
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-rose-600 hover:text-rose-700">
              <Trash2 className="w-3.5 h-3.5" />
              Loeschen
            </Button>
          </div>
        </div>
      )}

      {/* Email list (virtualized) */}
      {loading && emails.length === 0 ? (
        // Loading skeleton
        <div className="flex-1 p-3 space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2.5 animate-pulse"
            >
              <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-1/3 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-2.5 w-1/2 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : emails.length === 0 ? (
        <EmailEmptyState type="empty-folder" />
      ) : (
        <div
          ref={parentRef}
          className="flex-1 overflow-y-auto"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              // Loading indicator at the end
              if (virtualRow.index >= emails.length) {
                return (
                  <div
                    key="loading"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="flex items-center justify-center"
                  >
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    <span className="ml-2 text-xs text-slate-400">
                      Weitere laden...
                    </span>
                  </div>
                );
              }

              const email = emails[virtualRow.index];
              return (
                <div
                  key={email.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <EmailListRow
                    email={email}
                    isSelected={email.id === selectedEmailId}
                    isChecked={checkedEmailIds.has(email.id)}
                    onSelect={onSelectEmail}
                    onToggleCheck={handleToggleCheck}
                    onShiftClick={handleShiftClick}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer: total count */}
      {emails.length > 0 && (
        <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-700/50">
          <p className="text-[11px] text-muted-foreground">
            {totalCount > 0 ? `${emails.length} von ${totalCount}` : `${emails.length}`} E-Mails
          </p>
        </div>
      )}
    </div>
  );
}
