"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  RefreshCw,
  Database,
  Server,
  HardDrive,
  Search,
  FileText,
  Cpu,
  CheckCircle2,
  XCircle,
  Activity,
} from "lucide-react";

interface ServiceStatus {
  status: "healthy" | "unhealthy";
  latency?: number;
  error?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded";
  timestamp: string;
  uptime: number;
  services: Record<string, ServiceStatus>;
}

interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  message: string;
  error?: unknown;
}

// Service display configuration (icons, labels)
const serviceConfig: Record<string, { label: string; icon: React.ElementType }> = {
  postgres: { label: "PostgreSQL", icon: Database },
  redis: { label: "Redis", icon: Server },
  minio: { label: "MinIO", icon: HardDrive },
  meilisearch: { label: "Meilisearch", icon: Search },
  onlyoffice: { label: "OnlyOffice", icon: FileText },
  worker: { label: "Worker", icon: Cpu },
};

const levelColors: Record<string, string> = {
  TRACE: "text-slate-400",
  DEBUG: "text-slate-500",
  INFO: "text-blue-600",
  WARN: "text-amber-600",
  ERROR: "text-rose-600",
  FATAL: "text-rose-800 font-bold",
};

const levelBadgeColors: Record<string, string> = {
  TRACE: "bg-slate-100 text-slate-600 border-slate-200",
  DEBUG: "bg-slate-100 text-slate-600 border-slate-200",
  INFO: "bg-blue-50 text-blue-700 border-blue-200",
  WARN: "bg-amber-50 text-amber-700 border-amber-200",
  ERROR: "bg-rose-50 text-rose-700 border-rose-200",
  FATAL: "bg-rose-100 text-rose-800 border-rose-300",
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return ts;
  }
}

export default function AdminSystemPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Log viewer state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsMessage, setLogsMessage] = useState<string | null>(null);
  const [logLevel, setLogLevel] = useState("all");
  const [logSource, setLogSource] = useState("all");
  const [logAutoRefresh, setLogAutoRefresh] = useState(false);

  // Fetch health data
  const fetchHealth = useCallback(async () => {
    try {
      setHealthLoading(true);
      const res = await fetch("/api/health");
      const data: HealthResponse = await res.json();
      setHealth(data);
      setLastChecked(new Date());
      setHealthError(null);
    } catch (err) {
      setHealthError("Fehler beim Laden der Systemstatus-Daten");
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const params = new URLSearchParams({ lines: "200" });
      if (logLevel !== "all") params.set("level", logLevel);
      if (logSource !== "all") params.set("source", logSource);

      const res = await fetch(`/api/admin/logs?${params}`);
      const data = await res.json();
      setLogs(data.entries || []);
      setLogsMessage(data.message || null);
    } catch {
      setLogs([]);
      setLogsMessage("Fehler beim Laden der Logs");
    } finally {
      setLogsLoading(false);
    }
  }, [logLevel, logSource]);

  // Initial fetch
  useEffect(() => {
    fetchHealth();
    fetchLogs();
  }, [fetchHealth, fetchLogs]);

  // Health auto-refresh (30s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealth]);

  // Log auto-refresh (30s)
  useEffect(() => {
    if (!logAutoRefresh) return;
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [logAutoRefresh, fetchLogs]);

  const allHealthy = health
    ? Object.values(health.services).every((s) => s.status === "healthy")
    : false;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">System-Status</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Service-Verfuegbarkeit und Systemprotokoll
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-refresh" className="text-sm text-muted-foreground">
              Auto-Refresh
            </Label>
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealth}
            disabled={healthLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${healthLoading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Overall status banner */}
      {health && (
        <div
          className={`rounded-lg border p-4 flex items-center gap-3 ${
            allHealthy
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          {allHealthy ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <Activity className="w-5 h-5" />
          )}
          <div>
            <p className="font-medium">
              {allHealthy
                ? "Alle Systeme betriebsbereit"
                : "Eingeschraenkter Betrieb"}
            </p>
            <p className="text-sm opacity-80">
              Laufzeit: {formatUptime(health.uptime)}
              {lastChecked && (
                <> &middot; Letzte Pruefung: {lastChecked.toLocaleTimeString("de-DE")}</>
              )}
            </p>
          </div>
        </div>
      )}

      {healthError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 text-sm">
          {healthError}
        </div>
      )}

      {/* Service health cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {health &&
          Object.entries(health.services).map(([name, service]) => {
            const config = serviceConfig[name] || {
              label: name,
              icon: Server,
            };
            const Icon = config.icon;
            const isHealthy = service.status === "healthy";

            return (
              <Card key={name}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isHealthy
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{config.label}</p>
                        {service.error && (
                          <p className="text-xs text-rose-500 mt-0.5 max-w-[200px] truncate">
                            {service.error}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {service.latency !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {service.latency}ms
                        </span>
                      )}
                      <div
                        className={`w-3 h-3 rounded-full ${
                          isHealthy ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                        title={isHealthy ? "Gesund" : "Nicht erreichbar"}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Log viewer section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Systemprotokoll</CardTitle>
            <div className="flex items-center gap-4">
              {/* Level filter */}
              <div className="flex items-center gap-2">
                <Label htmlFor="log-level" className="text-sm text-muted-foreground whitespace-nowrap">
                  Level
                </Label>
                <Select
                  id="log-level"
                  value={logLevel}
                  onChange={(e) => setLogLevel(e.target.value)}
                  className="w-28"
                >
                  <option value="all">Alle</option>
                  <option value="TRACE">Trace</option>
                  <option value="DEBUG">Debug</option>
                  <option value="INFO">Info</option>
                  <option value="WARN">Warn</option>
                  <option value="ERROR">Error</option>
                  <option value="FATAL">Fatal</option>
                </Select>
              </div>

              {/* Source filter */}
              <div className="flex items-center gap-2">
                <Label htmlFor="log-source" className="text-sm text-muted-foreground whitespace-nowrap">
                  Quelle
                </Label>
                <Select
                  id="log-source"
                  value={logSource}
                  onChange={(e) => setLogSource(e.target.value)}
                  className="w-28"
                >
                  <option value="all">Alle</option>
                  <option value="app">App</option>
                  <option value="worker">Worker</option>
                  <option value="redis">Redis</option>
                  <option value="settings">Settings</option>
                </Select>
              </div>

              {/* Log auto-refresh toggle */}
              <div className="flex items-center gap-2">
                <Label htmlFor="log-auto-refresh" className="text-sm text-muted-foreground whitespace-nowrap">
                  Auto
                </Label>
                <Switch
                  id="log-auto-refresh"
                  checked={logAutoRefresh}
                  onCheckedChange={setLogAutoRefresh}
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchLogs}
                disabled={logsLoading}
              >
                <RefreshCw className={`w-4 h-4 ${logsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logsMessage && logs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {logsMessage}
            </p>
          )}

          {logs.length > 0 ? (
            <ScrollArea className="h-[500px] rounded-md border border-border/50">
              <div className="font-mono text-xs space-y-0.5 p-3">
                {logs.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 py-1 px-2 hover:bg-muted/30 rounded"
                  >
                    <span className="text-muted-foreground whitespace-nowrap shrink-0">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 shrink-0 ${
                        levelBadgeColors[entry.level] || ""
                      }`}
                    >
                      {entry.level}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 shrink-0 bg-slate-50 border-slate-200"
                    >
                      {entry.module}
                    </Badge>
                    <span className={levelColors[entry.level] || "text-foreground"}>
                      {entry.message}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            !logsMessage && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {logsLoading ? "Lade Logs..." : "Keine Log-Eintraege vorhanden"}
              </p>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
