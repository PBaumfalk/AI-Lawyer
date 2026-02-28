"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";

// --- Types ---

interface MetricDetail {
  value: number;
  threshold: number | null;
  passed: boolean;
}

interface ReleaseGateReport {
  passed: boolean;
  timestamp: string;
  metrics: {
    recallAt5Normen: MetricDetail;
    halluzinationsrate: MetricDetail;
    formaleVollstaendigkeit: MetricDetail;
    mrr: MetricDetail;
    noResultRate: MetricDetail;
  };
  goldsetSize: number;
  dataPoints: number;
  failedMetrics: string[];
}

interface GoldsetQuery {
  id: string;
  description: string;
  schwerpunkt: string;
}

interface GoldsetData {
  queries: GoldsetQuery[];
  count: number;
}

// --- Metric Card ---

function MetricCard({
  label,
  value,
  threshold,
  passed,
  format = "percent",
}: {
  label: string;
  value: number;
  threshold: number | null;
  passed: boolean;
  format?: "percent" | "rate";
}) {
  const displayValue =
    format === "percent"
      ? `${(value * 100).toFixed(1)}%`
      : value.toFixed(3);

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        {passed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <XCircle className="h-4 w-4 text-rose-500" />
        )}
      </div>
      <div className="text-2xl font-bold">{displayValue}</div>
      {threshold !== null && (
        <div className="text-xs text-muted-foreground mt-1">
          Schwellwert: {(threshold * 100).toFixed(0)}%
        </div>
      )}
    </GlassCard>
  );
}

// --- Main Component ---

export function QADashboardContent() {
  const [report, setReport] = useState<ReleaseGateReport | null>(null);
  const [goldset, setGoldset] = useState<GoldsetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [gateRes, goldsetRes] = await Promise.all([
          fetch("/api/admin/qa/release-gate"),
          fetch("/api/admin/qa/goldset"),
        ]);

        if (!gateRes.ok || !goldsetRes.ok) {
          throw new Error("Fehler beim Laden der QA-Daten");
        }

        const [gateData, goldsetData] = await Promise.all([
          gateRes.json(),
          goldsetRes.json(),
        ]);

        setReport(gateData);
        setGoldset(goldsetData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unbekannter Fehler",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">
          Lade QA-Metriken...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 text-rose-500">
          <XCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      </GlassCard>
    );
  }

  if (!report) return null;

  const hasData = report.dataPoints > 0;

  return (
    <div className="space-y-6">
      {/* Release Gate Banner */}
      <GlassCard
        className={`p-6 border-l-4 ${
          report.passed
            ? "border-l-emerald-500 bg-emerald-500/5"
            : hasData
              ? "border-l-rose-500 bg-rose-500/5"
              : "border-l-amber-500 bg-amber-500/5"
        }`}
      >
        <div className="flex items-center gap-3">
          {report.passed ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          ) : hasData ? (
            <XCircle className="h-6 w-6 text-rose-500" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          )}
          <div>
            <h2 className="text-lg font-semibold">
              Release Gate:{" "}
              {report.passed
                ? "BESTANDEN"
                : hasData
                  ? "NICHT BESTANDEN"
                  : "KEINE DATEN"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {hasData
                ? `${report.dataPoints} Datenpunkte, Goldset: ${report.goldsetSize} Queries`
                : "Noch keine Retrieval-Logs vorhanden. Fuehren Sie die Goldset-Evaluation aus, um Metriken zu erhalten."}
            </p>
          </div>
        </div>
        {report.failedMetrics.length > 0 && (
          <div className="mt-3 flex gap-2">
            {report.failedMetrics.map((metric) => (
              <Badge key={metric} variant="destructive">
                {metric}
              </Badge>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          label="Recall@5 Normen"
          value={report.metrics.recallAt5Normen.value}
          threshold={report.metrics.recallAt5Normen.threshold}
          passed={report.metrics.recallAt5Normen.passed}
        />
        <MetricCard
          label="Halluzinationsrate"
          value={report.metrics.halluzinationsrate.value}
          threshold={report.metrics.halluzinationsrate.threshold}
          passed={report.metrics.halluzinationsrate.passed}
        />
        <MetricCard
          label="Formale Vollstaendigkeit"
          value={report.metrics.formaleVollstaendigkeit.value}
          threshold={report.metrics.formaleVollstaendigkeit.threshold}
          passed={report.metrics.formaleVollstaendigkeit.passed}
        />
        <MetricCard
          label="MRR"
          value={report.metrics.mrr.value}
          threshold={report.metrics.mrr.threshold}
          passed={report.metrics.mrr.passed}
          format="rate"
        />
        <MetricCard
          label="No-Result-Rate"
          value={report.metrics.noResultRate.value}
          threshold={report.metrics.noResultRate.threshold}
          passed={report.metrics.noResultRate.passed}
        />
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Datenpunkte
            </span>
          </div>
          <div className="text-2xl font-bold">{report.dataPoints}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Letzte 30 Tage
          </div>
        </GlassCard>
      </div>

      {/* Goldset Queries Table */}
      {goldset && (
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            Goldset Queries ({goldset.count})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    ID
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Beschreibung
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Schwerpunkt
                  </th>
                </tr>
              </thead>
              <tbody>
                {goldset.queries.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b border-border/20 hover:bg-muted/50"
                  >
                    <td className="py-2 px-3 font-mono text-xs">{q.id}</td>
                    <td className="py-2 px-3">{q.description}</td>
                    <td className="py-2 px-3">
                      <Badge variant="outline">{q.schwerpunkt}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
