import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import type { UserRole } from "@prisma/client";

// GET /api/users/[id]/urlaub -- List vacation periods for a user
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

  const zeitraeume = await prisma.urlaubZeitraum.findMany({
    where: { userId },
    orderBy: { von: "desc" },
  });

  return NextResponse.json(zeitraeume);
}

// POST /api/users/[id]/urlaub -- Create vacation period
export async function POST(
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

  // Any authenticated user can manage own vacation. ADMIN can manage anyone's.
  const canEdit =
    currentRole === "ADMIN" || currentUserId === targetUserId;

  if (!canEdit) {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { von, bis, notiz } = body;

  if (!von || !bis) {
    return NextResponse.json(
      { error: "Start- und Enddatum sind erforderlich" },
      { status: 400 }
    );
  }

  const vonDate = new Date(von);
  const bisDate = new Date(bis);

  if (vonDate >= bisDate) {
    return NextResponse.json(
      { error: "Startdatum muss vor dem Enddatum liegen" },
      { status: 400 }
    );
  }

  // Check for overlapping vacation periods
  const overlapping = await prisma.urlaubZeitraum.findFirst({
    where: {
      userId: targetUserId,
      OR: [
        { von: { lte: bisDate }, bis: { gte: vonDate } },
      ],
    },
  });

  if (overlapping) {
    return NextResponse.json(
      { error: "Ueberschneidung mit bestehendem Urlaubszeitraum" },
      { status: 409 }
    );
  }

  const zeitraum = await prisma.urlaubZeitraum.create({
    data: {
      userId: targetUserId,
      von: vonDate,
      bis: bisDate,
      notiz: notiz || null,
    },
  });

  await logAuditEvent({
    userId: currentUserId,
    aktion: "URLAUB_ERSTELLT",
    details: {
      targetUserId,
      von: vonDate.toISOString(),
      bis: bisDate.toISOString(),
      notiz,
    },
  });

  return NextResponse.json(zeitraum, { status: 201 });
}

// DELETE /api/users/[id]/urlaub -- Delete vacation period by zeitraumId query param
export async function DELETE(
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

  const canEdit =
    currentRole === "ADMIN" || currentUserId === targetUserId;

  if (!canEdit) {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const zeitraumId = searchParams.get("zeitraumId");

  if (!zeitraumId) {
    return NextResponse.json(
      { error: "zeitraumId ist erforderlich" },
      { status: 400 }
    );
  }

  // Verify the vacation period belongs to the target user
  const zeitraum = await prisma.urlaubZeitraum.findFirst({
    where: { id: zeitraumId, userId: targetUserId },
  });

  if (!zeitraum) {
    return NextResponse.json(
      { error: "Urlaubszeitraum nicht gefunden" },
      { status: 404 }
    );
  }

  await prisma.urlaubZeitraum.delete({ where: { id: zeitraumId } });

  await logAuditEvent({
    userId: currentUserId,
    aktion: "URLAUB_GELOESCHT",
    details: {
      targetUserId,
      zeitraumId,
      von: zeitraum.von.toISOString(),
      bis: zeitraum.bis.toISOString(),
    },
  });

  return NextResponse.json({ success: true });
}
