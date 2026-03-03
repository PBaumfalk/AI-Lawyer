"use client";

import { ScrollText } from "lucide-react";
import { format, parseISO } from "date-fns";

import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";

// ---- Quest type badge styling ----------------------------------------------

const QUEST_TYP_STYLES: Record<string, { label: string; className: string }> = {
  DAILY: {
    label: "Taeglich",
    className:
      "bg-sky-500/10 text-sky-400 dark:bg-sky-400/10 dark:text-sky-300",
  },
  WEEKLY: {
    label: "Woechentlich",
    className:
      "bg-emerald-500/10 text-emerald-400 dark:bg-emerald-400/10 dark:text-emerald-300",
  },
  SPECIAL: {
    label: "Spezial",
    className:
      "bg-amber-500/10 text-amber-400 dark:bg-amber-400/10 dark:text-amber-300",
  },
};

// ---- Props -----------------------------------------------------------------

interface QuestHistoryTableProps {
  items: {
    id: string;
    questName: string;
    questTyp: string;
    xpVerdient: number;
    runenVerdient: number;
    completedAt: string;
  }[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

// ---- Component -------------------------------------------------------------

export function QuestHistoryTable({
  items,
  total,
  page,
  pageSize,
  onPageChange,
}: QuestHistoryTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Quest-Historie</h2>
      <GlassCard className="overflow-hidden">
        {items.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ScrollText className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">Noch keine Quests abgeschlossen</p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">Datum</th>
                    <th className="px-4 py-3 font-medium">Quest-Name</th>
                    <th className="px-4 py-3 font-medium">Typ</th>
                    <th className="px-4 py-3 font-medium text-right">XP</th>
                    <th className="px-4 py-3 font-medium text-right">Runen</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const typStyle = QUEST_TYP_STYLES[item.questTyp] ?? {
                      label: item.questTyp,
                      className: "bg-white/10 text-muted-foreground",
                    };

                    return (
                      <tr
                        key={item.id}
                        className="border-t border-white/5 dark:border-white/[0.03] hover:bg-white/[0.02] dark:hover:bg-white/[0.01] transition-colors"
                      >
                        <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                          {format(parseISO(item.completedAt), "dd.MM.yyyy")}
                        </td>
                        <td className="px-4 py-3">{item.questName}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${typStyle.className}`}
                          >
                            {typStyle.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          +{item.xpVerdient}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          +{item.runenVerdient}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 dark:border-white/[0.03]">
              <span className="text-xs text-muted-foreground">
                Seite {page} von {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                >
                  Zurueck
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                >
                  Weiter
                </Button>
              </div>
            </div>
          </>
        )}
      </GlassCard>
    </div>
  );
}
