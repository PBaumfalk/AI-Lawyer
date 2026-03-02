"use client";

import { AnimatePresence, motion } from "motion/react";
import { Swords } from "lucide-react";

interface DamageEntry {
  id: string;
  userName: string;
  amount: number;
  createdAt: string;
}

interface BossDamageTickerProps {
  entries: DamageEntry[];
}

/** Format relative time in German (compact) */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "gerade eben";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `vor ${hours} Std`;
}

/**
 * Scrolling damage feed showing recent boss hits.
 * Newest entries at top, max 5 visible, slide-in animation.
 */
export function BossDamageTicker({ entries }: BossDamageTickerProps) {
  // Show max 5 most recent entries (newest first)
  const visible = entries.slice(0, 5);

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">
        Letzte Treffer
      </p>
      <div className="max-h-[120px] overflow-y-auto scrollbar-thin">
        <AnimatePresence initial={false}>
          {visible.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground py-0.5"
            >
              <Swords className="w-3 h-3 shrink-0 text-rose-400" />
              <span className="truncate">
                {entry.userName} hat {entry.amount} WV erledigt (-{entry.amount}{" "}
                HP)
              </span>
              <span className="ml-auto text-[10px] whitespace-nowrap opacity-60">
                {relativeTime(entry.createdAt)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {visible.length === 0 && (
          <p className="text-xs text-muted-foreground/50 py-1">
            Noch keine Treffer
          </p>
        )}
      </div>
    </div>
  );
}
