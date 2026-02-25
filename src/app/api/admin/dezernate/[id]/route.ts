import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { z } from "zod";

const updateDezernatSchema = z.object({
  name: z.string().min(1).optional(),
  beschreibung: z.string().nullable().optional(),
  addMitglieder: z.array(z.string()).optional(),
  removeMitglieder: z.array(z.string()).optional(),
  addAkten: z.array(z.string()).optional(),
  removeAkten: z.array(z.string()).optional(),
});

// GET /api/admin/dezernate/[id] -- Dezernat detail with members and Akten
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const { id } = await params;

  const dezernat = await prisma.dezernat.findUnique({
    where: { id },
    include: {
      mitglieder: {
        select: { id: true, name: true, email: true, role: true },
      },
      akten: {
        select: { id: true, aktenzeichen: true, kurzrubrum: true, status: true },
      },
      _count: { select: { akten: true, mitglieder: true } },
    },
  });

  if (!dezernat) {
    return NextResponse.json({ error: "Dezernat nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json(dezernat);
}

// PATCH /api/admin/dezernate/[id] -- update Dezernat
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const { id } = await params;
  const body = await request.json();
  const parsed = updateDezernatSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.dezernat.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Dezernat nicht gefunden" }, { status: 404 });
  }

  const updateData: any = {};
  if (parsed.data.name) updateData.name = parsed.data.name;
  if (parsed.data.beschreibung !== undefined) updateData.beschreibung = parsed.data.beschreibung;

  // Handle member additions/removals
  if (parsed.data.addMitglieder?.length) {
    updateData.mitglieder = {
      ...updateData.mitglieder,
      connect: parsed.data.addMitglieder.map((userId) => ({ id: userId })),
    };
  }
  if (parsed.data.removeMitglieder?.length) {
    updateData.mitglieder = {
      ...updateData.mitglieder,
      disconnect: parsed.data.removeMitglieder.map((userId) => ({ id: userId })),
    };
  }

  // Handle Akte additions/removals
  if (parsed.data.addAkten?.length) {
    updateData.akten = {
      ...updateData.akten,
      connect: parsed.data.addAkten.map((akteId) => ({ id: akteId })),
    };
  }
  if (parsed.data.removeAkten?.length) {
    updateData.akten = {
      ...updateData.akten,
      disconnect: parsed.data.removeAkten.map((akteId) => ({ id: akteId })),
    };
  }

  const dezernat = await prisma.dezernat.update({
    where: { id },
    data: updateData,
    include: {
      mitglieder: {
        select: { id: true, name: true, email: true, role: true },
      },
      akten: {
        select: { id: true, aktenzeichen: true, kurzrubrum: true, status: true },
      },
      _count: { select: { akten: true, mitglieder: true } },
    },
  });

  return NextResponse.json(dezernat);
}

// DELETE /api/admin/dezernate/[id] -- delete Dezernat (only if no Akten assigned)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const { id } = await params;

  const dezernat = await prisma.dezernat.findUnique({
    where: { id },
    include: { _count: { select: { akten: true } } },
  });

  if (!dezernat) {
    return NextResponse.json({ error: "Dezernat nicht gefunden" }, { status: 404 });
  }

  if (dezernat._count.akten > 0) {
    return NextResponse.json(
      { error: "Dezernat kann nicht geloescht werden, solange Akten zugewiesen sind" },
      { status: 409 }
    );
  }

  await prisma.dezernat.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
