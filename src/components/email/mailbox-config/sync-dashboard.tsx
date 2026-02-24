"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  Clock,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

interface EmailKonto {
  id: string;
  name: string;
  emailAdresse: string;
  aktiv: boolean;
  syncStatus: string;
  letzterSync: string | null;
  fehlerLog: Array<{ timestamp: string; message: string }> | null;
  _count?: { nachrichten: number };
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "VERBUNDEN":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-full">
          <CheckCircle2 className="w-3 h-3" />
          Verbunden
        </span>
      );
    case "FEHLER":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded-full">
          <XCircle className="w-3 h-3" />
          Fehler
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium rounded-full">
          <MinusCircle className="w-3 h-3" />
          Getrennt
        </span>
      );
  }
}

export function SyncDashboard() {
  const [konten, setKonten] = useState<EmailKonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  const loadKonten = useCallback(async () => {
    try {
      const res = await fetch("/api/email-konten");
      if (res.ok) {
        const data = await res.json();
        setKonten(
          (Array.isArray(data) ? data : []).filter(
            (k: EmailKonto) => k.aktiv
          )
        );
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKonten();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadKonten, 30_000);
    return () => clearInterval(interval);
  }, [loadKonten]);

  const triggerSync = async (kontoId: string) => {
    setSyncingIds((prev) => {
      const next = new Set(prev);
      next.add(kontoId);
      return next;
    });
    try {
      const res = await fetch(`/api/email-konten/${kontoId}/sync`, {
        method: "POST",
      });

      if (res.ok) {
        toast.success("Synchronisation gestartet");
      } else {
        toast.error("Fehler beim Starten der Synchronisation");
      }
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(kontoId);
        return next;
      });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Nie";
    return new Date(dateStr).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Lade Sync-Status...
      </div>
    );
  }

  if (konten.length === 0) {
    return (
      <div className="text-center py-12 glass rounded-xl">
        <RefreshCw className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-foreground font-medium">
          Keine aktiven Postfaecher
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Aktivieren Sie ein Postfach im Tab "Postfaecher", um den Sync-Status zu sehen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Synchronisationsstatus fuer {konten.length} aktive{" "}
        Postfach{konten.length !== 1 ? "faecher" : ""}. Aktualisiert sich automatisch alle 30 Sekunden.
      </p>

      {konten.map((konto) => {
        const errors = Array.isArray(konto.fehlerLog)
          ? konto.fehlerLog
          : [];
        const isSyncing = syncingIds.has(konto.id);

        return (
          <div key={konto.id} className="glass rounded-xl p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                  <span className="font-medium text-foreground text-sm">
                    {konto.name}
                  </span>
                  <div className="text-xs text-muted-foreground">
                    {konto.emailAdresse}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusBadge status={konto.syncStatus} />
                <button
                  type="button"
                  onClick={() => triggerSync(konto.id)}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isSyncing ? "animate-spin" : ""
                    }`}
                  />
                  {isSyncing ? "Synchronisiert..." : "Jetzt synchronisieren"}
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>Letzter Sync:</span>
                <span className="text-foreground font-medium">
                  {formatDate(konto.letzterSync)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-3.5 h-3.5" />
                <span>Gespeicherte E-Mails:</span>
                <span className="text-foreground font-medium">
                  {konto._count?.nachrichten?.toLocaleString("de-DE") ?? "?"}
                </span>
              </div>
            </div>

            {/* Error log */}
            {errors.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Letzte Fehler ({errors.length})
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {errors.slice(0, 5).map((err, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 px-2 py-1.5 bg-red-50/50 dark:bg-red-900/10 rounded text-xs"
                    >
                      <span className="text-muted-foreground flex-shrink-0">
                        {err.timestamp
                          ? new Date(err.timestamp).toLocaleString("de-DE", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "?"}
                      </span>
                      <span className="text-red-600 dark:text-red-400">
                        {err.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
