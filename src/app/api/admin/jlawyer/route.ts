import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { encryptJLawyerPassword } from "@/lib/jlawyer/credentials";
import { validateJLawyerBaseUrl } from "@/lib/jlawyer/validate-url";
import { STANDARD_VERANTWORTLICHER_KEY } from "@/lib/jlawyer/benutzer";
import type { JLawyerConfigRequest, JLawyerConfigResponse } from "@/lib/jlawyer/migration-status";

/** Users that may carry Akten/Fristen (no system or portal accounts). */
const benutzerWhere = { aktiv: true, isSystem: false, role: { not: "MANDANT" as const } };

// GET — return current config (password masked)
export async function GET() {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const settings = await prisma.systemSetting.findMany({
    where: {
      key: { in: ["jlawyer.url", "jlawyer.username", "jlawyer.password", STANDARD_VERANTWORTLICHER_KEY] },
    },
  });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const benutzer = await prisma.user.findMany({
    where: benutzerWhere,
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  const body: JLawyerConfigResponse = {
    url: map["jlawyer.url"] ?? "",
    username: map["jlawyer.username"] ?? "",
    hasPassword: !!map["jlawyer.password"],
    standardVerantwortlicherId: map[STANDARD_VERANTWORTLICHER_KEY] || null,
    benutzer,
  };
  return NextResponse.json(body);
}

// POST — save credentials
export async function POST(req: NextRequest) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const body = (await req.json().catch(() => null)) as JLawyerConfigRequest | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const { url, username, password, standardVerantwortlicherId } = body;

  const upserts: Array<{ key: string; value: string }> = [];
  if (url !== undefined) {
    // SSRF guard: do not persist URLs the client would later reject
    const validation = validateJLawyerBaseUrl(url);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    upserts.push({ key: "jlawyer.url", value: url });
  }
  if (username !== undefined) upserts.push({ key: "jlawyer.username", value: username });
  if (password !== undefined && password !== "") upserts.push({ key: "jlawyer.password", value: encryptJLawyerPassword(password) });

  if (standardVerantwortlicherId !== undefined) {
    if (standardVerantwortlicherId !== "") {
      const user = await prisma.user.findFirst({
        where: { id: standardVerantwortlicherId, ...benutzerWhere },
        select: { id: true },
      });
      if (!user) {
        return NextResponse.json(
          { error: "Standard-Verantwortlicher muss ein aktiver Kanzlei-Benutzer sein" },
          { status: 400 },
        );
      }
    }
    upserts.push({ key: STANDARD_VERANTWORTLICHER_KEY, value: standardVerantwortlicherId });
  }

  for (const { key, value } of upserts) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, type: "string", category: "jlawyer" },
      update: { value },
    });
  }

  return NextResponse.json({ success: true });
}
