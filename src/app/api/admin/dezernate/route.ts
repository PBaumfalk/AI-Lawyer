import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { z } from "zod";

const createDezernatSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  beschreibung: z.string().optional(),
});

// GET /api/admin/dezernate -- list all Dezernate with counts
export async function GET() {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;
  const { session } = result;

  const dezernate = await prisma.dezernat.findMany({
    where: { kanzleiId: session.user.kanzleiId },
    include: {
      mitglieder: {
        select: { id: true, name: true, email: true, role: true },
      },
      _count: { select: { akten: true, mitglieder: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(dezernate);
}

// POST /api/admin/dezernate -- create new Dezernat
export async function POST(request: NextRequest) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;
  const { session } = result;

  const body = await request.json();
  const parsed = createDezernatSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const dezernat = await prisma.dezernat.create({
    data: {
      name: parsed.data.name,
      beschreibung: parsed.data.beschreibung || null,
      kanzleiId: session.user.kanzleiId,
    },
    include: {
      mitglieder: {
        select: { id: true, name: true, email: true, role: true },
      },
      _count: { select: { akten: true, mitglieder: true } },
    },
  });

  return NextResponse.json(dezernat, { status: 201 });
}
