"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocket } from "@/components/socket-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Clock,
  UserMinus,
  FileWarning,
  CheckCircle2,
  Bell,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Alert type display configuration (shared with alert-center.tsx)
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
};

// ---------------------------------------------------------------------------
// Helpers
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

interface AkteAlertsSectionProps {
  akteId: string;
}

// ---------------------------------------------------------------------------
// AkteAlertsSection component
// ---------------------------------------------------------------------------

export function AkteAlertsSection({ akteId }: AkteAlertsSectionProps) {
  const { socket } = useSocket();

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch alerts scoped to this Akte
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/helena/alerts?akteId=${akteId}&limit=50`,
      );
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts);
        setTotal(data.total);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [akteId]);

  // Fetch on mount
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Socket.IO listeners for live updates
  useEffect(() => {
    if (!socket) return;

    function handleUpdate() {
      fetchAlerts();
    }

    socket.on("helena:alert-badge", handleUpdate);
    socket.on("helena:alert-critical", handleUpdate);

    return () => {
      socket.off("helena:alert-badge", handleUpdate);
      socket.off("helena:alert-critical", handleUpdate);
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

  // Loading state
  if (loading && alerts.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground mt-3">
          Warnungen werden geladen...
        </p>
      </div>
    );
  }

  // Empty state
  if (alerts.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <Bell className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Keine Warnungen fuer diese Akte
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Count badge */}
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {total} Warnung{total !== 1 ? "en" : ""}
        </p>
        {total > 0 && (
          <Badge
            variant="secondary"
            className="h-5 min-w-[20px] px-1.5 text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
          >
            {total}
          </Badge>
        )}
      </div>

      {/* Alert list */}
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

                <span className="text-xs text-muted-foreground mt-1 block">
                  {relativeTime(alert.createdAt)}
                </span>

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
    </div>
  );
}
