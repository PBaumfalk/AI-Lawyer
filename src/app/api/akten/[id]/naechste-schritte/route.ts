import { NextRequest, NextResponse } from "next/server";
import { requireAkteAccess } from "@/lib/rbac";
import { prisma } from "@/lib/db";

// PUT /api/akten/[id]/naechste-schritte -- Anwalt sets next steps text for Mandant
// Uses standard requireAkteAccess (internal staff access, not portal)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  // RBAC: check Akte access (Anwalt/internal staff only)
  const access = await requireAkteAccess(akteId);
  if (access.error) return access.error;

  const { session } = access;

  try {
    const body = await request.json();
    const text = body?.text;

    if (text !== undefined && typeof text !== "string") {
      return NextResponse.json(
        { error: "Text muss ein String sein" },
        { status: 400 }
      );
    }

    // Update naechsteSchritte on the Akte
    const updatedAkte = await prisma.akte.update({
      where: { id: akteId },
      data: { naechsteSchritte: text || null },
      select: {
        id: true,
        naechsteSchritte: true,
      },
    });

    // Create a mandant-visible activity so Mandant sees when next steps are updated
    await prisma.aktenActivity.create({
      data: {
        akteId,
        userId: session.user.id,
        typ: "STATUS_CHANGE",
        titel: "Naechste Schritte aktualisiert",
        inhalt: text || null,
        mandantSichtbar: true,
      },
    });

    return NextResponse.json(updatedAkte);
  } catch (error) {
    console.error("[AKTEN] Error updating naechste Schritte:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren der naechsten Schritte" },
      { status: 500 }
    );
  }
}
