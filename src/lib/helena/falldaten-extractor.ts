/**
 * Falldaten Auto-Fill Extraction Service
 *
 * Uses AI (generateObject) to extract structured case data from Akte documents
 * into Falldatenblatt fields. Each suggestion includes confidence level and
 * source excerpt. Nothing is auto-saved -- all output is VORSCHLAG.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { getModel, getModelName, getProviderName } from "@/lib/ai/provider";
import { wrapWithTracking } from "@/lib/ai/token-tracker";
import type { ExtendedPrismaClient } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FalldatenSuggestion {
  key: string;
  value: any;
  konfidenz: "HOCH" | "MITTEL" | "NIEDRIG";
  quellExcerpt: string;
  dokumentName: string;
}

export interface TemplateField {
  key: string;
  label: string;
  typ: string;
  placeholder?: string | null;
  optionen?: { value: string; label: string }[] | null;
  required?: boolean;
  gruppe?: string | null;
}

interface ExtractFalldatenOptions {
  prisma: ExtendedPrismaClient;
  akteId: string;
  felder: TemplateField[];
  userId: string;
}

// ---------------------------------------------------------------------------
// Dynamic Zod schema builder
// ---------------------------------------------------------------------------

function buildFieldSchema(feld: TemplateField) {
  let valueSchema: z.ZodTypeAny;

  switch (feld.typ) {
    case "number":
    case "currency":
      valueSchema = z.number();
      break;
    case "boolean":
      valueSchema = z.boolean();
      break;
    default:
      // text, textarea, date, select all come as strings
      valueSchema = z.string();
      break;
  }

  return z.object({
    value: valueSchema,
    konfidenz: z.enum(["HOCH", "MITTEL", "NIEDRIG"]),
    quellExcerpt: z.string().max(200),
  });
}

function buildExtractionSchema(felder: TemplateField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const feld of felder) {
    shape[feld.key] = buildFieldSchema(feld).optional();
  }
  return z.object(shape);
}

// ---------------------------------------------------------------------------
// Field definitions for prompt
// ---------------------------------------------------------------------------

function formatFieldDefinitions(felder: TemplateField[]): string {
  return felder
    .map((f) => {
      let desc = `- ${f.key}: "${f.label}" (Typ: ${f.typ})`;
      if (f.optionen && f.optionen.length > 0) {
        const opts = f.optionen
          .map((o) => `${o.value}="${o.label}"`)
          .join(", ");
        desc += ` [Optionen: ${opts}]`;
      }
      return desc;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// extractFalldaten — Main extraction function
// ---------------------------------------------------------------------------

export async function extractFalldaten(
  options: ExtractFalldatenOptions
): Promise<FalldatenSuggestion[]> {
  const { prisma, akteId, felder, userId } = options;

  if (felder.length === 0) {
    return [];
  }

  // 1. Load documents with completed OCR, max 10 most recent
  const dokumente = await prisma.dokument.findMany({
    where: {
      akteId,
      ocrStatus: "ABGESCHLOSSEN",
      ocrText: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
    },
  });

  if (dokumente.length === 0) {
    return [];
  }

  // 2. Fetch truncated OCR text via raw query (same pattern as ki-chat route)
  const docIds = dokumente.map((d) => d.id);
  const snippetRows = await prisma.$queryRaw<
    { id: string; snippet: string }[]
  >`SELECT id, LEFT("ocrText", 3000) as snippet FROM "dokumente" WHERE id = ANY(${docIds}) AND "ocrText" IS NOT NULL`;

  const snippetMap = new Map<string, string>();
  for (const row of snippetRows) {
    if (row.snippet) snippetMap.set(row.id, row.snippet.trim());
  }

  // 3. Build concatenated document context (max 15000 chars)
  const docNameMap = new Map<string, string>();
  let contextParts: string[] = [];
  let totalLength = 0;

  for (const doc of dokumente) {
    const text = snippetMap.get(doc.id);
    if (!text) continue;

    docNameMap.set(doc.id, doc.name);
    const header = `\n=== DOKUMENT: ${doc.name} ===\n`;
    const section = header + text;

    if (totalLength + section.length > 15000) break;
    contextParts.push(section);
    totalLength += section.length;
  }

  const documentContext = contextParts.join("\n");

  if (!documentContext.trim()) {
    return [];
  }

  // 4. Build dynamic Zod schema
  const extractionSchema = buildExtractionSchema(felder);

  // 5. Build prompt
  const fieldDefinitions = formatFieldDefinitions(felder);

  const systemPrompt = `Du bist Helena, KI-Assistentin einer Kanzlei. Extrahiere strukturierte Falldaten aus den folgenden Dokumenten.

Fuer jedes Feld:
- Gib den extrahierten Wert passend zum Feldtyp an
- Gib eine Konfidenz-Einschaetzung: HOCH (klar im Text), MITTEL (abgeleitet/interpretiert), NIEDRIG (unsicher/geraten)
- Gib ein kurzes Zitat aus dem Quelldokument (max 200 Zeichen)
- Fuer "select"-Felder: verwende nur die angegebenen Optionswerte
- Fuer "date"-Felder: verwende das Format YYYY-MM-DD
- Fuer "boolean"-Felder: verwende true oder false
- Fuer "currency"/"number"-Felder: verwende Zahlen ohne Waehrungszeichen

Wenn ein Feld nicht aus den Dokumenten ableitbar ist, lasse es weg.`;

  const userPrompt = `Hier sind die Dokumente der Akte:

${documentContext}

---

Extrahiere Daten fuer folgende Felder:

${fieldDefinitions}`;

  // 6. Call generateObject
  const model = await getModel();
  const providerName = await getProviderName();
  const modelName = await getModelName();

  const result = await generateObject({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    schema: extractionSchema,
  });

  // 7. Track token usage (use "CHAT" as AiFunktion since FALLDATEN_AUTOFILL not in enum)
  await wrapWithTracking(result, {
    userId,
    akteId,
    funktion: "CHAT",
    provider: providerName,
    model: modelName,
  });

  // 8. Map result to FalldatenSuggestion[]
  const suggestions: FalldatenSuggestion[] = [];
  const extracted = result.object as Record<string, any>;

  // Determine which document name to attribute
  // Since we combine all docs, use the first document or try to match excerpt
  const firstDocName = dokumente[0]?.name ?? "Unbekanntes Dokument";

  for (const feld of felder) {
    const fieldResult = extracted[feld.key];
    if (!fieldResult || fieldResult.value === undefined || fieldResult.value === null) {
      continue;
    }

    // Try to find which document the excerpt came from
    let dokumentName = firstDocName;
    if (fieldResult.quellExcerpt) {
      for (const doc of dokumente) {
        const text = snippetMap.get(doc.id);
        if (text && text.includes(fieldResult.quellExcerpt.substring(0, 30))) {
          dokumentName = doc.name;
          break;
        }
      }
    }

    suggestions.push({
      key: feld.key,
      value: fieldResult.value,
      konfidenz: fieldResult.konfidenz,
      quellExcerpt: fieldResult.quellExcerpt ?? "",
      dokumentName,
    });
  }

  return suggestions;
}
