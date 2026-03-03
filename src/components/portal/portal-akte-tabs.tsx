"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ClipboardList, FileText, MessageSquare } from "lucide-react";

type Tab = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

export function PortalAkteTabs({ akteId }: { akteId: string }) {
  const pathname = usePathname();

  const tabs: Tab[] = [
    {
      name: "Uebersicht",
      href: `/portal/akten/${akteId}`,
      icon: ClipboardList,
      exact: true,
    },
    {
      name: "Dokumente",
      href: `/portal/akten/${akteId}/dokumente`,
      icon: FileText,
    },
    {
      name: "Nachrichten",
      href: `/portal/akten/${akteId}/nachrichten`,
      icon: MessageSquare,
    },
  ];

  return (
    <div className="border-b border-[var(--glass-border-color)]">
      <nav className="flex">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm transition-colors border-b-2",
                isActive
                  ? "text-primary font-medium border-primary"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
