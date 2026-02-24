import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import {
  berechneFrist,
  berechneFristRueckwaerts,
  berechneVorfristen,
  berechneHalbfrist,
} from "@/lib/fristen";
import type { BundeslandCode, FristArt, FristDauer } from "@/lib/fristen";

const BUNDESLAENDER: BundeslandCode[] = [
  "BW", "BY", "BE", "BB", "HB", "HE", "HH", "MV",
  "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH",
];

const rechnerSchema = z.object({
  zustellungsdatum: z.string().datetime({ message: "Unguelitges Datumsformat" }),
  fristArt: z.enum(["EREIGNISFRIST", "BEGINNFRIST"]),
  dauer: z.object({
    tage: z.number().int().min(0).optional(),
    wochen: z.number().int().min(0).optional(),
    monate: z.number().int().min(0).optional(),
    jahre: z.number().int().min(0).optional(),
  }),
  bundesland: z.string().refine((v) => BUNDESLAENDER.includes(v as BundeslandCode), {
    message: "Ungueltiges Bundesland",
  }),
  section193: z.boolean().optional().default(true),
  richtung: z.enum(["vorwaerts", "rueckwaerts"]).optional().default("vorwaerts"),
  presetId: z.string().optional(),
  sonderfall: z
    .enum(["OEFFENTLICHE_ZUSTELLUNG", "AUSLANDSZUSTELLUNG_EU"])
    .nullable()
    .optional(),
});

/**
 * POST /api/fristen/rechner - Calculate a legal deadline
 *
 * Supports forward (Zustellung -> Fristende) and backward (Fristende -> Zustellung) calculation.
 * Handles Sonderfaelle: Oeffentliche Zustellung, Auslandszustellung EU.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = rechnerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    zustellungsdatum: zustellungsdatumStr,
    fristArt,
    dauer,
    bundesland,
    section193,
    richtung,
    presetId,
    sonderfall,
  } = parsed.data;

  // Load preset defaults if provided (can be overridden by explicit values)
  let effectiveDauer: FristDauer = { ...dauer };
  let effectiveFristArt: FristArt = fristArt;
  let presetData: any = null;

  if (presetId) {
    const preset = await prisma.fristPreset.findUnique({ where: { id: presetId } });
    if (preset && preset.aktiv) {
      presetData = preset;
      // Only use preset values if not explicitly provided
      if (!dauer.tage && !dauer.wochen && !dauer.monate && !dauer.jahre) {
        effectiveDauer = {
          tage: preset.dauerTage ?? undefined,
          wochen: preset.dauerWochen ?? undefined,
          monate: preset.dauerMonate ?? undefined,
        };
      }
      // FristArt from preset if caller doesn't override
      if (!body.fristArt && preset.fristArt) {
        effectiveFristArt = preset.fristArt as FristArt;
      }
    }
  }

  let zustellungsdatum = new Date(zustellungsdatumStr);

  // Handle Sonderfaelle: adjust zustellungsdatum before calculation
  let sonderfallInfo: { beschreibung: string; zusatzTage: number } | null = null;

  if (sonderfall === "OEFFENTLICHE_ZUSTELLUNG") {
    // Section 188 ZPO: Frist begins 1 month after Aushang
    const originalDatum = new Date(zustellungsdatum);
    zustellungsdatum = new Date(zustellungsdatum);
    zustellungsdatum.setMonth(zustellungsdatum.getMonth() + 1);
    sonderfallInfo = {
      beschreibung: "Oeffentliche Zustellung (Section 188 ZPO): Fristbeginn 1 Monat nach Aushang",
      zusatzTage: Math.round(
        (zustellungsdatum.getTime() - originalDatum.getTime()) / (1000 * 60 * 60 * 24)
      ),
    };
  } else if (sonderfall === "AUSLANDSZUSTELLUNG_EU") {
    // EU-ZustVO: Extended delivery period (+14 days for EU)
    const originalDatum = new Date(zustellungsdatum);
    zustellungsdatum = new Date(zustellungsdatum);
    zustellungsdatum.setDate(zustellungsdatum.getDate() + 14);
    sonderfallInfo = {
      beschreibung:
        "Auslandszustellung (EU-ZustVO): Verlaengerte Zustellungsdauer (+14 Tage EU)",
      zusatzTage: 14,
    };
  }

  const bl = bundesland as BundeslandCode;

  if (richtung === "rueckwaerts") {
    // Backward calculation: zustellungsdatumStr is actually fristende
    const ergebnis = berechneFristRueckwaerts({
      fristende: new Date(zustellungsdatumStr),
      fristArt: effectiveFristArt,
      dauer: effectiveDauer,
      bundesland: bl,
    });

    return NextResponse.json({
      richtung: "rueckwaerts",
      ergebnis,
      preset: presetData
        ? { id: presetData.id, name: presetData.name }
        : null,
      sonderfall: sonderfallInfo,
    });
  }

  // Forward calculation
  const ergebnis = berechneFrist({
    zustellungsdatum,
    fristArt: effectiveFristArt,
    dauer: effectiveDauer,
    bundesland: bl,
    section193,
  });

  // Calculate Vorfristen
  const defaultVorfristenTage = presetData?.defaultVorfristen ?? [7, 3, 1];
  const vorfristenResult = berechneVorfristen(ergebnis.endDatum, defaultVorfristenTage, bl);

  // Calculate Halbfrist
  const halbfristResult = berechneHalbfrist(ergebnis.startDatum, ergebnis.endDatum, bl);

  return NextResponse.json({
    richtung: "vorwaerts",
    ergebnis,
    vorfristen: vorfristenResult,
    halbfrist: halbfristResult,
    preset: presetData ? { id: presetData.id, name: presetData.name } : null,
    sonderfall: sonderfallInfo,
    istNotfrist: presetData?.istNotfrist ?? false,
  });
}
