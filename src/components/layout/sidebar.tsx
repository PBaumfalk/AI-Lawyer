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
  Sun,
  Moon,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { TimerSidebarWidget } from "@/components/finanzen/timer-sidebar-widget";
import { useTheme } from "@/components/providers/theme-provider";
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
  const { resolvedTheme, setTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
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
    <motion.aside
      animate={{ width: collapsed ? 56 : 240 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 300, damping: 30 }
      }
      className={cn(
        "glass-sidebar flex flex-col h-screen select-none overflow-hidden",
        "text-[oklch(20%_0.01_250)] dark:text-[oklch(92%_0.005_250)]"
      )}
    >
      {/* Logo area */}
      <div className="flex items-center gap-2 px-3 py-4">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-[10px] bg-white/15 backdrop-blur-[8px] min-w-0">
          <div className="flex-shrink-0 w-7 h-7 bg-[oklch(45%_0.2_260)] rounded-lg flex items-center justify-center shadow-lg">
            <Scale className="w-3.5 h-3.5 text-white" />
          </div>
          {!collapsed && (
            <motion.span
              className="font-semibold text-sm truncate"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              AI-Lawyer
            </motion.span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1.5 rounded-lg hover:bg-white/10 dark:hover:bg-white/5 transition-colors flex-shrink-0"
          aria-label={collapsed ? "Sidebar aufklappen" : "Sidebar einklappen"}
        >
          <ChevronLeft
            className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 space-y-1 overflow-y-auto">
        {filteredNavigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-[oklch(45%_0.2_260/0.15)] text-[oklch(45%_0.2_260)] border-l-2 border-[oklch(45%_0.2_260)] -ml-[2px]"
                  : "text-[oklch(40%_0.015_250)] dark:text-[oklch(65%_0.01_250)] hover:bg-white/5 dark:hover:bg-white/[0.03]"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <motion.span
                  className="truncate"
                  initial={prefersReducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  {item.name}
                </motion.span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Administration section -- ADMIN only */}
      {isAdmin && (
        <div className="px-2 pb-2">
          <div className="border-t border-[oklch(0%_0_0/0.08)] dark:border-[oklch(100%_0_0/0.06)] pt-3 mb-1">
            {!collapsed && (
              <span className="px-3 text-[10px] uppercase tracking-wider text-[oklch(60%_0.01_250)] dark:text-[oklch(50%_0.01_250)] font-semibold">
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
                  title={collapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-[oklch(45%_0.2_260/0.15)] text-[oklch(45%_0.2_260)] border-l-2 border-[oklch(45%_0.2_260)] -ml-[2px]"
                      : "text-[oklch(40%_0.015_250)] dark:text-[oklch(65%_0.01_250)] hover:bg-white/5 dark:hover:bg-white/[0.03]"
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <motion.span
                      className="truncate"
                      initial={prefersReducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15 }}
                    >
                      {item.name}
                    </motion.span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Timer Widget */}
      {!collapsed && (
        <div className="px-2 py-1">
          <div className="rounded-xl glass-card px-3 py-2">
            <TimerSidebarWidget />
          </div>
        </div>
      )}

      {/* Sidebar bottom — dark mode toggle + profile chip */}
      <div className="border-t border-[oklch(0%_0_0/0.08)] dark:border-[oklch(100%_0_0/0.06)] p-2 space-y-1">
        {/* Dark mode toggle */}
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 dark:hover:bg-white/5 transition-colors w-full"
          title={collapsed ? (resolvedTheme === "dark" ? "Hell" : "Dunkel") : undefined}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="w-5 h-5 flex-shrink-0" />
          ) : (
            <Moon className="w-5 h-5 flex-shrink-0" />
          )}
          {!collapsed && (
            <motion.span
              className="text-sm truncate"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              {resolvedTheme === "dark" ? "Heller Modus" : "Dunkler Modus"}
            </motion.span>
          )}
        </button>

        {/* Profile chip */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg glass-card">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[oklch(45%_0.2_260)] flex items-center justify-center text-white text-xs font-semibold shadow-md">
            {session?.user?.name
              ?.split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2) ?? "?"}
          </div>
          {!collapsed && (
            <>
              <motion.div
                className="flex-1 min-w-0"
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                <p className="text-sm font-medium truncate">
                  {session?.user?.name ?? "Benutzer"}
                </p>
              </motion.div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex-shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors"
                aria-label="Abmelden"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
          {collapsed && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex justify-center"
              aria-label="Abmelden"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
