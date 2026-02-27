"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Play,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Pause,
  Timer,
  Zap,
} from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { GlassCard } from "@/components/ui/glass-card";

interface QueueCounts {
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  waiting: number;
  paused: number;
}

interface QueueInfo {
  name: string;
  counts: QueueCounts;
}

interface JobInfo {
  id: string;
  name: string;
  data: Record<string, unknown>;
  opts: { attempts?: number; delay?: number };
  progress: number | object;
  attemptsMade: number;
  processedOn?: number;
  finishedOn?: number;
  timestamp: number;
  failedReason?: string;
  returnvalue?: unknown;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: "Aktiv", color: "bg-blue-500/10 text-blue-700 border-blue-200", icon: Loader2 },
  waiting: { label: "Wartend", color: "bg-slate-500/10 text-slate-700 border-slate-200", icon: Clock },
  completed: { label: "Abgeschlossen", color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  failed: { label: "Fehlgeschlagen", color: "bg-rose-500/10 text-rose-700 border-rose-200", icon: XCircle },
  delayed: { label: "Verzoegert", color: "bg-amber-500/10 text-amber-700 border-amber-200", icon: Timer },
  paused: { label: "Pausiert", color: "bg-purple-500/10 text-purple-700 border-purple-200", icon: Pause },
};

export default function AdminJobsPage() {
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedQueue, setExpandedQueue] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("active");
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  const fetchQueues = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/jobs");
      if (!res.ok) throw new Error("Fehler beim Laden der Queues");
      const data = await res.json();
      setQueues(data.queues);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchJobs = useCallback(async (queueName: string, status: string) => {
    try {
      setJobsLoading(true);
      const res = await fetch(`/api/admin/jobs/${queueName}?status=${status}`);
      if (!res.ok) throw new Error("Fehler beim Laden der Jobs");
      const data = await res.json();
      setJobs(data.jobs);
    } catch {
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  useEffect(() => {
    if (expandedQueue) {
      fetchJobs(expandedQueue, selectedStatus);
    }
  }, [expandedQueue, selectedStatus, fetchJobs]);

  const handleRetry = async (queueName: string, jobId: string) => {
    try {
      await fetch(`/api/admin/jobs/${queueName}/${jobId}/retry`, {
        method: "POST",
      });
      fetchJobs(queueName, selectedStatus);
      fetchQueues();
    } catch {
      // Error is silently ignored; queue/job states will refresh
    }
  };

  const [triggering, setTriggering] = useState<string | null>(null);

  const handleTrigger = async (queueName: string) => {
    try {
      setTriggering(queueName);
      await fetch(`/api/admin/jobs/${queueName}/trigger`, { method: "POST" });
      fetchQueues();
      if (expandedQueue === queueName) fetchJobs(queueName, selectedStatus);
    } catch {
      // silently ignore
    } finally {
      setTriggering(null);
    }
  };

  const handleClean = async (queueName: string, status: string) => {
    try {
      await fetch(`/api/admin/jobs/${queueName}/clean`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchJobs(queueName, selectedStatus);
      fetchQueues();
    } catch {
      // Error is silently ignored; queue/job states will refresh
    }
  };

  const totalCounts = queues.reduce(
    (acc, q) => ({
      active: acc.active + q.counts.active,
      waiting: acc.waiting + q.counts.waiting,
      completed: acc.completed + q.counts.completed,
      failed: acc.failed + q.counts.failed,
      delayed: acc.delayed + q.counts.delayed,
      paused: acc.paused + q.counts.paused,
    }),
    { active: 0, waiting: 0, completed: 0, failed: 0, delayed: 0, paused: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold font-bold">Job-Monitor</h1>
          <p className="text-muted-foreground text-sm mt-1">
            BullMQ Job-Queues ueberwachen und verwalten
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchQueues}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(statusConfig).map(([key, config]) => {
          const Icon = config.icon;
          const count = totalCounts[key as keyof typeof totalCounts] || 0;
          return (
            <GlassCard
              key={key}
              className={`p-3 ${config.color}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium">{config.label}</span>
              </div>
              <p className="text-2xl font-bold">{count}</p>
            </GlassCard>
          );
        })}
      </div>

      {/* Queue list */}
      <div className="space-y-3">
        {queues.map((queue) => (
          <GlassPanel
            key={queue.name}
            elevation="panel"
            className="overflow-hidden"
          >
            {/* Queue header */}
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              onClick={() => {
                setExpandedQueue(expandedQueue === queue.name ? null : queue.name);
                setSelectedStatus("active");
              }}
            >
              <div className="flex items-center gap-3">
                {expandedQueue === queue.name ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="font-mono text-sm font-medium">{queue.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {queue.counts.active > 0 && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-200">
                    {queue.counts.active} aktiv
                  </Badge>
                )}
                {queue.counts.waiting > 0 && (
                  <Badge variant="outline" className="bg-slate-500/10 text-slate-700 border-slate-200">
                    {queue.counts.waiting} wartend
                  </Badge>
                )}
                {queue.counts.failed > 0 && (
                  <Badge variant="outline" className="bg-rose-500/10 text-rose-700 border-rose-200">
                    {queue.counts.failed} fehlgeschlagen
                  </Badge>
                )}
                <Badge variant="outline">
                  {queue.counts.completed} abgeschlossen
                </Badge>
                {queue.name === "gesetze-sync" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleTrigger(queue.name); }}
                    disabled={triggering === queue.name || queue.counts.active > 0}
                    className="text-brand-600 border-brand-300 hover:bg-brand-50"
                  >
                    {triggering === queue.name ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3 mr-1" />
                    )}
                    Jetzt synchronisieren
                  </Button>
                )}
              </div>
            </button>

            {/* Expanded queue details */}
            {expandedQueue === queue.name && (
              <div className="border-t border-[var(--glass-border-color)] p-4 space-y-4">
                {/* Status filter tabs */}
                <div className="flex items-center gap-2 flex-wrap">
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <Button
                      key={key}
                      variant={selectedStatus === key ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedStatus(key)}
                    >
                      {config.label} ({queue.counts[key as keyof QueueCounts] || 0})
                    </Button>
                  ))}
                  <div className="ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClean(queue.name, selectedStatus)}
                      className="text-rose-600 hover:text-rose-700"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Bereinigen
                    </Button>
                  </div>
                </div>

                {/* Jobs table */}
                {jobsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : jobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Keine Jobs mit Status &quot;{statusConfig[selectedStatus]?.label}&quot;
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">ID</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Name</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Versuche</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Erstellt</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Fehler</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.map((job) => (
                          <tr key={job.id} className="border-b border-border/30 hover:bg-muted/30">
                            <td className="py-2 px-3 font-mono text-xs">{job.id}</td>
                            <td className="py-2 px-3">{job.name}</td>
                            <td className="py-2 px-3">
                              {job.attemptsMade}/{job.opts.attempts || "?"}
                            </td>
                            <td className="py-2 px-3 text-muted-foreground">
                              {new Date(job.timestamp).toLocaleString("de-DE")}
                            </td>
                            <td className="py-2 px-3 text-rose-600 max-w-xs truncate">
                              {job.failedReason || "-"}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {selectedStatus === "failed" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRetry(queue.name, job.id!)}
                                >
                                  <Play className="w-3 h-3 mr-1" />
                                  Wiederholen
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </GlassPanel>
        ))}

        {!loading && queues.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Keine Queues registriert
          </p>
        )}
      </div>
    </div>
  );
}
