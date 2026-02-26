import { cn } from "@/lib/utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Use larger blur for prominent panels */
  prominent?: boolean;
}

export function GlassPanel({
  className,
  prominent,
  children,
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        "rounded-2xl",
        prominent ? "glass-lg" : "glass",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
