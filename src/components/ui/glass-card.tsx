"use client";

import { cn } from "@/lib/utils";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual variant: default (16px blur) or elevated (40px blur) */
  variant?: "default" | "elevated";
  /** @deprecated Use variant="elevated" instead */
  heavy?: boolean;
}

export function GlassCard({
  className,
  variant,
  heavy,
  children,
  ...props
}: GlassCardProps) {
  // backward-compat: heavy prop maps to elevated variant
  const resolvedVariant = variant ?? (heavy ? "elevated" : "default");

  return (
    <div
      className={cn(
        "rounded-xl",
        resolvedVariant === "elevated" ? "glass-panel-elevated" : "glass-card",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
