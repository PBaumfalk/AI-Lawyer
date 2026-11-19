/**
 * Server-side run state of the j-lawyer migration (SystemSetting rows).
 *
 * The status row doubles as lease: while a run is active its updatedAt is
 * refreshed every HEARTBEAT_MS. A "running" status whose heartbeat is older
 * than STALE_AFTER_MS belongs to a run that died (server restart, crash,
 * killed request) and no longer blocks new runs.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeReport, type MigrationStatusResponse, type MigrationStatusWert } from "./migration-status";

export const MIGRATION_KEYS = {
  status: "jlawyer.migration.status",
  report: "jlawyer.migration.report",
  startedAt: "jlawyer.migration.startedAt",
  finishedAt: "jlawyer.migration.finishedAt",
} as const;

export const HEARTBEAT_MS = 20_000;
export const STALE_AFTER_MS = 2 * 60_000;

export const ABBRUCH_UNTERBROCHEN =
  "Der letzte Lauf wurde unterbrochen (z. B. Server-Neustart) und nicht abgeschlossen. " +
  "Ein neuer Lauf übernimmt nur noch fehlende Datensätze.";

export async function upsertSetting(key: string, value: string) {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value, type: "string", category: "jlawyer" },
    update: { value },
  });
}

function isStale(row: { value: string; updatedAt: Date } | null, now = Date.now()) {
  return !!row && row.value === "running" && now - row.updatedAt.getTime() > STALE_AFTER_MS;
}

/**
 * Atomically claim the run. Returns { ok: false } while another run is
 * alive; { ok: true, uebernommen: true } when a dead run was taken over.
 */
export async function acquireMigrationLock(): Promise<{ ok: boolean; uebernommen: boolean }> {
  const before = await prisma.systemSetting.findUnique({ where: { key: MIGRATION_KEYS.status } });
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  const claimed = await prisma.systemSetting.updateMany({
    where: {
      key: MIGRATION_KEYS.status,
      OR: [{ value: { not: "running" } }, { updatedAt: { lt: cutoff } }],
    },
    data: { value: "running" },
  });
  if (claimed.count === 1) return { ok: true, uebernommen: isStale(before) };

  try {
    await prisma.systemSetting.create({
      data: { key: MIGRATION_KEYS.status, value: "running", type: "string", category: "jlawyer" },
    });
    return { ok: true, uebernommen: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, uebernommen: false }; // row exists and a live run holds it
    }
    throw e;
  }
}

/** Keep the lease alive while the run is in progress. Returns a stop function. */
export function startHeartbeat(): () => void {
  const timer = setInterval(() => {
    prisma.systemSetting
      .updateMany({ where: { key: MIGRATION_KEYS.status, value: "running" }, data: { value: "running" } })
      .catch((err) => console.error("[jlawyer] heartbeat failed:", err));
  }, HEARTBEAT_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}

export async function readMigrationStatus(): Promise<MigrationStatusResponse> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: Object.values(MIGRATION_KEYS) } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const statusRow = byKey.get(MIGRATION_KEYS.status) ?? null;
  const report = normalizeReport(byKey.get(MIGRATION_KEYS.report)?.value);
  const raw = statusRow?.value ?? "idle";
  let status: MigrationStatusWert =
    raw === "running" || raw === "done" || raw === "error" ? raw : "idle";
  let abbruch: string | null = null;

  if (isStale(statusRow)) {
    status = "error";
    abbruch = ABBRUCH_UNTERBROCHEN;
  } else if (status === "error") {
    abbruch = report?.errors.find((e) => e.entity === "Migration")?.message ?? "Migration fehlgeschlagen";
  }

  return {
    status,
    startedAt: byKey.get(MIGRATION_KEYS.startedAt)?.value ?? null,
    finishedAt: status === "running" ? null : byKey.get(MIGRATION_KEYS.finishedAt)?.value ?? null,
    report: status === "running" ? null : report,
    abbruch,
  };
}
