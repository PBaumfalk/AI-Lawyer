"use client";

import type { EmailFiltersState } from "@/hooks/use-email-store";
import { EmailEmptyState } from "@/components/email/email-empty-state";

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

/**
 * Virtualized email list with infinite scroll, filters, and bulk actions.
 * Placeholder — full implementation in Task 2.
 */
export function EmailList({
  selectedKontoId,
  selectedOrdnerId,
}: EmailListProps) {
  if (!selectedKontoId || !selectedOrdnerId) {
    return <EmailEmptyState type="no-selection" />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          E-Mail-Liste wird geladen...
        </p>
      </div>
    </div>
  );
}
