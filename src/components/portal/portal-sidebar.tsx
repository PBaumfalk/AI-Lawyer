"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  FolderOpen,
  MessageSquare,
  FileText,
  User,
  LogOut,
} from "lucide-react";

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { name: "Meine Akten", href: "/portal/dashboard", icon: FolderOpen },
  { name: "Nachrichten", href: "/portal/nachrichten", icon: MessageSquare },
  { name: "Dokumente", href: "/portal/dokumente", icon: FileText },
  { name: "Profil", href: "/portal/profil", icon: User },
];

export function PortalSidebar({
  kanzleiName,
  logoUrl,
}: {
  kanzleiName: string;
  logoUrl: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="glass-sidebar w-60 flex flex-col border-r border-[var(--glass-border-color)]">
      {/* Kanzlei Branding */}
      <div className="p-4 border-b border-[var(--glass-border-color)]">
        {logoUrl && (
          <img
            src={logoUrl}
            alt={kanzleiName}
            className="h-8 mb-2 object-contain"
          />
        )}
        <span className="text-sm font-semibold text-foreground">
          {kanzleiName}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-[var(--glass-card-bg)]"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Logout button at bottom */}
      <div className="p-3 border-t border-[var(--glass-border-color)]">
        <button
          onClick={() => signOut({ callbackUrl: "/portal/login" })}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-[var(--glass-card-bg)] w-full"
        >
          <LogOut className="w-4 h-4" />
          Abmelden
        </button>
      </div>
    </aside>
  );
}
