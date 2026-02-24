import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import type { UserRole } from "@prisma/client";

// GET /api/users/[id]/vertretung -- Return current Vertretung status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const userId = params.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      vertreterId: true,
      vertretungAktiv: true,
      vertretungVon: true,
      vertretungBis: true,
      vertreter: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Benutzer nicht gefunden" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    userId: user.id,
    userName: user.name,
    vertreterId: user.vertreterId,
    vertreterName: user.vertreter?.name ?? null,
    vertreterEmail: user.vertreter?.email ?? null,
    vertretungAktiv: user.vertretungAktiv,
    vertretungVon: user.vertretungVon,
    vertretungBis: user.vertretungBis,
  });
}

// PUT /api/users/[id]/vertretung -- Set or update Vertretung
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const currentUserId = session.user.id;
  const currentRole = (session.user as any).role as UserRole;
  const targetUserId = params.id;

  // Authorization: ADMIN, ANWALT, or the user themselves
  const canEdit =
    currentRole === "ADMIN" ||
    currentRole === "ANWALT" ||
    currentUserId === targetUserId;

  if (!canEdit) {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    return NextResponse.json(
      { error: "Benutzer nicht gefunden" },
      { status: 404 }
    );
  }

  const body = await request.json();
  const { vertreterId, vertretungVon, vertretungBis, aktivieren } = body;

  // Validate Vertreter exists if provided
  if (vertreterId) {
    if (vertreterId === targetUserId) {
      return NextResponse.json(
        { error: "Ein Benutzer kann nicht sein eigener Vertreter sein" },
        { status: 400 }
      );
    }
    const vertreter = await prisma.user.findUnique({
      where: { id: vertreterId },
      select: { id: true, aktiv: true },
    });
    if (!vertreter || !vertreter.aktiv) {
      return NextResponse.json(
        { error: "Vertreter nicht gefunden oder inaktiv" },
        { status: 400 }
      );
    }
  }

  // When activating, check date validity
  if (aktivieren === true) {
    const bis = vertretungBis
      ? new Date(vertretungBis)
      : targetUser.vertretungBis;
    if (bis && bis < new Date()) {
      return NextResponse.json(
        { error: "Vertretungszeitraum liegt in der Vergangenheit" },
        { status: 400 }
      );
    }
    const effVertreter = vertreterId ?? targetUser.vertreterId;
    if (!effVertreter) {
      return NextResponse.json(
        { error: "Kein Vertreter zugewiesen" },
        { status: 400 }
      );
    }
  }

  const updateData: any = {};
  if (vertreterId !== undefined) updateData.vertreterId = vertreterId;
  if (vertretungVon !== undefined)
    updateData.vertretungVon = vertretungVon ? new Date(vertretungVon) : null;
  if (vertretungBis !== undefined)
    updateData.vertretungBis = vertretungBis ? new Date(vertretungBis) : null;
  if (aktivieren !== undefined) updateData.vertretungAktiv = aktivieren;

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: updateData,
    select: {
      id: true,
      name: true,
      vertreterId: true,
      vertretungAktiv: true,
      vertretungVon: true,
      vertretungBis: true,
      vertreter: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  // Audit log
  const aktionTyp = aktivieren === true
    ? "VERTRETUNG_AKTIVIERT"
    : aktivieren === false
      ? "VERTRETUNG_DEAKTIVIERT"
      : "VERTRETUNG_GESETZT";

  await logAuditEvent({
    userId: currentUserId,
    aktion: aktionTyp as any,
    details: {
      targetUserId,
      targetUserName: updated.name,
      vertreterId: updated.vertreterId,
      vertreterName: updated.vertreter?.name,
      vertretungAktiv: updated.vertretungAktiv,
      vertretungVon: updated.vertretungVon,
      vertretungBis: updated.vertretungBis,
    },
  });

  return NextResponse.json({
    userId: updated.id,
    userName: updated.name,
    vertreterId: updated.vertreterId,
    vertreterName: updated.vertreter?.name ?? null,
    vertreterEmail: updated.vertreter?.email ?? null,
    vertretungAktiv: updated.vertretungAktiv,
    vertretungVon: updated.vertretungVon,
    vertretungBis: updated.vertretungBis,
  });
}
