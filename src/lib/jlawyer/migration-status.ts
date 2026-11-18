/**
 * Shared contract + persistence for the j-lawyer migration run state.
 *
 * Imported by the API routes (/api/admin/jlawyer, /api/admin/jlawyer/migrate)
 * and by the admin page, so TypeScript flags any drift between them.
 * Client components may import the types and pure helpers only — the
 * DB helpers live in migration-lock.ts (server only).
 */
import type { JLawyerMigrationIssue, JLawyerMigrationStats } from "./types";

export type MigrationStatusWert = "idle" | "running" | "done" | "error";

/** GET /api/admin/jlawyer/migrate */
export interface MigrationStatusResponse {
  status: MigrationStatusWert;
  startedAt: string | null;
  finishedAt: string | null;
  /** Always a complete report object (never a bare {error}) or null before the first run. */
  report: JLawyerMigrationStats | null;
  /** Reason why the last run ended without finishing, if any. */
  abbruch: string | null;
}

/** POST /api/admin/jlawyer/migrate */
export type MigrationStartResponse =
  | { success: true; report: JLawyerMigrationStats }
  | { success?: false; error: string; report?: JLawyerMigrationStats };

/** Selectable user for the Standard-Verantwortlicher. */
export interface JLawyerBenutzerOption {
  id: string;
  name: string;
  role: string;
}

/** GET /api/admin/jlawyer */
export interface JLawyerConfigResponse {
  url: string;
  username: string;
  hasPassword: boolean;
  standardVerantwortlicherId: string | null;
  benutzer: JLawyerBenutzerOption[];
}

/** POST /api/admin/jlawyer */
export interface JLawyerConfigRequest {
  url?: string;
  username?: string;
  password?: string;
  /** "" clears the setting (fallback: the admin who starts the migration) */
  standardVerantwortlicherId?: string;
}

export function leererBericht(): JLawyerMigrationStats {
  return { akten: 0, kontakte: 0, beteiligte: 0, dokumente: 0, kalender: 0, errors: [], hinweise: [] };
}

function issues(v: unknown): JLawyerMigrationIssue[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((i) => i && typeof i === "object")
    .map((i: any) => ({
      entity: String(i.entity ?? ""),
      id: String(i.id ?? ""),
      message: String(i.message ?? ""),
    }));
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Parse a stored report. Accepts legacy values written by older versions
 * (e.g. `{"error":"..."}` after a failed run) and broken JSON, always
 * returning a complete report so the UI can rely on `errors`/`hinweise`.
 */
export function normalizeReport(raw: string | null | undefined): JLawyerMigrationStats | null {
  if (!raw) return null;
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...leererBericht(), errors: [{ entity: "Migration", id: "-", message: "Bericht nicht lesbar" }] };
  }
  if (!data || typeof data !== "object") return null;
  const report: JLawyerMigrationStats = {
    akten: num(data.akten),
    kontakte: num(data.kontakte),
    beteiligte: num(data.beteiligte),
    dokumente: num(data.dokumente),
    kalender: num(data.kalender),
    errors: issues(data.errors),
    hinweise: issues(data.hinweise),
  };
  if (typeof data.error === "string" && data.error) {
    report.errors.push({ entity: "Migration", id: "-", message: data.error });
  }
  return report;
}
