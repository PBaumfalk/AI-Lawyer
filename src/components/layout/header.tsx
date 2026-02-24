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
    <header className="h-16 glass-heavy border-b border-white/[0.08] dark:border-white/[0.06] flex items-center justify-between px-6">
      {/* Search trigger */}
      <button
        onClick={openCommandPalette}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/40 dark:bg-white/[0.06] text-muted-foreground text-sm hover:bg-white/60 dark:hover:bg-white/[0.10] transition-colors w-72 border border-white/30 dark:border-white/[0.08]"
      >
        <Search className="w-4 h-4" />
        <span>Suchen...</span>
        <kbd className="ml-auto text-xs border border-border/50 rounded px-1.5 py-0.5 text-muted-foreground/70">
          ⌘K
        </kbd>
      </button>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <NotificationBell />

        {/* User info */}
        {session?.user && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-medium shadow-md shadow-brand-600/20">
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
