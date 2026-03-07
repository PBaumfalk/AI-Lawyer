import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { JLawyerClient } from "@/lib/jlawyer/client";
import { migrateAkten } from "@/lib/jlawyer/etl-akten";
import { migrateKontakte, migrateBeteiligte } from "@/lib/jlawyer/etl-kontakte";
import { migrateDokumente } from "@/lib/jlawyer/etl-dokumente";
import { migrateKalender } from "@/lib/jlawyer/etl-kalender";
import type { JLawyerMigrationStats } from "@/lib/jlawyer/types";

// GET — return current migration status and report
export async function GET() {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          "jlawyer.migration.status",
          "jlawyer.migration.report",
          "jlawyer.migration.startedAt",
          "jlawyer.migration.finishedAt",
        ],
      },
    },
  });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const status = map["jlawyer.migration.status"] ?? "idle";
  const report = map["jlawyer.migration.report"]
    ? (JSON.parse(map["jlawyer.migration.report"]) as JLawyerMigrationStats)
    : null;

  return NextResponse.json({
    status,
    startedAt: map["jlawyer.migration.startedAt"] ?? null,
    finishedAt: map["jlawyer.migration.finishedAt"] ?? null,
    report,
  });
}

async function upsertSetting(key: string, value: string) {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value, type: "string", category: "jlawyer" },
    update: { value },
  });
}

// POST — trigger migration
export async function POST() {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  // Load credentials
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ["jlawyer.url", "jlawyer.username", "jlawyer.password"] } },
  });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  if (!map["jlawyer.url"] || !map["jlawyer.username"] || !map["jlawyer.password"]) {
    return NextResponse.json(
      { error: "J-Lawyer Verbindungsdaten nicht konfiguriert" },
      { status: 400 }
    );
  }

  // Prevent concurrent runs
  const currentStatus = await prisma.systemSetting.findUnique({
    where: { key: "jlawyer.migration.status" },
  });
  if (currentStatus?.value === "running") {
    return NextResponse.json({ error: "Migration läuft bereits" }, { status: 409 });
  }

  await upsertSetting("jlawyer.migration.status", "running");
  await upsertSetting("jlawyer.migration.startedAt", new Date().toISOString());

  try {
    const client = new JLawyerClient({
      baseUrl: map["jlawyer.url"],
      username: map["jlawyer.username"],
      password: map["jlawyer.password"],
    });

    // Get kanzleiId from first admin user's kanzleiId
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN", aktiv: true, isSystem: false },
      select: { id: true, kanzleiId: true },
    });
    const kanzleiId = adminUser?.kanzleiId ?? null;

    // Get or create system user for createdById
    const systemUser = await prisma.user.findFirst({
      where: { isSystem: true },
      select: { id: true },
    });
    if (!systemUser) {
      throw new Error("System user not found — required for migration authorship");
    }
    const systemUserId = systemUser.id;

    // Run ETL pipeline in sequence
    const aktenResult = await migrateAkten(client, kanzleiId);
    const aktenMap: Map<string, string> = aktenResult.aktenMap ?? new Map();

    const kontakteResult = await migrateKontakte(client);
    const kontakteMap: Map<string, string> = kontakteResult.kontakteMap ?? new Map();

    const beteiligteResult = await migrateBeteiligte(client, aktenMap, kontakteMap);
    const dokumenteResult = await migrateDokumente(client, aktenMap, systemUserId);
    const kalenderResult = await migrateKalender(client, aktenMap, systemUserId);

    // Aggregate stats
    const report: JLawyerMigrationStats = {
      akten: aktenResult.akten ?? 0,
      kontakte: kontakteResult.kontakte ?? 0,
      beteiligte: beteiligteResult.beteiligte ?? 0,
      dokumente: dokumenteResult.dokumente ?? 0,
      kalender: kalenderResult.kalender ?? 0,
      errors: [
        ...(aktenResult.errors ?? []),
        ...(kontakteResult.errors ?? []),
        ...(beteiligteResult.errors ?? []),
        ...(dokumenteResult.errors ?? []),
        ...(kalenderResult.errors ?? []),
      ],
    };

    await upsertSetting("jlawyer.migration.report", JSON.stringify(report));
    await upsertSetting("jlawyer.migration.status", "done");
    await upsertSetting("jlawyer.migration.finishedAt", new Date().toISOString());

    return NextResponse.json({ success: true, report });
  } catch (e) {
    await upsertSetting("jlawyer.migration.status", "error");
    await upsertSetting("jlawyer.migration.finishedAt", new Date().toISOString());
    await upsertSetting(
      "jlawyer.migration.report",
      JSON.stringify({ error: (e as Error).message })
    );
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
