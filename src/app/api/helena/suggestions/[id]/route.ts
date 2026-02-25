/**
 * GET/PATCH /api/helena/suggestions/[id]
 *
 * GET: Return a single suggestion with full inhalt.
 * PATCH: Update status, feedback, or readAt.
 *   - UEBERNOMMEN: Creates real entities (KalenderEintrag, Beteiligter, Draft).
 *   - ABGELEHNT: Just updates status.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;

  const suggestion = await prisma.helenaSuggestion.findUnique({
    where: { id },
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
    },
  });

  if (!suggestion) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  // Auth check: user owns the suggestion
  if (suggestion.userId !== session.user.id) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  // Mark as read on first access
  if (!suggestion.readAt) {
    await prisma.helenaSuggestion.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json(suggestion);
}

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, feedback } = body;

  const suggestion = await prisma.helenaSuggestion.findUnique({
    where: { id },
  });

  if (!suggestion) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  if (suggestion.userId !== session.user.id) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const updateData: any = {};
  let linkedId: string | null = null;
  let linkedType: string | null = null;

  // Handle status transitions
  if (status) {
    updateData.status = status;

    if (status === "UEBERNOMMEN") {
      try {
        const result = await acceptSuggestion(suggestion);
        if (result) {
          linkedId = result.linkedId;
          linkedType = result.linkedType;
          updateData.linkedId = linkedId;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: `Uebernahme fehlgeschlagen: ${errMsg}` },
          { status: 500 }
        );
      }
    }
  }

  // Handle feedback
  if (feedback) {
    updateData.feedback = feedback;
  }

  const updated = await prisma.helenaSuggestion.update({
    where: { id },
    data: updateData,
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
    },
  });

  return NextResponse.json({
    suggestion: updated,
    linkedId,
    linkedType,
  });
}

// ---------------------------------------------------------------------------
// Accept logic per suggestion type
// ---------------------------------------------------------------------------

async function acceptSuggestion(
  suggestion: {
    id: string;
    typ: string;
    inhalt: string;
    akteId: string | null;
    userId: string;
    linkedId: string | null;
    titel: string;
  }
): Promise<{ linkedId: string; linkedType: string } | null> {
  switch (suggestion.typ) {
    case "FRIST_ERKANNT": {
      // If we already have a linked KalenderEintrag (created as ENTWURF), mark it as active
      if (suggestion.linkedId) {
        await prisma.kalenderEintrag.update({
          where: { id: suggestion.linkedId },
          data: { prioritaet: "HOCH" }, // Confirm the draft entry
        });
        return { linkedId: suggestion.linkedId, linkedType: "KalenderEintrag" };
      }

      // Parse inhalt to create a new KalenderEintrag
      try {
        const data = JSON.parse(suggestion.inhalt);
        let datum = new Date();
        if (data.datum) {
          const parsed = new Date(data.datum);
          if (!isNaN(parsed.getTime())) datum = parsed;
        }

        const eintrag = await prisma.kalenderEintrag.create({
          data: {
            akteId: suggestion.akteId,
            typ: "FRIST",
            titel: data.beschreibung || suggestion.titel,
            beschreibung: `Erstellt aus Helena-Vorschlag.\n${data.gesetzlicheGrundlage ? `Grundlage: ${data.gesetzlicheGrundlage}` : ""}`,
            datum,
            fristablauf: datum,
            verantwortlichId: suggestion.userId,
            prioritaet: "HOCH",
            fristArt: data.fristtyp === "UNBESTIMMT" ? null : data.fristtyp,
            erledigt: false,
          },
        });
        return { linkedId: eintrag.id, linkedType: "KalenderEintrag" };
      } catch {
        return null;
      }
    }

    case "BETEILIGTE_ERKANNT": {
      if (!suggestion.akteId) return null;

      try {
        const parties = JSON.parse(suggestion.inhalt);
        if (!Array.isArray(parties) || parties.length === 0) return null;

        // Create Kontakt + Beteiligter for the first party as an example
        // (In practice, the user would review all parties in an edit dialog)
        const firstParty = parties[0];

        // Map AI role to BeteiligterRolle
        const roleMap: Record<string, string> = {
          KLAEGER: "MANDANT",
          BEKLAGTER: "GEGNER",
          ZEUGE: "ZEUGE",
          RICHTER: "SONSTIGER",
          ANWALT: "GEGNERVERTRETER",
          SACHVERSTAENDIGER: "SACHVERSTAENDIGER",
          BEHOERDE: "SONSTIGER",
          SONSTIG: "SONSTIGER",
        };

        const kontakt = await prisma.kontakt.create({
          data: {
            typ: firstParty.typ === "JURISTISCH" ? "JURISTISCH" : "NATUERLICH",
            ...(firstParty.typ === "JURISTISCH"
              ? { firma: firstParty.name }
              : {
                  nachname: firstParty.name.split(" ").pop() || firstParty.name,
                  vorname: firstParty.name.split(" ").slice(0, -1).join(" ") || undefined,
                }),
          },
        });

        const beteiligter = await prisma.beteiligter.create({
          data: {
            akteId: suggestion.akteId,
            kontaktId: kontakt.id,
            rolle: (roleMap[firstParty.rolle] || "SONSTIGER") as any,
            notizen: `Automatisch von Helena erkannt (Confidence: ${firstParty.confidence})`,
          },
        });

        return { linkedId: beteiligter.id, linkedType: "Beteiligter" };
      } catch {
        return null;
      }
    }

    case "ANTWORT_ENTWURF": {
      // Create a ChatNachricht as draft (requires akteId)
      if (!suggestion.akteId) return null;
      try {
        const nachricht = await prisma.chatNachricht.create({
          data: {
            akteId: suggestion.akteId,
            userId: null, // AI-generated (system)
            nachricht: suggestion.inhalt,
          },
        });
        return { linkedId: nachricht.id, linkedType: "ChatNachricht" };
      } catch {
        return null;
      }
    }

    default:
      return null;
  }
}
