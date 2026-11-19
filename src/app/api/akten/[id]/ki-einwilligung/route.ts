/**
 * GET/PUT /api/akten/[id]/ki-einwilligung
 *
 * Records the Mandant's consent to AI processing via external service
 * providers (foreign models: § 43e Abs. 4 BRAO). Only ANWALT and ADMIN may change it; every
 * change is written to the audit log with old and new value.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAkteAccess } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";

const schema = z.object({ einwilligung: z.enum(["KEINE", "DE_MODELLE", "FREMDMODELLE"]) });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAkteAccess(id);
  if (access.error) return access.error;
  const akte = await prisma.akte.findUnique({
    where: { id },
    select: { kiEinwilligung: true, kiEinwilligungAm: true, kiEinwilligungErfasstVon: true },
  });
  return NextResponse.json(akte);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAkteAccess(id, { requireEdit: true });
  if (access.error) return access.error;
  if (!["ANWALT", "ADMIN"].includes(access.session.user.role)) {
    return NextResponse.json({ error: "Nur Anwältinnen und Anwälte können die Einwilligung vermerken" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültiger Wert" }, { status: 400 });

  const vorher = await prisma.akte.findUnique({ where: { id }, select: { kiEinwilligung: true } });
  const akte = await prisma.akte.update({
    where: { id },
    data: {
      kiEinwilligung: parsed.data.einwilligung,
      kiEinwilligungAm: new Date(),
      kiEinwilligungErfasstVon: access.session.user.id,
    },
    select: { kiEinwilligung: true, kiEinwilligungAm: true, kiEinwilligungErfasstVon: true },
  });
  await logAuditEvent({
    userId: access.session.user.id,
    akteId: id,
    aktion: "KI_EINWILLIGUNG_GEAENDERT",
    details: { vorher: vorher?.kiEinwilligung, nachher: akte.kiEinwilligung },
  });
  return NextResponse.json(akte);
}
