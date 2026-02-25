"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Calendar,
  FileText,
  Wallet,
  Mail,
  MessageSquare,
  Settings,
  Scale,
  Shield,
  LogOut,
  ChevronLeft,
  TicketCheck,
  Sparkles,
  Activity,
  Server,
  Wrench,
  Workflow,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { TimerSidebarWidget } from "@/components/finanzen/timer-sidebar-widget";
import type { UserRole } from "@prisma/client";

// Roles that should NOT see a given nav item
type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  hideForRoles?: UserRole[];
};

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Akten", href: "/akten", icon: FolderOpen },
  { name: "Kontakte", href: "/kontakte", icon: Users },
  { name: "Kalender", href: "/kalender", icon: Calendar },
  { name: "Dokumente", href: "/dokumente", icon: FileText },
  { name: "E-Mails", href: "/email", icon: Mail },
  { name: "Tickets", href: "/tickets", icon: TicketCheck },
  { name: "Helena", href: "/ki-chat", icon: Sparkles },
  { name: "Finanzen", href: "/finanzen", icon: Wallet },
  { name: "beA", href: "/bea", icon: Shield },
  { name: "Nachrichten", href: "/nachrichten", icon: MessageSquare },
  {
    name: "Einstellungen",
    href: "/einstellungen",
    icon: Settings,
    hideForRoles: ["SEKRETARIAT"],
  },
];

const adminNavigation: NavItem[] = [
  { name: "Job-Monitor", href: "/admin/jobs", icon: Activity },
  { name: "System", href: "/admin/system", icon: Server },
  { name: "Pipeline", href: "/admin/pipeline", icon: Workflow },
  { name: "Dezernate", href: "/admin/dezernate", icon: Building2 },
  { name: "Rollen", href: "/admin/rollen", icon: ShieldCheck },
  { name: "Einstellungen", href: "/admin/settings", icon: Wrench },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role as UserRole | undefined;
  const isAdmin = userRole === "ADMIN";

  // Filter navigation items based on user role
  const filteredNavigation = useMemo(() => {
    if (!userRole) return navigation;
    return navigation.filter((item) => {
      if (!item.hideForRoles) return true;
      return !item.hideForRoles.includes(userRole);
    });
  }, [userRole]);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen text-white transition-all duration-200",
        "bg-slate-900/85 backdrop-blur-xl border-r border-white/[0.06]",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shadow-lg shadow-brand-600/25">
            <Scale className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-heading text-lg truncate">AI-Lawyer</span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "ml-auto p-1.5 rounded-md hover:bg-white/10 transition-colors",
            collapsed && "ml-0 mt-0"
          )}
          aria-label={collapsed ? "Sidebar aufklappen" : "Sidebar einklappen"}
        >
          <ChevronLeft
            className={cn(
              "w-4 h-4 transition-transform",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {filteredNavigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/[0.07] hover:text-white"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Administration section -- ADMIN only */}
      {isAdmin && (
        <div className="px-2 pb-2">
          <div className="border-t border-white/[0.06] pt-3 mb-1">
            {!collapsed && (
              <span className="px-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Administration
              </span>
            )}
          </div>
          <nav className="space-y-1">
            {adminNavigation.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-white/[0.12] text-white shadow-sm"
                      : "text-slate-400 hover:bg-white/[0.07] hover:text-white"
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Timer Widget */}
      {!collapsed && <TimerSidebarWidget />}

      {/* User / Logout */}
      <div className="border-t border-white/[0.06] p-2">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-white/[0.07] hover:text-white transition-colors w-full"
          title={collapsed ? "Abmelden" : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Abmelden</span>}
        </button>
      </div>
    </aside>
  );
}
