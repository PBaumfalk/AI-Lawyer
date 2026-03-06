/**
 * Case summary generation service.
 *
 * Helena generates a structured Fallzusammenfassung from Akte data:
 * - A short summary (3-5 sentences)
 * - A chronological timeline of key events
 * - Structured key facts (parties, financials, deadlines)
 *
 * === Helena HARD LIMITS ===
 * All AI output is ENTWURF by default and requires human Freigabe.
 * Helena may NEVER send external communications, delete data, etc.
 * ===========================
 */

import { generateObject } from "ai";
import { z } from "zod";
import { getModel, getModelName, getProviderName } from "@/lib/ai/provider";
import { trackTokenUsage } from "@/lib/ai/token-tracker";
import type { ExtendedPrismaClient } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  datum: string; // ISO date string
  titel: string; // short title
  beschreibung: string; // 1-2 sentence description
  typ:
    | "DOKUMENT"
    | "FRIST"
    | "TERMIN"
    | "KOMMUNIKATION"
    | "ENTSCHEIDUNG"
    | "SONSTIGES";
  quellDokument?: string; // document name if from a doc
}

export interface KeyFact {
  label: string; // e.g. "Streitwert", "Gegner", "Naechste Frist"
  value: string; // the fact value
  kategorie: "PARTEI" | "VERFAHREN" | "FINANZEN" | "FRIST" | "SONSTIGES";
}

export interface CaseSummary {
  zusammenfassung: string; // 3-5 sentence case summary
  timeline: TimelineEvent[]; // chronological events
  keyFacts: KeyFact[]; // structured key facts
  generatedAt: string; // ISO timestamp
}

// ---------------------------------------------------------------------------
// Zod schema for generateObject
// ---------------------------------------------------------------------------

const timelineEventSchema = z.object({
  datum: z.string().describe("ISO date string (YYYY-MM-DD)"),
  titel: z.string().describe("Short event title"),
  beschreibung: z
    .string()
    .describe("1-2 sentence description of the event"),
  typ: z.enum([
    "DOKUMENT",
    "FRIST",
    "TERMIN",
    "KOMMUNIKATION",
    "ENTSCHEIDUNG",
    "SONSTIGES",
  ]),
  quellDokument: z
    .string()
    .optional()
    .describe("Source document name if applicable"),
});

const keyFactSchema = z.object({
  label: z
    .string()
    .describe("Fact label, e.g. Streitwert, Gegner, Naechste Frist"),
  value: z.string().describe("The fact value"),
  kategorie: z.enum([
    "PARTEI",
    "VERFAHREN",
    "FINANZEN",
    "FRIST",
    "SONSTIGES",
  ]),
});

const caseSummarySchema = z.object({
  zusammenfassung: z
    .string()
    .describe("3-5 sentence case summary in German"),
  timeline: z
    .array(timelineEventSchema)
    .describe("Chronological timeline of key events"),
  keyFacts: z
    .array(keyFactSchema)
    .describe("Structured key facts about the case"),
});

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Du bist Helena, KI-Assistentin einer Kanzlei. Erstelle eine strukturierte Fallzusammenfassung.

Extrahiere aus den vorliegenden Aktendaten:

1) Eine kurze Zusammenfassung (3-5 Saetze) des Falls: Worum geht es, wer ist beteiligt, wie ist der aktuelle Stand.

2) Eine chronologische Timeline der wichtigsten Ereignisse:
   - Dokumente (Eingang, Erstellung)
   - Fristen und Termine
   - Kommunikation (Schreiben, E-Mails)
   - Entscheidungen (Beschluesse, Urteile)
   - Sortiere nach Datum aufsteigend

3) Key Facts (strukturierte Eckdaten):
   - PARTEI: Beteiligte Parteien mit Rollen
   - VERFAHREN: Aktenzeichen, Sachgebiet, Status, Gericht
   - FINANZEN: Streitwert/Gegenstandswert falls vorhanden
   - FRIST: Naechste anstehende Fristen/Termine
   - SONSTIGES: Weitere relevante Eckdaten

Basiere alles auf den vorliegenden Dokumenten und Aktendaten. Erfinde keine Fakten.
Alle Texte auf Deutsch.`;

// ---------------------------------------------------------------------------
// generateCaseSummary
// ---------------------------------------------------------------------------

export async function generateCaseSummary(options: {
  prisma: ExtendedPrismaClient;
  akteId: string;
  userId: string;
}): Promise<CaseSummary> {
  const { prisma, akteId, userId } = options;

  // Load Akte with all relevant data
  const akte = await prisma.akte.findUniqueOrThrow({
    where: { id: akteId },
    include: {
      beteiligte: {
        include: {
          kontakt: {
            select: {
              vorname: true,
              nachname: true,
              firma: true,
            },
          },
        },
      },
      kalenderEintraege: {
        orderBy: { datum: "asc" },
      },
    },
  });

  // Load recent documents with OCR text snippets via raw query
  const docRows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      mimeType: string;
      createdAt: Date;
      ocrSnippet: string | null;
    }>
  >`
    SELECT id, name, "mimeType", "createdAt", LEFT("ocrText", 2000) as "ocrSnippet"
    FROM dokumente
    WHERE "akteId" = ${akteId}
    ORDER BY "createdAt" DESC
    LIMIT 15
  `;

  // Build context string
  const contextParts: string[] = [];

  // Akte metadata
  contextParts.push(`Aktenzeichen: ${akte.aktenzeichen}`);
  contextParts.push(`Rubrum: ${akte.kurzrubrum}`);
  if (akte.wegen) contextParts.push(`Wegen: ${akte.wegen}`);
  contextParts.push(`Sachgebiet: ${akte.sachgebiet}`);
  contextParts.push(`Status: ${akte.status}`);
  if (akte.gegenstandswert) {
    contextParts.push(`Gegenstandswert: ${akte.gegenstandswert}`);
  }

  // Beteiligte
  if (akte.beteiligte.length > 0) {
    contextParts.push("\nBeteiligte:");
    for (const b of akte.beteiligte) {
      const name =
        b.kontakt.firma ??
        [b.kontakt.vorname, b.kontakt.nachname].filter(Boolean).join(" ") ??
        "Unbekannt";
      contextParts.push(`- ${name} (${b.rolle})`);
    }
  }

  // Dokumente with OCR snippets
  if (docRows.length > 0) {
    contextParts.push(`\nDokumente (${docRows.length}):`);
    for (const doc of docRows) {
      const dateStr = new Date(doc.createdAt).toISOString().slice(0, 10);
      contextParts.push(`- ${doc.name} (${dateStr}, ${doc.mimeType})`);
      if (doc.ocrSnippet) {
        contextParts.push(`  Inhalt: ${doc.ocrSnippet}`);
      }
    }
  }

  // Kalender entries (Fristen & Termine)
  if (akte.kalenderEintraege.length > 0) {
    contextParts.push("\nFristen & Termine:");
    for (const e of akte.kalenderEintraege) {
      const dateStr = new Date(e.datum).toISOString().slice(0, 10);
      const status = e.erledigt ? " (erledigt)" : "";
      contextParts.push(`- ${dateStr}: ${e.titel} [${e.typ}]${status}`);
    }
  }

  // Falldaten
  if (akte.falldaten && typeof akte.falldaten === "object") {
    const fd = akte.falldaten as Record<string, unknown>;
    const entries = Object.entries(fd).filter(
      ([, v]) => v !== null && v !== undefined && v !== ""
    );
    if (entries.length > 0) {
      contextParts.push("\nFalldaten:");
      for (const [key, value] of entries) {
        contextParts.push(`- ${key}: ${String(value)}`);
      }
    }
  }

  const contextString = contextParts.join("\n");

  // Generate summary via AI
  const [model, modelName, providerName] = await Promise.all([
    getModel(),
    getModelName(),
    getProviderName(),
  ]);

  const result = await generateObject({
    model,
    schema: caseSummarySchema,
    system: SYSTEM_PROMPT,
    prompt: `Erstelle eine Fallzusammenfassung fuer folgende Akte:\n\n${contextString}`,
  });

  // Track token usage
  const tokensIn = result.usage?.promptTokens ?? 0;
  const tokensOut = result.usage?.completionTokens ?? 0;

  if (tokensIn > 0 || tokensOut > 0) {
    await trackTokenUsage({
      userId,
      akteId,
      funktion: "BRIEFING",
      provider: providerName,
      model: modelName,
      tokensIn,
      tokensOut,
    });
  }

  const obj = result.object;

  return {
    zusammenfassung: obj.zusammenfassung ?? "",
    timeline: (obj.timeline ?? []) as TimelineEvent[],
    keyFacts: (obj.keyFacts ?? []) as KeyFact[],
    generatedAt: new Date().toISOString(),
  };
}
