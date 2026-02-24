"use client";

import { differenceInDays, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface FristenAmpelProps {
  /** The deadline date */
  datum: Date | string;
  /** Whether the deadline is marked as done */
  erledigt?: boolean;
  /** Show text label next to the dot */
  showLabel?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Color-coded deadline indicator (Warn-Ampel).
 *
 * Colors per design system:
 * - >7 days: emerald (green/niedrig)
 * - 3-7 days: amber (yellow/mittel)
 * - <3 days: rose (red/hoch)
 * - overdue: slate-900 (black/schwarz)
 * - erledigt: slate-400 (greyed out)
 */
export function FristenAmpel({
  datum,
  erledigt = false,
  showLabel = false,
  size = "md",
  className,
}: FristenAmpelProps) {
  const deadlineDate = typeof datum === "string" ? new Date(datum) : datum;
  const today = startOfDay(new Date());
  const diff = differenceInDays(startOfDay(deadlineDate), today);

  // Determine color and label
  let colorClasses: string;
  let label: string;
  let dotColor: string;

  if (erledigt) {
    colorClasses = "text-slate-400";
    dotColor = "bg-slate-400";
    label = "Erledigt";
  } else if (diff < 0) {
    colorClasses = "text-slate-900 dark:text-slate-100";
    dotColor = "bg-slate-900 dark:bg-slate-100";
    label = `${Math.abs(diff)}d ueberfaellig`;
  } else if (diff < 3) {
    colorClasses = "text-rose-600 dark:text-rose-400";
    dotColor = "bg-rose-500";
    label = diff === 0 ? "Heute" : diff === 1 ? "Morgen" : `${diff} Tage`;
  } else if (diff <= 7) {
    colorClasses = "text-amber-600 dark:text-amber-400";
    dotColor = "bg-amber-500";
    label = `${diff} Tage`;
  } else {
    colorClasses = "text-emerald-600 dark:text-emerald-400";
    dotColor = "bg-emerald-500";
    label = `${diff} Tage`;
  }

  const dotSizes = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  const textSizes = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        colorClasses,
        className
      )}
      title={
        erledigt
          ? "Erledigt"
          : diff < 0
            ? `${Math.abs(diff)} Tage ueberfaellig`
            : `Noch ${diff} Tage`
      }
    >
      <span
        className={cn("rounded-full shrink-0", dotColor, dotSizes[size])}
        aria-hidden="true"
      />
      {showLabel && (
        <span className={cn("font-medium whitespace-nowrap", textSizes[size])}>
          {label}
        </span>
      )}
    </span>
  );
}
