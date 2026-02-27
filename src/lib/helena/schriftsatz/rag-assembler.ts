/**
 * Stage 3-4: RAG Assembler -- Per-section RAG retrieval + content generation.
 *
 * For each section in a Klageart:
 * 1. Retrieve relevant law, case law, and template chunks (RAG)
 * 2. Generate section content via LLM (generateObject) or assemble deterministically
 * 3. Collect retrieval_belege[] for audit trail
 *
 * Deterministic sections (no LLM): Rubrum, Anlagen, Kosten, Formales
 * LLM-generated sections: Antraege, Sachverhalt, Rechtliche Wuerdigung, Beweisangebote
 */

import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";

import { generateQueryEmbedding } from "@/lib/embedding/embedder";
import { searchLawChunks } from "@/lib/gesetze/ingestion";
import { searchUrteilChunks } from "@/lib/urteile/ingestion";
import { searchMusterChunks } from "@/lib/muster/ingestion";
import { getModelForTier } from "../complexity-classifier";
import { computeGkgFee } from "@/lib/finance/rvg/gkg-table";
import type { RetrievalBeleg, IntentResult } from "./schemas";
import type {
  KlageartDefinition,
  SectionConfig,
} from "./klageart-registry";
import type { SlotValues } from "./slot-filler";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result for a single section's RAG retrieval + generation */
export interface SectionRagResult {
  /** Generated section text */
  content: string;
  /** Audit trail: which RAG chunks were used */
  belege: RetrievalBeleg[];
}

/** Result of the full assembly stage */
export interface AssemblyResult {
  /** Partial Schriftsatz with all sections filled */
  schriftsatz: Record<string, unknown>;
  /** Aggregated retrieval_belege from all sections */
  allBelege: RetrievalBeleg[];
  /** Token usage across all generateObject calls */
  totalTokens: { prompt: number; completion: number };
}

// ---------------------------------------------------------------------------
// Section-specific system prompts (German)
// ---------------------------------------------------------------------------

const SECTION_PROMPTS: Record<string, string> = {
  rubrum:
    "Erstelle das Rubrum des Schriftsatzes. Verwende die Informationen der Parteien und des Gerichts. Das Rubrum muss die Bezeichnung der Parteien, das zustaendige Gericht und den Streitgegenstand enthalten.",

  antraege:
    "Formuliere die Antraege basierend auf der Klageart und den Anspruchsgrundlagen. Verwende die bereitgestellten Muster als Orientierung. Die Antraege muessen bestimmt und vollstreckbar formuliert sein (SS 253 Abs. 2 Nr. 2 ZPO). Gib jeden Antrag als separaten Eintrag zurueck.",

  sachverhalt:
    "Erstelle den Sachverhalt chronologisch und praezise. Verwende nur die bereitgestellten Fakten. Wo Details fehlen, setze {{ERGAENZUNG_SACHVERHALT}} als Platzhalter. Der Sachverhalt muss alle anspruchsbegruendenden Tatsachen enthalten.",

  rechtliche_wuerdigung:
    "Erstelle die Rechtliche Wuerdigung mit vollstaendig ausformulierten Absaetzen pro Anspruchsgrundlage. Stuetze dich auf die bereitgestellten Normen und Urteile. Wo fallspezifische Details fehlen, setze {{ERGAENZUNG}} als Platzhalter. Zitiere konkrete Paragraphen und Entscheidungen.",

  beweisangebote:
    "Erstelle die Beweisangebote basierend auf den Akten-Dokumenten. Weise jedem Dokument eine Anlagennummer zu (K1-Kn fuer Klaeger, B1-Bn fuer Beklagter). Ordne die Beweise den jeweiligen Behauptungen zu.",

  kosten:
    "Berechne Streitwert und Gerichtskosten basierend auf Klageart und Akte-Daten. Erstelle eine Kostenaufstellung.",

  forderung:
    "Formuliere die Aufforderung mit konkreter Fristsetzung und Rechtsfolgenbelehrung. Verwende die bereitgestellten Muster als Orientierung.",
};

// Max RAG context chars per section to keep prompts manageable
const MAX_RAG_CONTEXT_CHARS = 4000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assemble a complete Schriftsatz by iterating over all sections.
 *
 * For each section:
 * 1. Retrieve RAG context (law, case law, templates) if configured
 * 2. Generate content via LLM or assemble deterministically
 * 3. Collect retrieval_belege
 *
 * @param intent - Classified intent from Stage 1
 * @param slots - Filled slot values from Stage 2
 * @param klageart - Klageart definition from registry
 * @returns AssemblyResult with all sections + aggregated belege + token usage
 */
export async function assembleSchriftsatz(
  intent: IntentResult,
  slots: SlotValues,
  klageart: KlageartDefinition,
): Promise<AssemblyResult> {
  const { model } = await getModelForTier(3); // Highest quality for legal content
  const allBelege: RetrievalBeleg[] = [];
  const totalTokens = { prompt: 0, completion: 0 };

  // Assemble sections in order
  const rubrum = buildRubrum(intent, slots);
  const formales = buildFormales(slots);
  const kosten = buildKosten(klageart, slots);

  // LLM-generated sections
  const antraegeResult = await generateSectionWithRag(
    "antraege",
    klageart.sections.find((s) => s.id === "antraege"),
    slots,
    intent,
    model,
    totalTokens,
  );
  allBelege.push(...antraegeResult.belege);

  const sachverhaltResult = await generateSectionWithRag(
    "sachverhalt",
    klageart.sections.find((s) => s.id === "sachverhalt"),
    slots,
    intent,
    model,
    totalTokens,
  );
  allBelege.push(...sachverhaltResult.belege);

  const rwResult = await generateSectionWithRag(
    "rechtliche_wuerdigung",
    klageart.sections.find((s) => s.id === "rechtliche_wuerdigung"),
    slots,
    intent,
    model,
    totalTokens,
  );
  allBelege.push(...rwResult.belege);

  // Beweisangebote via LLM (matching behauptungen to beweismittel)
  const beweisResult = await generateBeweisangebote(
    klageart.sections.find((s) => s.id === "beweisangebote"),
    slots,
    intent,
    model,
    totalTokens,
  );
  allBelege.push(...beweisResult.belege);

  // Forderung section (Abmahnung-specific)
  let forderungContent: string | undefined;
  const forderungSection = klageart.sections.find((s) => s.id === "forderung");
  if (forderungSection) {
    const forderungResult = await generateSectionWithRag(
      "forderung",
      forderungSection,
      slots,
      intent,
      model,
      totalTokens,
    );
    forderungContent = forderungResult.content;
    allBelege.push(...forderungResult.belege);
  }

  // Build anlagen from beweisangebote
  const anlagen = buildAnlagen(beweisResult.items, intent);

  // Parse antraege from LLM result (expected as one-per-line)
  const antraegeList = antraegeResult.content
    .split("\n")
    .map((l) => l.replace(/^\d+\.\s*/, "").trim())
    .filter((l) => l.length > 0);

  // Compose the Schriftsatz structure
  const schriftsatz: Record<string, unknown> = {
    klageart: intent.klageart,
    rechtsgebiet: intent.rechtsgebiet,
    stadium: intent.stadium,
    rolle: intent.rolle,
    gerichtszweig: intent.gerichtszweig,
    gericht: intent.gericht ?? String(slots["GERICHT"] ?? ""),

    rubrum,
    antraege: antraegeList.length > 0 ? antraegeList : [antraegeResult.content],
    sachverhalt: sachverhaltResult.content,
    rechtlicheWuerdigung: rwResult.content,
    beweisangebote: beweisResult.items,
    anlagen,
    kosten,
    formales,

    retrieval_belege: allBelege,
    unresolved_platzhalter: [], // Will be filled by pipeline index after platzhalter check
    vollstaendig: true, // Will be updated by pipeline index
    warnungen: [], // Will be filled by ERV validator
  };

  // Add forderung for Abmahnung
  if (forderungContent) {
    (schriftsatz as Record<string, unknown>)["forderung"] = forderungContent;
  }

  return {
    schriftsatz,
    allBelege,
    totalTokens,
  };
}

// ---------------------------------------------------------------------------
// RAG Retrieval
// ---------------------------------------------------------------------------

/**
 * Retrieve RAG chunks for a section, limited to the sources configured.
 */
async function retrieveForSection(
  sectionConfig: SectionConfig | undefined,
  slots: SlotValues,
  intent: IntentResult,
): Promise<{
  chunks: Array<{ id: string; referenz: string; content: string; score: number; quelle: string }>;
  belege: RetrievalBeleg[];
}> {
  if (!sectionConfig || sectionConfig.ragSources.length === 0) {
    return { chunks: [], belege: [] };
  }

  // Build query from template, substituting slot values
  let query = sectionConfig.ragQuery;
  query = query.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return String(slots[key] ?? intent[key as keyof IntentResult] ?? key);
  });

  if (!query.trim()) {
    return { chunks: [], belege: [] };
  }

  // Generate embedding for the section-specific query
  const embedding = await generateQueryEmbedding(query);

  // Run parallel retrieval from configured sources
  const retrievals = await Promise.all(
    sectionConfig.ragSources.map(async (source) => {
      switch (source) {
        case "gesetz": {
          const results = await searchLawChunks(embedding, { limit: 8 });
          return results.map((r) => ({
            id: r.id,
            referenz: `${r.gesetzKuerzel} SS ${r.paragraphNr}`,
            content: r.content,
            score: r.score,
            quelle: "gesetz" as const,
          }));
        }
        case "urteil": {
          const results = await searchUrteilChunks(embedding, { limit: 5 });
          return results.map((r) => ({
            id: r.id,
            referenz: `${r.gericht}, ${r.aktenzeichen}`,
            content: r.content,
            score: r.score,
            quelle: "urteil" as const,
          }));
        }
        case "muster": {
          const results = await searchMusterChunks(embedding, { limit: 3 });
          return results.map((r) => ({
            id: r.id,
            referenz: `Muster: ${r.musterName}`,
            content: r.content,
            score: r.score,
            quelle: "muster" as const,
          }));
        }
        default:
          return [];
      }
    }),
  );

  // Flatten and sort by score (highest first)
  const allChunks = retrievals.flat().sort((a, b) => b.score - a.score);

  // Cap total RAG context at MAX_RAG_CONTEXT_CHARS
  let totalChars = 0;
  const cappedChunks: typeof allChunks = [];
  for (const chunk of allChunks) {
    if (totalChars + chunk.content.length > MAX_RAG_CONTEXT_CHARS) {
      // Truncate this chunk to fit
      const remaining = MAX_RAG_CONTEXT_CHARS - totalChars;
      if (remaining > 100) {
        cappedChunks.push({
          ...chunk,
          content: chunk.content.slice(0, remaining) + "...",
        });
      }
      break;
    }
    cappedChunks.push(chunk);
    totalChars += chunk.content.length;
  }

  // Map to RetrievalBeleg
  const belege: RetrievalBeleg[] = cappedChunks.map((c) => ({
    quelle: c.quelle as "gesetz" | "urteil" | "muster" | "akte_dokument",
    chunkId: c.id,
    referenz: c.referenz,
    score: c.score,
    auszug: c.content.slice(0, 200),
  }));

  return { chunks: cappedChunks, belege };
}

// ---------------------------------------------------------------------------
// Section Generation (LLM)
// ---------------------------------------------------------------------------

/**
 * Retrieve RAG context and generate section content via LLM.
 */
async function generateSectionWithRag(
  sectionId: string,
  sectionConfig: SectionConfig | undefined,
  slots: SlotValues,
  intent: IntentResult,
  model: LanguageModel,
  tokenTracker: { prompt: number; completion: number },
): Promise<SectionRagResult> {
  // If section is not configured or not LLM-generated, return empty
  if (!sectionConfig || !sectionConfig.generateViaLlm) {
    return { content: "", belege: [] };
  }

  // Retrieve RAG context
  const { chunks, belege } = await retrieveForSection(
    sectionConfig,
    slots,
    intent,
  );

  // Build RAG context string for prompt injection
  const ragContext =
    chunks.length > 0
      ? chunks
          .map((c) => `[${c.quelle}: ${c.referenz}]\n${c.content}`)
          .join("\n\n")
      : "Keine relevanten Quellen gefunden.";

  // Build slot context for the prompt
  const slotContext = Object.entries(slots)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const sectionPrompt = SECTION_PROMPTS[sectionId] ?? `Erstelle den Abschnitt "${sectionId}".`;

  const result = await generateObject({
    model,
    schema: z.object({ text: z.string() }),
    system: `${sectionPrompt}\n\nDu schreibst fuer eine ${intent.klageart} (${intent.rechtsgebiet}).`,
    prompt: `Relevante Quellen:\n${ragContext}\n\nBekannte Informationen:\n${slotContext}`,
  });

  // Track tokens
  if (result.usage) {
    tokenTracker.prompt += result.usage.promptTokens ?? 0;
    tokenTracker.completion += result.usage.completionTokens ?? 0;
  }

  return {
    content: result.object.text,
    belege,
  };
}

// ---------------------------------------------------------------------------
// Beweisangebote Generation
// ---------------------------------------------------------------------------

/**
 * Generate Beweisangebote by matching behauptungen to beweismittel via LLM.
 */
async function generateBeweisangebote(
  sectionConfig: SectionConfig | undefined,
  slots: SlotValues,
  intent: IntentResult,
  model: LanguageModel,
  tokenTracker: { prompt: number; completion: number },
): Promise<{
  items: Array<{ behauptung: string; beweismittel: string; anlagenNummer?: string }>;
  belege: RetrievalBeleg[];
}> {
  // For sections without LLM generation, return empty
  if (sectionConfig && !sectionConfig.generateViaLlm) {
    return { items: [], belege: [] };
  }

  const slotContext = Object.entries(slots)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const result = await generateObject({
    model,
    schema: z.object({
      beweisangebote: z.array(
        z.object({
          behauptung: z.string(),
          beweismittel: z.string(),
          anlagenNummer: z.string().optional(),
        }),
      ),
    }),
    system: SECTION_PROMPTS.beweisangebote,
    prompt: `Klageart: ${intent.klageart} (${intent.rechtsgebiet})\n\nBekannte Informationen:\n${slotContext}`,
  });

  if (result.usage) {
    tokenTracker.prompt += result.usage.promptTokens ?? 0;
    tokenTracker.completion += result.usage.completionTokens ?? 0;
  }

  return {
    items: result.object.beweisangebote,
    belege: [],
  };
}

// ---------------------------------------------------------------------------
// Deterministic Section Builders
// ---------------------------------------------------------------------------

/**
 * Build the Rubrum deterministically from slot values (no LLM needed).
 */
function buildRubrum(
  intent: IntentResult,
  slots: SlotValues,
): Record<string, unknown> {
  const klaegerName =
    String(slots["KLAEGER_NAME"] ?? slots["ANTRAGSTELLER_NAME"] ?? slots["BERUFUNGSKLAEGER"] ?? slots["ABSENDER"] ?? slots["PARTEI_A_NAME"] ?? "{{KLAEGER_NAME}}");
  const klaegerAdresse =
    String(slots["KLAEGER_ADRESSE"] ?? slots["ANTRAGSTELLER_ADRESSE"] ?? slots["BERUFUNGSKLAEGER_ADRESSE"] ?? slots["ABSENDER_ADRESSE"] ?? slots["PARTEI_A_ADRESSE"] ?? "");
  const beklagterName =
    String(slots["BEKLAGTER_NAME"] ?? slots["ANTRAGSGEGNER_NAME"] ?? slots["BERUFUNGSBEKLAGTER"] ?? slots["EMPFAENGER"] ?? slots["PARTEI_B_NAME"] ?? "{{BEKLAGTER_NAME}}");
  const beklagterAdresse =
    String(slots["BEKLAGTER_ADRESSE"] ?? slots["ANTRAGSGEGNER_ADRESSE"] ?? slots["BERUFUNGSBEKLAGTER_ADRESSE"] ?? slots["EMPFAENGER_ADRESSE"] ?? slots["PARTEI_B_ADRESSE"] ?? "");

  const gericht = String(
    slots["GERICHT"] ?? intent.gericht ?? "{{GERICHT}}",
  );
  const wegen = String(
    slots["BETREFF"] ?? intent.klageart ?? "{{BETREFF}}",
  );
  const aktenzeichen =
    slots["AKTENZEICHEN"] ?? slots["AZ"] ?? undefined;

  // Calculate streitwert if possible
  const streitwert = calculateStreitwert(intent, slots);

  // Determine Klaeger/Beklagter role labels based on intent
  const klaegerRolle =
    intent.stadium === "EV" ? "ANTRAGSTELLER" : "KLAEGER";
  const beklagterRolle =
    intent.stadium === "EV" ? "ANTRAGSGEGNER" : "BEKLAGTER";

  return {
    gericht,
    aktenzeichen: aktenzeichen ? String(aktenzeichen) : undefined,
    klaeger: {
      name: klaegerName,
      anschrift: klaegerAdresse || undefined,
      rolle: klaegerRolle,
    },
    beklagter: {
      name: beklagterName,
      anschrift: beklagterAdresse || undefined,
      rolle: beklagterRolle,
    },
    wegen,
    streitwert: streitwert ?? undefined,
  };
}

/**
 * Build the Formales section deterministically.
 */
function buildFormales(slots: SlotValues): Record<string, unknown> {
  const today = new Date();
  const datum =
    String(slots["DATUM"] ?? "") ||
    `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;
  const unterschrift = String(slots["RA_NAME"] ?? "{{RA_NAME}}");

  return {
    datum,
    unterschrift,
    hinweise: [
      "Abschriften fuer Gegenseite beifuegen",
      "Ggf. beglaubigte Vollmacht beilegen",
    ],
  };
}

/**
 * Build the Kosten section deterministically.
 */
function buildKosten(
  klageart: KlageartDefinition,
  slots: SlotValues,
): Record<string, unknown> {
  const streitwert = calculateStreitwertFromRegel(klageart, slots);
  const hinweise: string[] = [];

  let gerichtskosten: number | undefined;

  if (streitwert) {
    try {
      // GKG fee: 3x simple fee for Klageverfahren
      gerichtskosten = computeGkgFee(streitwert) * 3;
      hinweise.push(
        `Streitwert: ${streitwert.toLocaleString("de-DE")} EUR`,
      );
      hinweise.push(
        `Gerichtskosten (3-fache Gebuehr): ${gerichtskosten.toLocaleString("de-DE")} EUR`,
      );
    } catch {
      hinweise.push("Gerichtskosten konnten nicht berechnet werden");
    }
  } else {
    hinweise.push("Streitwert noch nicht bestimmt");
  }

  if (klageart.rechtsgebiet === "ARBEITSRECHT") {
    hinweise.push(
      "Kein Gebuehrenvorschuss beim Arbeitsgericht erforderlich",
    );
    hinweise.push(
      "Kosten erster Instanz: Jede Partei traegt eigene Anwaltskosten (SS 12a ArbGG)",
    );
  }

  return {
    streitwert: streitwert ?? undefined,
    gerichtskosten: gerichtskosten ?? undefined,
    anwaltskosten: undefined, // RVG calculation deferred
    hinweise,
  };
}

/**
 * Build Anlagen list from Beweisangebote.
 */
function buildAnlagen(
  beweisangebote: Array<{ behauptung: string; beweismittel: string; anlagenNummer?: string }>,
  intent: IntentResult,
): Array<{ nummer: string; bezeichnung: string }> {
  const prefix = intent.rolle === "KLAEGER" ? "K" : "B";
  return beweisangebote
    .filter((b) => b.anlagenNummer || b.beweismittel)
    .map((b, i) => ({
      nummer: b.anlagenNummer ?? `${prefix}${i + 1}`,
      bezeichnung: b.beweismittel,
    }));
}

// ---------------------------------------------------------------------------
// Streitwert Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate Streitwert from intent/slots (used for Rubrum).
 */
function calculateStreitwert(
  intent: IntentResult,
  slots: SlotValues,
): number | null {
  // Direct streitwert from slots
  if (slots["STREITWERT"] && typeof slots["STREITWERT"] === "number") {
    return slots["STREITWERT"];
  }
  if (slots["STREITWERT_EUR"] && typeof slots["STREITWERT_EUR"] === "number") {
    return slots["STREITWERT_EUR"];
  }

  // KSchG: 3 x Bruttogehalt
  if (
    intent.klageart === "kschg_klage" &&
    slots["BRUTTOGEHALT"] &&
    typeof slots["BRUTTOGEHALT"] === "number"
  ) {
    return slots["BRUTTOGEHALT"] * 3;
  }

  // Lohnklage: sum of outstanding amounts
  if (
    intent.klageart === "lohnklage" &&
    slots["AUSSTEHENDE_SUMME"] &&
    typeof slots["AUSSTEHENDE_SUMME"] === "number"
  ) {
    return slots["AUSSTEHENDE_SUMME"];
  }

  return null;
}

/**
 * Calculate Streitwert from Klageart's Streitwert rule.
 */
function calculateStreitwertFromRegel(
  klageart: KlageartDefinition,
  slots: SlotValues,
): number | null {
  const regel = klageart.streitwertRegel;

  switch (regel.typ) {
    case "VIERTELJAHRESGEHALT": {
      const gehalt = slots["BRUTTOGEHALT"];
      if (typeof gehalt === "number") {
        return gehalt * (regel.faktor ?? 3);
      }
      // Try parsing string
      if (typeof gehalt === "string") {
        const parsed = parseFloat(gehalt.replace(/[^\d.,]/g, "").replace(",", "."));
        if (!isNaN(parsed)) return parsed * (regel.faktor ?? 3);
      }
      return null;
    }
    case "FESTBETRAG":
      return regel.festbetrag ?? null;
    case "SUMME": {
      const summe =
        slots["AUSSTEHENDE_SUMME"] ?? slots["STREITWERT"];
      if (typeof summe === "number") return summe;
      if (typeof summe === "string") {
        const parsed = parseFloat(summe.replace(/[^\d.,]/g, "").replace(",", "."));
        if (!isNaN(parsed)) return parsed;
      }
      return null;
    }
    case "MANUELL":
    default: {
      // Try direct slot values
      if (typeof slots["STREITWERT"] === "number") return slots["STREITWERT"];
      if (typeof slots["STREITWERT_EUR"] === "number") return slots["STREITWERT_EUR"];
      return null;
    }
  }
}
