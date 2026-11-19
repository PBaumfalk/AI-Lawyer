"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Store,
  IdCard,
  LogOut,
  ChevronLeft,
  Activity,
  Server,
  Workflow,
  Building2,
  Sun,
  Moon,
} from "lucide-react";
import { Icon, type IconName } from "@/components/icons/persimmon";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { TimerSidebarWidget } from "@/components/finanzen/timer-sidebar-widget";
import { useTheme } from "@/components/providers/theme-provider";
import { useSocket } from "@/components/socket-provider";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@prisma/client";

// Roles that should NOT see a given nav item
type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  hideForRoles?: UserRole[];
  /** Key for dynamic badge count (resolved at runtime) */
  badgeKey?: string;
};

/** Navigationsicon aus dem Designpaket (icons/navigation-map.json). */
function navIcon(name: IconName): NavItem["icon"] {
  const NavIcon = ({ className }: { className?: string }) => <Icon name={name} className={className} />;
  NavIcon.displayName = `NavIcon(${name})`;
  return NavIcon;
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: navIcon("dashboard") },
  { name: "Akten", href: "/akten", icon: navIcon("cases") },
  { name: "Kontakte", href: "/kontakte", icon: navIcon("contacts") },
  { name: "Kalender", href: "/kalender", icon: navIcon("calendar") },
  { name: "Dokumente", href: "/dokumente", icon: navIcon("documents") },
  { name: "Entwürfe", href: "/entwuerfe", icon: navIcon("drafts"), badgeKey: "pendingDrafts" },
  { name: "Warnungen", href: "/alerts", icon: navIcon("alerts"), badgeKey: "unreadAlerts" },
  { name: "E-Mails", href: "/email", icon: navIcon("email") },
  { name: "Tickets", href: "/tickets", icon: navIcon("tickets") },
  { name: "Helena", href: "/ki-chat", icon: navIcon("helena") },
  { name: "KI-Chat", href: "/ki", icon: navIcon("ai-chat") },
  { name: "Finanzen", href: "/finanzen", icon: navIcon("finances") },
  { name: "BI-Dashboard", href: "/bi", icon: navIcon("analytics") },
  { name: "beA", href: "/bea", icon: navIcon("bea") },
  { name: "Nachrichten", href: "/nachrichten", icon: navIcon("messages"), badgeKey: "unreadMessages" },
  { name: "Shop", href: "/shop", icon: Store },
  { name: "Heldenkarte", href: "/heldenkarte", icon: IdCard },
  {
    name: "Einstellungen",
    href: "/einstellungen",
    icon: navIcon("settings"),
    hideForRoles: ["SEKRETARIAT"],
  },
];

const adminNavigation: NavItem[] = [
  { name: "Job-Monitor", href: "/admin/jobs", icon: Activity },
  { name: "System", href: "/admin/system", icon: Server },
  { name: "Pipeline", href: "/admin/pipeline", icon: Workflow },
  { name: "Dezernate", href: "/admin/dezernate", icon: Building2 },
  { name: "Rollen", href: "/admin/rollen", icon: navIcon("shield") },
  { name: "Einstellungen", href: "/admin/settings", icon: navIcon("settings") },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Narrow screens: start as icon rail, otherwise the 240px sidebar leaves
  // less than half of a phone screen for the content.
  useEffect(() => {
    const schmal = window.matchMedia("(max-width: 767px)");
    if (schmal.matches) setCollapsed(true);
    const wechsel = (e: MediaQueryListEvent) => setCollapsed(e.matches);
    schmal.addEventListener("change", wechsel);
    return () => schmal.removeEventListener("change", wechsel);
  }, []);
  const { data: session } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const { socket } = useSocket();
  const userRole = (session?.user as any)?.role as UserRole | undefined;
  const isAdmin = userRole === "ADMIN";

  // Pending drafts badge count
  const [pendingDraftsCount, setPendingDraftsCount] = useState(0);

  const fetchDraftCount = useCallback(async () => {
    try {
      const res = await fetch("/api/helena/drafts?status=PENDING&limit=0");
      if (res.ok) {
        const data = await res.json();
        setPendingDraftsCount(data.total ?? 0);
      }
    } catch {
      // Non-critical -- badge will show 0
    }
  }, []);

  // Unread alerts badge count
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);

  const fetchAlertCount = useCallback(async () => {
    try {
      const res = await fetch("/api/helena/alerts?gelesen=false&limit=1");
      if (res.ok) {
        const data = await res.json();
        setUnreadAlertsCount(data.total ?? 0);
      }
    } catch {
      // Non-critical -- badge will show 0
    }
  }, []);

  // Unread messages badge count
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  const fetchMessageCount = useCallback(async () => {
    try {
      const res = await fetch("/api/channels");
      if (res.ok) {
        const data = await res.json();
        const total = (data.channels || []).reduce(
          (sum: number, ch: { unreadCount: number }) => sum + ch.unreadCount,
          0
        );
        setUnreadMessagesCount(total);
      }
    } catch {
      // Non-critical -- badge will show 0
    }
  }, []);

  // Fetch on mount and listen for Socket.IO events to update
  useEffect(() => {
    fetchDraftCount();
    fetchAlertCount();
    fetchMessageCount();
  }, [fetchDraftCount, fetchAlertCount, fetchMessageCount]);

  useEffect(() => {
    if (!socket) return;

    function handleDraftChange() {
      fetchDraftCount();
    }

    socket.on("helena:draft-created", handleDraftChange);
    socket.on("helena:draft-revision", handleDraftChange);
    socket.on("helena:draft-accepted", handleDraftChange);
    socket.on("helena:draft-rejected", handleDraftChange);

    return () => {
      socket.off("helena:draft-created", handleDraftChange);
      socket.off("helena:draft-revision", handleDraftChange);
      socket.off("helena:draft-accepted", handleDraftChange);
      socket.off("helena:draft-rejected", handleDraftChange);
    };
  }, [socket, fetchDraftCount]);

  // Socket.IO listeners for alert badge updates
  useEffect(() => {
    if (!socket) return;

    function handleAlertBadge(data: { count: number }) {
      setUnreadAlertsCount(data.count);
    }

    function handleCriticalAlert() {
      // Refetch to get accurate count (critical alert may target this user)
      fetchAlertCount();
    }

    socket.on("helena:alert-badge", handleAlertBadge);
    socket.on("helena:alert-critical", handleCriticalAlert);

    return () => {
      socket.off("helena:alert-badge", handleAlertBadge);
      socket.off("helena:alert-critical", handleCriticalAlert);
    };
  }, [socket, fetchAlertCount]);

  // Socket.IO listener for message badge updates
  useEffect(() => {
    if (!socket) return;

    function handleMessageNotification() {
      fetchMessageCount();
    }

    socket.on("message:new", handleMessageNotification);

    return () => {
      socket.off("message:new", handleMessageNotification);
    };
  }, [socket, fetchMessageCount]);

  // Badge counts by key
  const badgeCounts: Record<string, number> = useMemo(
    () => ({
      pendingDrafts: pendingDraftsCount,
      unreadAlerts: unreadAlertsCount,
      unreadMessages: unreadMessagesCount,
    }),
    [pendingDraftsCount, unreadAlertsCount, unreadMessagesCount]
  );

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
        "glass-sidebar flex flex-col h-screen select-none overflow-hidden shrink-0 text-foreground"
      )}
    >
      {/* Logo area */}
      <div className={cn("flex items-center gap-2 px-3 py-4", collapsed && "flex-col px-2")}>
        <Link href="/dashboard" className="flex items-center min-w-0 rounded-lg px-1 py-1" aria-label="AI-Lawyer – zum Dashboard">
          {collapsed ? <BrandMark height={22} label="" /> : <BrandWordmark width={140} />}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary-soft hover:text-foreground transition-colors flex-shrink-0",
            !collapsed && "ml-auto"
          )}
          aria-label={collapsed ? "Sidebar aufklappen" : "Sidebar einklappen"}
          aria-expanded={!collapsed}
        >
          <ChevronLeft
            className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")}
          />
        </button>
      </div>

      {/* Navigation und Administration scrollen gemeinsam */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      <nav className="py-2 px-2 space-y-1" aria-label="Hauptnavigation">
        {filteredNavigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const badgeCount = item.badgeKey
            ? badgeCounts[item.badgeKey] ?? 0
            : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.name : undefined}
              aria-label={collapsed ? item.name : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-h-[44px] items-center gap-3 px-3 py-2 rounded-lg border-l-[3px] text-sm font-medium transition-colors duration-150",
                isActive
                  ? "bg-primary-soft text-primary-strong border-primary-strong font-semibold"
                  : "text-muted-foreground border-transparent hover:bg-primary-soft hover:text-foreground"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <>
                  <motion.span
                    className="truncate"
                    initial={prefersReducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    {item.name}
                  </motion.span>
                  {badgeCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-auto h-5 min-w-[20px] px-1.5 text-[11px] font-semibold bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300"
                    >
                      {badgeCount}
                    </Badge>
                  )}
                </>
              )}
              {collapsed && badgeCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Administration section -- ADMIN only */}
      {isAdmin && (
        <div className="px-2 pb-2">
          <div className="border-t border-border/60 pt-3 mb-1">
            {!collapsed && (
              <span className="px-3 text-xs font-semibold text-muted-foreground">
                Administration
              </span>
            )}
          </div>
          <nav className="space-y-1" aria-label="Administration">
            {adminNavigation.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  aria-label={collapsed ? item.name : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-[44px] items-center gap-3 px-3 py-2 rounded-lg border-l-[3px] text-sm font-medium transition-colors duration-150",
                    isActive
                      ? "bg-primary-soft text-primary-strong border-primary-strong font-semibold"
                      : "text-muted-foreground border-transparent hover:bg-primary-soft hover:text-foreground"
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

      </div>

      {/* Timer Widget */}
      {!collapsed && (
        <div className="px-2 py-1">
          <div className="rounded-xl glass-card px-3 py-2">
            <TimerSidebarWidget />
          </div>
        </div>
      )}

      {/* Sidebar bottom — dark mode toggle + profile chip */}
      <div className="border-t border-border/60 p-2 space-y-1">
        {/* Dark mode toggle */}
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex min-h-[44px] items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-primary-soft hover:text-foreground transition-colors w-full"
          aria-label={collapsed ? (resolvedTheme === "dark" ? "Heller Modus" : "Dunkler Modus") : undefined}
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
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold" aria-hidden="true">
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
                className="flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-primary-soft hover:text-foreground transition-colors"
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
