"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  BiFilterParams,
  BiKpiResponse,
  BiTrendResponse,
  KpiTile,
  TrendSeries,
} from "@/lib/bi/types";

function buildQueryString(filters: BiFilterParams): string {
  const params = new URLSearchParams();
  params.set("zeitraum", filters.zeitraum);
  if (filters.von) params.set("von", filters.von);
  if (filters.bis) params.set("bis", filters.bis);
  if (filters.anwaltId) params.set("anwaltId", filters.anwaltId);
  if (filters.sachgebiet) params.set("sachgebiet", filters.sachgebiet);
  return params.toString();
}

/** Hook to fetch KPI tiles from the BI API */
export function useBiKpis(filters: BiFilterParams) {
  const [kpis, setKpis] = useState<KpiTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKpis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryString(filters);
      const res = await fetch(`/api/bi/kpis?${qs}`);
      if (!res.ok) {
        throw new Error(`KPI-Abfrage fehlgeschlagen (${res.status})`);
      }
      const data: BiKpiResponse = await res.json();
      setKpis(data.tiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setKpis([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  return { kpis, loading, error };
}

/** Hook to fetch trend series from the BI API */
export function useBiTrends(filters: BiFilterParams) {
  const [series, setSeries] = useState<TrendSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryString(filters);
      const res = await fetch(`/api/bi/trends?${qs}`);
      if (!res.ok) {
        throw new Error(`Trend-Abfrage fehlgeschlagen (${res.status})`);
      }
      const data: BiTrendResponse = await res.json();
      setSeries(data.series);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  return { series, loading, error };
}
