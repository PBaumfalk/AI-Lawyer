import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";

const assignSchema = z.object({
  userId: z.string().cuid("Ungültige Benutzer-ID"),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  if ((session.user as any).role !== "ADMIN") {
    return Response.json({ error: "Nur Administratoren" }, { status: 403 });
  }

  const { id } = await params;

  const zuweisungen = await prisma.emailKontoZuweisung.findMany({
    where: { kontoId: id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(zuweisungen);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  if ((session.user as any).role !== "ADMIN") {
    return Response.json({ error: "Nur Administratoren" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = assignSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Ungültige Eingabe", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });

  if (!user) {
    return Response.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  // Verify konto exists
  const konto = await prisma.emailKonto.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!konto) {
    return Response.json({ error: "E-Mail-Konto nicht gefunden" }, { status: 404 });
  }

  // Check for existing assignment (unique constraint)
  const existing = await prisma.emailKontoZuweisung.findUnique({
    where: { kontoId_userId: { kontoId: id, userId: parsed.data.userId } },
  });

  if (existing) {
    return Response.json({ error: "Benutzer ist bereits zugewiesen" }, { status: 409 });
  }

  const zuweisung = await prisma.emailKontoZuweisung.create({
    data: {
      kontoId: id,
      userId: parsed.data.userId,
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return Response.json(zuweisung, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  if ((session.user as any).role !== "ADMIN") {
    return Response.json({ error: "Nur Administratoren" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId Parameter erforderlich" }, { status: 400 });
  }

  await prisma.emailKontoZuweisung.deleteMany({
    where: { kontoId: id, userId },
  });

  return new Response(null, { status: 204 });
}
