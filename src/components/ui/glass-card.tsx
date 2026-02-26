import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Use heavier glass backdrop (more opaque) */
  heavy?: boolean;
}

export function GlassCard({
  className,
  heavy,
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl",
        heavy ? "glass-heavy" : "glass",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
