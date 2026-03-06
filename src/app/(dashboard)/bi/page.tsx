"use client";

import { useState } from "react";
import type { BiFilterParams } from "@/lib/bi/types";
import { useBiKpis, useBiTrends } from "@/hooks/use-bi-data";
import { BiFilters } from "@/components/bi/bi-filters";
import { KpiGrid } from "@/components/bi/kpi-grid";
import { TrendCharts } from "@/components/bi/trend-charts";
import { ExportBar } from "@/components/bi/export-bar";

export default function BiDashboardPage() {
  const [filters, setFilters] = useState<BiFilterParams>({
    zeitraum: "monat",
  });

  const { kpis, loading: kpiLoading, error: kpiError } = useBiKpis(filters);
  const {
    series,
    loading: trendsLoading,
    error: trendsError,
  } = useBiTrends(filters);

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">BI-Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kanzlei-Analytics im Ueberblick
        </p>
      </div>

      {/* Filter bar */}
      <BiFilters filters={filters} onChange={setFilters} />

      {/* Error messages */}
      {kpiError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          KPI-Fehler: {kpiError}
        </div>
      )}
      {trendsError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          Trend-Fehler: {trendsError}
        </div>
      )}

      {/* KPI tiles */}
      <KpiGrid tiles={kpis} loading={kpiLoading} />

      {/* Trend charts */}
      <TrendCharts series={series} loading={trendsLoading} />
    </div>
  );
}
