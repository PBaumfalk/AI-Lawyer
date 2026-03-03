"use client";

// Placeholder -- will be fully implemented in Task 2
export function PortalSidebar({
  kanzleiName,
  logoUrl,
}: {
  kanzleiName: string;
  logoUrl: string | null;
}) {
  return (
    <aside className="glass-sidebar w-60 flex flex-col border-r border-[var(--glass-border-color)]">
      <div className="p-4">
        <span className="text-sm font-semibold text-foreground">{kanzleiName}</span>
      </div>
    </aside>
  );
}
