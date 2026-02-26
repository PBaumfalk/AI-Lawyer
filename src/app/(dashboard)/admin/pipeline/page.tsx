"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GlassPanel } from "@/components/ui/glass-panel";
import { GlassCard } from "@/components/ui/glass-card";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  FileText,
  Cpu,
  Search,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface FailedDocument {
  id: string;
  name: string;
  mimeType: string;
  ocrFehler: string | null;
  ocrVersuche: number;
  akteId: string;
  updatedAt: string;
  akte: { aktenzeichen: string; kurzrubrum: string } | null;
}

interface PipelineData {
  queues: {
    ocr: QueueCounts;
    embedding: QueueCounts;
    preview: QueueCounts;
  };
  failedDocuments: FailedDocument[];
  statusDistribution: Record<string, number>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  AUSSTEHEND: { label: "Ausstehend", color: "bg-slate-100 text-slate-700" },
  IN_VERARBEITUNG: { label: "In Verarbeitung", color: "bg-blue-100 text-blue-700" },
  ABGESCHLOSSEN: { label: "Abgeschlossen", color: "bg-emerald-100 text-emerald-700" },
  FEHLGESCHLAGEN: { label: "Fehlgeschlagen", color: "bg-rose-100 text-rose-700" },
  NICHT_NOETIG: { label: "Nicht noetig", color: "bg-slate-100 text-slate-500" },
};

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

// ── Queue Card Component ───────────────────────────────────────────────────

function QueueCard({
  title,
  icon: Icon,
  counts,
}: {
  title: string;
  icon: React.ElementType;
  counts: QueueCounts | undefined;
}) {
  return (
    <GlassCard className="p-4">
      <div className="flex flex-row items-center justify-between pb-2">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      {counts ? (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-amber-500" />
            <span className="text-muted-foreground">Wartend:</span>
            <span className="font-medium">{counts.waiting}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 text-blue-500" />
            <span className="text-muted-foreground">Aktiv:</span>
            <span className="font-medium">{counts.active}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span className="text-muted-foreground">Abgeschlossen:</span>
            <span className="font-medium">{counts.completed}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertCircle className={`w-3 h-3 ${counts.failed > 0 ? "text-rose-500" : "text-muted-foreground"}`} />
            <span className="text-muted-foreground">Fehlgeschlagen:</span>
            <span className={`font-medium ${counts.failed > 0 ? "text-rose-600" : ""}`}>
              {counts.failed}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Laden...
        </div>
      )}
    </GlassCard>
  );
}

// ── Pipeline Dashboard Page ────────────────────────────────────────────────

export default function PipelineDashboardPage() {
  const [pipelineData, setPipelineData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [bulkRetrying, setBulkRetrying] = useState(false);

  const fetchPipelineStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pipeline");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: PipelineData = await res.json();
      setPipelineData(data);
    } catch (err) {
      console.error("Failed to fetch pipeline stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchPipelineStats();
  }, [fetchPipelineStats]);

  // Auto-refresh with 15-second polling
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchPipelineStats, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchPipelineStats]);

  // Retry a single failed document
  const handleRetry = async (dokumentId: string) => {
    setRetrying((prev) => new Set(prev).add(dokumentId));
    try {
      const res = await fetch(`/api/dokumente/${dokumentId}/ocr`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchPipelineStats();
      }
    } catch (err) {
      console.error("Retry failed:", err);
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(dokumentId);
        return next;
      });
    }
  };

  // Bulk retry all failed documents
  const handleBulkRetry = async () => {
    setBulkRetrying(true);
    try {
      const res = await fetch("/api/admin/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry-all-failed" }),
      });
      if (res.ok) {
        await fetchPipelineStats();
      }
    } catch (err) {
      console.error("Bulk retry failed:", err);
    } finally {
      setBulkRetrying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold font-bold">Pipeline-Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm text-muted-foreground">
              Auto-Refresh
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPipelineStats}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Queue cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QueueCard
          title="OCR"
          icon={FileText}
          counts={pipelineData?.queues.ocr}
        />
        <QueueCard
          title="Embedding"
          icon={Cpu}
          counts={pipelineData?.queues.embedding}
        />
        <QueueCard
          title="Preview"
          icon={Search}
          counts={pipelineData?.queues.preview}
        />
      </div>

      {/* Status distribution */}
      {pipelineData?.statusDistribution && (
        <GlassPanel elevation="panel" className="p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Dokumentstatus-Verteilung</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(pipelineData.statusDistribution).map(([status, count]) => {
              const config = STATUS_LABELS[status] || {
                label: status,
                color: "bg-slate-100 text-slate-700",
              };
              return (
                <Badge
                  key={status}
                  variant="outline"
                  className={`${config.color} border-0 px-3 py-1`}
                >
                  {config.label}: {count}
                </Badge>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Failed documents table */}
      <GlassPanel elevation="panel" className="overflow-hidden">
        <div className="p-4 border-b border-[var(--glass-border-color)] flex flex-row items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Fehlgeschlagene Dokumente
            {pipelineData?.failedDocuments && pipelineData.failedDocuments.length > 0 && (
              <span className="ml-2 text-rose-600">
                ({pipelineData.failedDocuments.length})
              </span>
            )}
          </h2>
          {pipelineData?.failedDocuments && pipelineData.failedDocuments.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkRetry}
              disabled={bulkRetrying}
              className="text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              {bulkRetrying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Alle wiederholen
            </Button>
          )}
        </div>
        <div className="p-4">
          {!pipelineData ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Laden...
            </div>
          ) : pipelineData.failedDocuments.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Keine fehlgeschlagenen Dokumente
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Dokument</th>
                    <th className="pb-2 pr-4 font-medium">Fehler</th>
                    <th className="pb-2 pr-4 font-medium">Versuche</th>
                    <th className="pb-2 pr-4 font-medium">Akte</th>
                    <th className="pb-2 pr-4 font-medium">Aktualisiert</th>
                    <th className="pb-2 font-medium">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelineData.failedDocuments.map((doc) => (
                    <tr key={doc.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-4">
                        <span className="font-medium truncate block max-w-[200px]" title={doc.name}>
                          {doc.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{doc.mimeType}</span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className="text-rose-600 truncate block max-w-[250px]"
                          title={doc.ocrFehler || ""}
                        >
                          {doc.ocrFehler || "-"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-center">{doc.ocrVersuche}</td>
                      <td className="py-2.5 pr-4">
                        {doc.akte ? (
                          <span className="truncate block max-w-[150px]" title={doc.akte.aktenzeichen}>
                            {doc.akte.aktenzeichen}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {formatDate(doc.updatedAt)}
                      </td>
                      <td className="py-2.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(doc.id)}
                          disabled={retrying.has(doc.id)}
                        >
                          {retrying.has(doc.id) ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          <span className="ml-1.5">Wiederholen</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
