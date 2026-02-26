"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, animate, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

interface GlassKpiCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color?: "blue" | "amber" | "rose" | "emerald";
  className?: string;
  /** When true, renders a glass-shimmer skeleton placeholder instead of content */
  skeleton?: boolean;
}

const iconBg: Record<string, string> = {
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

export function GlassKpiCard({
  title,
  value,
  icon: Icon,
  color = "blue",
  className,
  skeleton = false,
}: GlassKpiCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const count = useMotionValue(0);
  const [displayValue, setDisplayValue] = useState<string | number>(
    typeof value === "number" ? 0 : value
  );

  useEffect(() => {
    if (typeof value !== "number" || prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }
    const controls = animate(count, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
    });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, prefersReducedMotion]);

  if (skeleton) {
    return (
      <div
        className={cn("glass-card rounded-xl p-5 h-[84px] glass-shimmer", className)}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className={cn("glass-card rounded-xl p-5", className)}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            iconBg[color]
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold text-foreground">{displayValue}</p>
        </div>
      </div>
    </div>
  );
}
