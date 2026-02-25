import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

// ─── Validation ──────────────────────────────────────────────────────────────

const patchSchema = z.object({
  akteId: z.string().nullable().optional(),
  status: z.enum(["EINGANG", "GELESEN", "ZUGEORDNET", "GESENDET", "FEHLER"]).optional(),
  eebStatus: z.string().optional(),
});

// ─── GET /api/bea/messages/[id] ──────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;

  const nachricht = await prisma.beaNachricht.findUnique({
    where: { id },
    include: {
      akte: {
        select: { id: true, aktenzeichen: true, kurzrubrum: true },
      },
    },
  });

  if (!nachricht) {
    return NextResponse.json({ error: "Nachricht nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json(nachricht);
}

// ─── PATCH /api/bea/messages/[id] ────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.beaNachricht.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Nachricht nicht gefunden" }, { status: 404 });
  }

  const updateData: any = {};
  if (parsed.data.akteId !== undefined) {
    updateData.akteId = parsed.data.akteId;
    // If assigning to an Akte, set status to ZUGEORDNET
    if (parsed.data.akteId && !parsed.data.status) {
      updateData.status = "ZUGEORDNET";
    }
  }
  if (parsed.data.status) {
    updateData.status = parsed.data.status;
  }
  if (parsed.data.eebStatus) {
    updateData.eebStatus = parsed.data.eebStatus;
  }

  const nachricht = await prisma.beaNachricht.update({
    where: { id },
    data: updateData,
    include: {
      akte: {
        select: { id: true, aktenzeichen: true, kurzrubrum: true },
      },
    },
  });

  return NextResponse.json(nachricht);
}
