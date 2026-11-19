// BI Analytics type definitions

/** Filter params accepted by all BI endpoints */
export interface BiFilterParams {
  zeitraum: "monat" | "quartal" | "jahr" | "custom";
  von?: string; // ISO date
  bis?: string; // ISO date
  anwaltId?: string;
  sachgebiet?: string; // Sachgebiet enum value
}

/** Single KPI tile data */
export interface KpiTile {
  id: string; // e.g. "akten-offen"
  label: string; // German display label
  value: number;
  previousValue: number;
  delta: number; // percentage change (positive = up)
  unit?: string; // "EUR", "%", or omit for count
  domain: "akten" | "finanzen" | "fristen" | "helena";
}

/** Full KPI response */
export interface BiKpiResponse {
  tiles: KpiTile[];
  zeitraum: { von: string; bis: string };
  cached: boolean;
}

/** Trend data point */
export interface TrendPoint {
  label: string; // "Jan 2026", "Feb 2026" etc.
  date: string; // ISO date of period start
  value: number;
}

/** Single trend series */
export interface TrendSeries {
  id: string; // e.g. "akten-neuzugang"
  label: string;
  data: TrendPoint[];
  type: "line" | "area";
}

/** Trend response */
export interface BiTrendResponse {
  series: TrendSeries[];
  zeitraum: { von: string; bis: string };
  cached: boolean;
}

/**
 * Source of the "Anwalt" filter dropdown. Shared by the filter component and
 * the integration test so the UI cannot drift to a route that does not exist.
 * /api/users returns a plain array of { id, name, email, role }.
 */
export const BI_ANWALT_OPTIONS_URL = "/api/users?role=ANWALT";
