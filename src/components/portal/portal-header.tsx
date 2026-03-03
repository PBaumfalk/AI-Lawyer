"use client";

// Placeholder -- will be fully implemented in Task 2
export function PortalHeader({ kanzleiName }: { kanzleiName: string }) {
  return (
    <header className="glass-panel h-14 flex items-center px-6 border-b border-[var(--glass-border-color)]">
      <h1 className="text-lg font-semibold text-foreground">{kanzleiName} - Mandantenportal</h1>
    </header>
  );
}
