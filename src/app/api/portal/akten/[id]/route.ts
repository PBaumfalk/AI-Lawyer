import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { requireMandantAkteAccess } from "@/lib/portal-access";
import { prisma } from "@/lib/db";

// GET /api/portal/akten/[id] -- Akte detail for Mandant portal
// Returns: sachgebiet, status, kurzrubrum, wegen, aktenzeichen, naechsteSchritte,
//          Gegner name, Gericht name
// Does NOT expose: anwaltId, sachbearbeiterId, kanzleiId, gegenstandswert, falldaten, meta
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { session } = authResult;

  // Only MANDANT users may access portal endpoints
  if ((session.user as any).role !== "MANDANT") {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    );
  }

  // Verify Mandant access to this specific Akte (returns 404 if unauthorized)
  const access = await requireMandantAkteAccess(akteId, session.user.id);
  if (access.error) return access.error;

  try {
    const akte = await prisma.akte.findUnique({
      where: { id: akteId },
      select: {
        id: true,
        aktenzeichen: true,
        kurzrubrum: true,
        wegen: true,
        sachgebiet: true,
        status: true,
        naechsteSchritte: true,
        // Gegner info (name only)
        beteiligte: {
          where: { rolle: "GEGNER" },
          select: {
            kontakt: {
              select: {
                vorname: true,
                nachname: true,
                firma: true,
              },
            },
          },
        },
      },
    });

    if (!akte) {
      return NextResponse.json(
        { error: "Nicht gefunden" },
        { status: 404 }
      );
    }

    // Also fetch Gericht separately (different rolle)
    const gerichtBeteiligte = await prisma.beteiligter.findMany({
      where: { akteId, rolle: "GERICHT" },
      select: {
        kontakt: {
          select: {
            firma: true,
          },
        },
      },
    });

    // Transform Beteiligte into display-friendly format
    const gegner = akte.beteiligte.map((b) => ({
      vorname: b.kontakt.vorname,
      nachname: b.kontakt.nachname,
      firma: b.kontakt.firma,
    }));

    const gerichte = gerichtBeteiligte.map((b) => ({
      name: b.kontakt.firma,
    }));

    return NextResponse.json({
      id: akte.id,
      aktenzeichen: akte.aktenzeichen,
      kurzrubrum: akte.kurzrubrum,
      wegen: akte.wegen,
      sachgebiet: akte.sachgebiet,
      status: akte.status,
      naechsteSchritte: akte.naechsteSchritte,
      gegner,
      gerichte,
    });
  } catch (error) {
    console.error("[PORTAL] Error fetching Akte detail:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Akte" },
      { status: 500 }
    );
  }
}
