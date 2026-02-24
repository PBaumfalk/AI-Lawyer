import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Only ADMIN and ANWALT roles may approve/revoke templates */
const FREIGABE_ROLES = new Set(["ADMIN", "ANWALT"]);

/**
 * POST /api/vorlagen/[id]/freigabe -- approve (freigeben) a template
 * Only ADMIN or ANWALT roles allowed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const userRole = (session.user as any).role as string;
  if (!FREIGABE_ROLES.has(userRole)) {
    return NextResponse.json(
      { error: "Nur ADMIN oder ANWALT duerfen Vorlagen freigeben" },
      { status: 403 }
    );
  }

  const { id } = await params;

  const vorlage = await prisma.dokumentVorlage.findUnique({ where: { id } });
  if (!vorlage) {
    return NextResponse.json(
      { error: "Vorlage nicht gefunden" },
      { status: 404 }
    );
  }

  if (vorlage.freigegeben) {
    return NextResponse.json(
      { error: "Vorlage ist bereits freigegeben" },
      { status: 400 }
    );
  }

  const updated = await prisma.dokumentVorlage.update({
    where: { id },
    data: {
      freigegeben: true,
      freigegebenVonId: session.user.id!,
      freigegebenAm: new Date(),
    },
    include: {
      createdBy: { select: { name: true } },
      freigegebenVon: { select: { name: true } },
    },
  });

  return NextResponse.json({ vorlage: updated });
}

/**
 * DELETE /api/vorlagen/[id]/freigabe -- revoke Freigabe
 * Only ADMIN or ANWALT roles allowed.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const userRole = (session.user as any).role as string;
  if (!FREIGABE_ROLES.has(userRole)) {
    return NextResponse.json(
      { error: "Nur ADMIN oder ANWALT duerfen Freigaben zurueckziehen" },
      { status: 403 }
    );
  }

  const { id } = await params;

  const vorlage = await prisma.dokumentVorlage.findUnique({ where: { id } });
  if (!vorlage) {
    return NextResponse.json(
      { error: "Vorlage nicht gefunden" },
      { status: 404 }
    );
  }

  if (!vorlage.freigegeben) {
    return NextResponse.json(
      { error: "Vorlage ist nicht freigegeben" },
      { status: 400 }
    );
  }

  const updated = await prisma.dokumentVorlage.update({
    where: { id },
    data: {
      freigegeben: false,
      freigegebenVonId: null,
      freigegebenAm: null,
    },
    include: {
      createdBy: { select: { name: true } },
    },
  });

  return NextResponse.json({ vorlage: updated });
}
