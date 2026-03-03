"use client";

import { useSession } from "next-auth/react";
import { User } from "lucide-react";

export function PortalHeader({ kanzleiName }: { kanzleiName: string }) {
  const { data: session } = useSession();

  return (
    <header className="glass-panel h-14 flex items-center justify-between px-6 border-b border-[var(--glass-border-color)]">
      <h1 className="text-lg font-semibold text-foreground">
        {kanzleiName} - Mandantenportal
      </h1>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <User className="w-4 h-4" />
        <span>{session?.user?.name}</span>
      </div>
    </header>
  );
}
