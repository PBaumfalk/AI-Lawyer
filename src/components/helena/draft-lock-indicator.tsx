"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraftLockIndicatorProps {
  lockedBy: string;
  className?: string;
}

/**
 * Inline indicator shown when another user has a draft open for review.
 * Displays "Wird von {lockedBy} geprueft" with a lock icon.
 */
export function DraftLockIndicator({
  lockedBy,
  className,
}: DraftLockIndicatorProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
        "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
        className
      )}
    >
      <Lock className="w-3 h-3" />
      <span>Wird von {lockedBy} geprueft</span>
    </div>
  );
}
