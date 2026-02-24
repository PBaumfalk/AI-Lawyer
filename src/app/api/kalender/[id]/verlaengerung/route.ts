import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";
import {
  berechneFrist,
  berechneVorfristen,
  berechneHalbfrist,
} from "@/lib/fristen";
import type { BundeslandCode, FristArt, FristDauer } from "@/lib/fristen";

const verlaengerungSchema = z.object({
  neueDauer: z.object({
    tage: z.number().int().min(0).optional(),
    wochen: z.number().int().min(0).optional(),
    monate: z.number().int().min(0).optional(),
    jahre: z.number().int().min(0).optional(),
  }),
  grund: z.string().optional(),
});

/**
 * POST /api/kalender/[id]/verlaengerung - Extend a deadline
 *
 * Old Fristende stays in fristHistorie. New end date is recalculated.
 * All Vorfristen and Halbfrist are recalculated. Child Vorfrist entries
 * are marked as erledigt (veraltet).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = verlaengerungSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const eintrag = await prisma.kalenderEintrag.findUnique({
    where: { id },
    include: { vorfristEintraege: true },
  });

  if (!eintrag) {
    return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
  }

  if (eintrag.typ !== "FRIST") {
    return NextResponse.json(
      { error: "Verlaengerung ist nur fuer Fristen moeglich" },
      { status: 400 }
    );
  }

  if (eintrag.istNotfrist) {
    return NextResponse.json(
      { error: "Notfristen koennen nicht verlaengert werden" },
      { status: 400 }
    );
  }

  if (eintrag.erledigt) {
    return NextResponse.json(
      { error: "Erledigte Fristen koennen nicht verlaengert werden" },
      { status: 400 }
    );
  }

  const neueDauer: FristDauer = parsed.data.neueDauer;
  const bundesland = (eintrag.bundesland ?? "NW") as BundeslandCode;
  const fristArt = (eintrag.fristArt ?? "EREIGNISFRIST") as FristArt;

  // Calculate new end date using the existing start date
  const neuesErgebnis = berechneFrist({
    zustellungsdatum: eintrag.datum,
    fristArt,
    dauer: neueDauer,
    bundesland,
    section193: true,
  });

  // Calculate new Vorfristen
  const neueVorfristen = berechneVorfristen(neuesErgebnis.endDatum, [7, 3, 1], bundesland);
  const neueHalbfrist = berechneHalbfrist(
    neuesErgebnis.startDatum,
    neuesErgebnis.endDatum,
    bundesland
  );

  // Preserve old end date in fristHistorie
  const historie = Array.isArray(eintrag.fristHistorie) ? [...(eintrag.fristHistorie as any[])] : [];
  historie.push({
    altesEnde: eintrag.fristablauf?.toISOString() ?? eintrag.datum.toISOString(),
    neuesEnde: neuesErgebnis.endDatum.toISOString(),
    grund: parsed.data.grund ?? "Fristverlaengerung",
    datum: new Date().toISOString(),
  });

  // Mark old Vorfrist child entries as erledigt (veraltet)
  if (eintrag.vorfristEintraege.length > 0) {
    await prisma.kalenderEintrag.updateMany({
      where: {
        hauptfristId: id,
        erledigt: false,
      },
      data: {
        erledigt: true,
        erledigtAm: new Date(),
        erledigungsgrund: "Frist verlaengert",
      },
    });
  }

  // Update the main entry
  const updated = await prisma.kalenderEintrag.update({
    where: { id },
    data: {
      fristablauf: neuesErgebnis.endDatum,
      vorfristen: neueVorfristen.map((v) => v.datum),
      halbfrist: neueHalbfrist,
      fristHistorie: historie,
    },
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      verantwortlich: { select: { id: true, name: true } },
    },
  });

  // Create new child Vorfrist entries
  const vorfristEntries = neueVorfristen.map((vf, idx) => ({
    typ: "FRIST" as const,
    titel: `Vorfrist ${idx + 1}: ${eintrag.titel}`,
    datum: vf.datum,
    ganztaegig: true,
    verantwortlichId: eintrag.verantwortlichId,
    akteId: eintrag.akteId ?? null,
    hauptfristId: id,
    prioritaet: eintrag.prioritaet,
    istNotfrist: false,
  }));

  if (vorfristEntries.length > 0) {
    await prisma.kalenderEintrag.createMany({ data: vorfristEntries });
  }

  await logAuditEvent({
    userId: session.user.id,
    akteId: eintrag.akteId ?? undefined,
    aktion: "KALENDER_BEARBEITET",
    details: {
      kalenderId: id,
      titel: eintrag.titel,
      aenderung: "Fristverlaengerung",
      altesEnde: eintrag.fristablauf?.toISOString() ?? eintrag.datum.toISOString(),
      neuesEnde: neuesErgebnis.endDatum.toISOString(),
      grund: parsed.data.grund ?? "Fristverlaengerung",
    },
  });

  return NextResponse.json({
    eintrag: updated,
    neueVorfristen,
    neueHalbfrist,
  });
}
