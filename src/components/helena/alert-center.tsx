"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocket } from "@/components/socket-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Clock,
  UserMinus,
  FileWarning,
  Scale,
  CheckCircle2,
  Bell,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Alert type display configuration
// ---------------------------------------------------------------------------

const ALERT_TYPE_CONFIG: Record<
  string,
  {
    icon: typeof AlertTriangle;
    label: string;
    color: string;
  }
> = {
  FRIST_KRITISCH: {
    icon: AlertTriangle,
    label: "Kritische Frist",
    color: "text-rose-600 dark:text-rose-400",
  },
  AKTE_INAKTIV: {
    icon: Clock,
    label: "Inaktive Akte",
    color: "text-amber-600 dark:text-amber-400",
  },
  BETEILIGTE_FEHLEN: {
    icon: UserMinus,
    label: "Fehlende Beteiligte",
    color: "text-orange-600 dark:text-orange-400",
  },
  DOKUMENT_FEHLT: {
    icon: FileWarning,
    label: "Fehlende Dokumente",
    color: "text-sky-600 dark:text-sky-400",
  },
  NEUES_URTEIL: {
    icon: Scale,
    label: "Neues Urteil",
    color: "text-violet-600 dark:text-violet-400",
  },
};

// ---------------------------------------------------------------------------
// Relative time helper (German, no external dependency)
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "gerade eben";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `vor ${diffHrs} Std.`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `vor ${diffDays} Tag${diffDays > 1 ? "en" : ""}`;
  const diffMonths = Math.floor(diffDays / 30);
  return `vor ${diffMonths} Monat${diffMonths > 1 ? "en" : ""}`;
}

// ---------------------------------------------------------------------------
// Severity badge color helper
// ---------------------------------------------------------------------------

function severityBadgeClass(severity: number): string {
  if (severity >= 8) return "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300";
  if (severity >= 5) return "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300";
}

function severityLabel(severity: number): string {
  if (severity >= 8) return "Hoch";
  if (severity >= 5) return "Mittel";
  return "Niedrig";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertItem {
  id: string;
  akteId: string;
  typ: string;
  titel: string;
  inhalt: string | null;
  severity: number;
  prioritaet: number;
  meta: Record<string, unknown> | null;
  gelesen: boolean;
  gelesenAt: string | null;
  createdAt: string;
  akte: {
    id: string;
    aktenzeichen: string;
    kurzrubrum: string;
  };
}

interface Filters {
  typ: string | null;
  akteId: string | null;
  prioritaet: string | null;
  gelesen: string | null;
}

// ---------------------------------------------------------------------------
// Filter chip configuration
// ---------------------------------------------------------------------------

const TYPE_CHIPS = [
  { value: null, label: "Alle" },
  { value: "FRIST_KRITISCH", label: "Kritische Frist" },
  { value: "AKTE_INAKTIV", label: "Inaktive Akte" },
  { value: "BETEILIGTE_FEHLEN", label: "Fehlende Beteiligte" },
  { value: "DOKUMENT_FEHLT", label: "Fehlende Dokumente" },
  { value: "NEUES_URTEIL", label: "Neues Urteil" },
] as const;

const PRIORITY_CHIPS = [
  { value: null, label: "Alle Prioritaeten" },
  { value: "7", label: "Hoch (7+)" },
] as const;

const READ_CHIPS = [
  { value: "false", label: "Ungelesen" },
  { value: "true", label: "Gelesen" },
  { value: null, label: "Alle" },
] as const;

// ---------------------------------------------------------------------------
// AlertCenter component
// ---------------------------------------------------------------------------

export function AlertCenter() {
  const { socket } = useSocket();

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    typ: null,
    akteId: null,
    prioritaet: null,
    gelesen: "false", // Default: show unread only
  });

  // Fetch alerts from API
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.typ) params.set("typ", filters.typ);
    if (filters.akteId) params.set("akteId", filters.akteId);
    if (filters.prioritaet) params.set("prioritaet", filters.prioritaet);
    if (filters.gelesen !== null) params.set("gelesen", filters.gelesen);
    params.set("page", String(page));
    params.set("limit", "20");

    try {
      const res = await fetch(`/api/helena/alerts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts);
        setTotal(data.total);
        setPages(data.pages);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  // Fetch on mount and when filters/page change
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Socket.IO listeners for live updates
  useEffect(() => {
    if (!socket) return;

    function handleAlertBadge() {
      fetchAlerts();
    }

    function handleCriticalAlert() {
      fetchAlerts();
    }

    socket.on("helena:alert-badge", handleAlertBadge);
    socket.on("helena:alert-critical", handleCriticalAlert);

    return () => {
      socket.off("helena:alert-badge", handleAlertBadge);
      socket.off("helena:alert-critical", handleCriticalAlert);
    };
  }, [socket, fetchAlerts]);

  // Dismiss single alert
  const handleDismiss = async (alertId: string) => {
    try {
      const res = await fetch(`/api/helena/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        fetchAlerts();
      }
    } catch {
      // Non-critical
    }
  };

  // Bulk mark all as read
  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/helena/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        fetchAlerts();
      }
    } catch {
      // Non-critical
    }
  };

  // Update a single filter key and reset to page 1
  const updateFilter = (key: keyof Filters, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* ─── Filter chips bar ──────────────────────────────────── */}
      <div className="glass-card rounded-xl p-4 space-y-3">
        {/* Type filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground mr-1">
            Typ:
          </span>
          {TYPE_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => updateFilter("typ", chip.value)}
              className={cn(
                "px-3 py-1 text-xs rounded-full border transition-colors",
                filters.typ === chip.value
                  ? "bg-[oklch(45%_0.2_260/0.1)] text-[oklch(45%_0.2_260)] border-[oklch(45%_0.2_260/0.3)]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700 dark:hover:border-slate-500",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Priority + Read status + Bulk action */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground mr-1">
              Prioritaet:
            </span>
            {PRIORITY_CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => updateFilter("prioritaet", chip.value)}
                className={cn(
                  "px-3 py-1 text-xs rounded-full border transition-colors",
                  filters.prioritaet === chip.value
                    ? "bg-[oklch(45%_0.2_260/0.1)] text-[oklch(45%_0.2_260)] border-[oklch(45%_0.2_260/0.3)]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700 dark:hover:border-slate-500",
                )}
              >
                {chip.label}
              </button>
            ))}

            <span className="text-xs font-medium text-muted-foreground ml-3 mr-1">
              Status:
            </span>
            {READ_CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => updateFilter("gelesen", chip.value)}
                className={cn(
                  "px-3 py-1 text-xs rounded-full border transition-colors",
                  filters.gelesen === chip.value
                    ? "bg-[oklch(45%_0.2_260/0.1)] text-[oklch(45%_0.2_260)] border-[oklch(45%_0.2_260/0.3)]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700 dark:hover:border-slate-500",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="flex-shrink-0"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Alle gelesen
          </Button>
        </div>
      </div>

      {/* ─── Alert count ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} Warnung{total !== 1 ? "en" : ""}
        </p>
      </div>

      {/* ─── Alert list ───────────────────────────────────────── */}
      {loading && alerts.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">
            Warnungen werden geladen...
          </p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Bell className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Keine Warnungen vorhanden
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-xl divide-y divide-white/10 dark:divide-white/[0.04]">
          {alerts.map((alert) => {
            const typeConfig = ALERT_TYPE_CONFIG[alert.typ];
            const Icon = typeConfig?.icon ?? AlertTriangle;
            const iconColor = typeConfig?.color ?? "text-slate-500";
            const metaObj = alert.meta as Record<string, unknown> | null;
            const isAutoResolved = !!metaObj?.resolvedAt;
            const resolveReason = metaObj?.resolveReason as
              | string
              | undefined;

            return (
              <div
                key={alert.id}
                className={cn(
                  "flex items-start gap-4 px-6 py-4 transition-colors",
                  !alert.gelesen &&
                    "border-l-2 border-[oklch(45%_0.2_260)] bg-[oklch(45%_0.2_260/0.03)]",
                  alert.gelesen && "opacity-60",
                )}
              >
                {/* Type icon */}
                <div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                    alert.gelesen
                      ? "bg-slate-100 dark:bg-slate-800"
                      : "bg-white/20 dark:bg-white/[0.06]",
                  )}
                >
                  <Icon className={cn("w-4.5 h-4.5", iconColor)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">
                      {alert.titel}
                    </p>
                    {typeConfig && (
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          typeConfig.color,
                        )}
                      >
                        {typeConfig.label}
                      </span>
                    )}
                  </div>

                  {alert.inhalt && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {alert.inhalt}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <Link
                      href={`/akten/${alert.akteId}`}
                      className="inline-flex items-center gap-1 text-[oklch(45%_0.2_260)] hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {alert.akte.aktenzeichen}
                      {alert.akte.kurzrubrum && (
                        <span className="text-muted-foreground ml-0.5">
                          ({alert.akte.kurzrubrum})
                        </span>
                      )}
                    </Link>
                    <span>{relativeTime(alert.createdAt)}</span>
                  </div>

                  {/* Auto-resolved badge */}
                  {isAutoResolved && (
                    <div className="mt-1.5">
                      <Badge
                        variant="secondary"
                        className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 text-[10px]"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Automatisch geloest
                        {resolveReason && (
                          <span className="ml-1 font-normal">
                            — {resolveReason}
                          </span>
                        )}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Right: severity badge + dismiss */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] font-semibold",
                      severityBadgeClass(alert.severity),
                    )}
                  >
                    {severityLabel(alert.severity)}
                  </Badge>

                  {!alert.gelesen && (
                    <button
                      onClick={() => handleDismiss(alert.id)}
                      className="p-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-400 hover:text-emerald-600 transition-all"
                      title="Gelesen"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Pagination ───────────────────────────────────────── */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Zurueck
          </Button>
          <span className="text-sm text-muted-foreground">
            Seite {page} von {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
          >
            Weiter
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
