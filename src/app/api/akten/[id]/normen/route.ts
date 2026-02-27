import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAkteAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const addNormSchema = z.object({
  gesetzKuerzel: z.string().min(1, "Gesetzkuerzel ist erforderlich"),
  paragraphNr: z.string().min(1, "Paragraph-Nummer ist erforderlich"),
  anmerkung: z.string().optional(),
});

// GET /api/akten/[id]/normen -- list all pinned normen for an Akte
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  const access = await requireAkteAccess(akteId);
  if (access.error) return access.error;

  const normen = await prisma.akteNorm.findMany({
    where: { akteId },
    include: {
      addedBy: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(normen);
}

// POST /api/akten/[id]/normen -- pin a norm to an Akte
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  const access = await requireAkteAccess(akteId, { requireEdit: true });
  if (access.error) return access.error;
  const { session } = access;

  const body = await request.json();
  const parsed = addNormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { gesetzKuerzel, paragraphNr, anmerkung } = parsed.data;

  // Verify the law_chunk exists
  const lawChunk = await prisma.lawChunk.findFirst({
    where: { gesetzKuerzel, paragraphNr },
  });

  if (!lawChunk) {
    return NextResponse.json(
      { error: "Norm nicht gefunden" },
      { status: 404 }
    );
  }

  // Check for duplicate — return 409 if already pinned
  const existing = await prisma.akteNorm.findUnique({
    where: {
      akteId_gesetzKuerzel_paragraphNr: {
        akteId,
        gesetzKuerzel,
        paragraphNr,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Diese Norm ist bereits an die Akte verknuepft" },
      { status: 409 }
    );
  }

  const norm = await prisma.akteNorm.create({
    data: {
      akteId,
      gesetzKuerzel,
      paragraphNr,
      anmerkung: anmerkung ?? null,
      addedById: session.user.id,
    },
    include: {
      addedBy: {
        select: { name: true },
      },
    },
  });

  await logAuditEvent({
    userId: session.user.id,
    akteId,
    aktion: "NORM_VERKNUEPFT",
    details: { gesetzKuerzel, paragraphNr },
  });

  return NextResponse.json(norm, { status: 201 });
}
