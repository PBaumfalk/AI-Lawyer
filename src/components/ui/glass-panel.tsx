"use client";

import { cn } from "@/lib/utils";

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Elevation tier: card (16px blur), panel (24px blur), elevated (40px blur) */
  elevation?: "card" | "panel" | "elevated";
  /** @deprecated Use elevation="elevated" instead */
  prominent?: boolean;
}

const elevationClass: Record<string, string> = {
  card: "glass-card",
  panel: "glass-panel",
  elevated: "glass-panel-elevated",
};

export function GlassPanel({
  className,
  elevation,
  prominent,
  children,
  ...props
}: GlassPanelProps) {
  // backward-compat: prominent prop maps to elevated
  const resolvedElevation = elevation ?? (prominent ? "elevated" : "panel");

  return (
    <div
      className={cn(
        "rounded-2xl",
        elevationClass[resolvedElevation],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
