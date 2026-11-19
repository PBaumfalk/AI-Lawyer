"use client";

import { useSession } from "next-auth/react";
import { Search } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function Header() {
  const { data: session } = useSession();

  function openCommandPalette() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
  }

  return (
    <header className="sticky top-0 z-40 h-16 glass-panel border-b border-border/60 flex items-center justify-between gap-3 px-3 sm:px-6">
      {/* Search trigger */}
      <button
        onClick={openCommandPalette}
        className="flex min-h-[40px] items-center gap-2 px-3 py-2 rounded-lg bg-[var(--al-surface)] text-muted-foreground text-sm hover:border-primary-strong transition-colors w-full max-w-72 min-w-0 border border-border"
        aria-label="Suchen (Befehlspalette, Cmd+K)"
      >
        <Search className="w-4 h-4" />
        <span>Suchen...</span>
        <kbd className="ml-auto hidden sm:inline text-xs border border-border/50 rounded px-1.5 py-0.5 text-muted-foreground/70">
          ⌘K
        </kbd>
      </button>

      {/* Right section */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Notifications */}
        <NotificationBell />

        {/* User info */}
        {session?.user && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold" aria-hidden="true">
              {session.user.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-foreground">
                {session.user.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {(session.user as any).role}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
