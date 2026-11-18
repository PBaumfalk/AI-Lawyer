import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { JLawyerClient } from "@/lib/jlawyer/client";
import { decryptJLawyerPassword } from "@/lib/jlawyer/credentials";
import { buildBenutzerabgleich } from "@/lib/jlawyer/benutzer";
import { migrateAkten } from "@/lib/jlawyer/etl-akten";
import { migrateKontakte, migrateBeteiligte } from "@/lib/jlawyer/etl-kontakte";
import { migrateDokumente } from "@/lib/jlawyer/etl-dokumente";
import { migrateKalender } from "@/lib/jlawyer/etl-kalender";
import {
  leererBericht,
  type MigrationStartResponse,
  type MigrationStatusResponse,
} from "@/lib/jlawyer/migration-status";
import {
  ABBRUCH_UNTERBROCHEN,
  MIGRATION_KEYS,
  acquireMigrationLock,
  readMigrationStatus,
  startHeartbeat,
  upsertSetting,
} from "@/lib/jlawyer/migration-lock";
import type { JLawyerMigrationStats } from "@/lib/jlawyer/types";

// GET — return current migration status and report
export async function GET() {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const body: MigrationStatusResponse = await readMigrationStatus();
  return NextResponse.json(body);
}

function merge(report: JLawyerMigrationStats, part: Partial<JLawyerMigrationStats>) {
  for (const k of ["akten", "kontakte", "beteiligte", "dokumente", "kalender"] as const) {
    if (typeof part[k] === "number") report[k] += part[k]!;
  }
  report.errors.push(...(part.errors ?? []));
  report.hinweise.push(...(part.hinweise ?? []));
}

// POST — trigger migration
export async function POST() {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;
  const admin = result.session.user;

  // Load credentials
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ["jlawyer.url", "jlawyer.username", "jlawyer.password"] } },
  });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  if (!map["jlawyer.url"] || !map["jlawyer.username"] || !map["jlawyer.password"]) {
    const body: MigrationStartResponse = { error: "J-Lawyer Verbindungsdaten nicht konfiguriert" };
    return NextResponse.json(body, { status: 400 });
  }

  // Prevent concurrent runs (atomic; a dead run's lease expires)
  const lock = await acquireMigrationLock();
  if (!lock.ok) {
    const body: MigrationStartResponse = { error: "Migration läuft bereits" };
    return NextResponse.json(body, { status: 409 });
  }
  const stopHeartbeat = startHeartbeat();

  const report = leererBericht();
  if (lock.uebernommen) {
    report.hinweise.push({ entity: "Migration", id: "-", message: ABBRUCH_UNTERBROCHEN });
  }
  const saveReport = () => upsertSetting(MIGRATION_KEYS.report, JSON.stringify(report));

  try {
    await upsertSetting(MIGRATION_KEYS.startedAt, new Date().toISOString());
    await saveReport();

    const client = new JLawyerClient({
      baseUrl: map["jlawyer.url"],
      username: map["jlawyer.username"],
      password: decryptJLawyerPassword(map["jlawyer.password"]),
    });

    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { id: admin.id },
      select: { id: true, name: true, kanzleiId: true },
    });
    const kanzleiId = adminUser.kanzleiId ?? null;

    const benutzer = await buildBenutzerabgleich(client, adminUser.id, report.hinweise);

    // Run ETL pipeline in sequence; persist partial progress after each step
    const aktenResult = await migrateAkten(client, kanzleiId, benutzer);
    merge(report, aktenResult);
    await saveReport();

    const kontakteResult = await migrateKontakte(client);
    merge(report, kontakteResult);
    await saveReport();

    merge(report, await migrateBeteiligte(client, aktenResult.aktenMap, kontakteResult.kontakteMap));
    await saveReport();

    merge(report, await migrateDokumente(client, aktenResult.aktenMap, adminUser));
    await saveReport();

    merge(
      report,
      await migrateKalender(client, aktenResult.aktenMap, aktenResult.anwaltMap, benutzer),
    );

    await saveReport();
    await upsertSetting(MIGRATION_KEYS.finishedAt, new Date().toISOString());
    await upsertSetting(MIGRATION_KEYS.status, "done");

    const body: MigrationStartResponse = { success: true, report };
    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    report.errors.push({ entity: "Migration", id: "-", message });
    await saveReport();
    await upsertSetting(MIGRATION_KEYS.finishedAt, new Date().toISOString());
    await upsertSetting(MIGRATION_KEYS.status, "error");
    const body: MigrationStartResponse = { error: message, report };
    return NextResponse.json(body, { status: 500 });
  } finally {
    stopHeartbeat();
  }
}
