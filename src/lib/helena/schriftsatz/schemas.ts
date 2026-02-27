/**
 * Zod schemas for the deterministic Schriftsatz pipeline.
 *
 * Defines all type contracts for the 5-stage pipeline:
 * Intent -> SlotFill -> RAG -> Assembly -> Validate
 *
 * All placeholder keys use {{UPPER_SNAKE_CASE}} convention
 * (matching the amtliche Muster standard from seed-amtliche.ts).
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Sub-Schemas
// ---------------------------------------------------------------------------

/** Party in the Rubrum (Klaeger, Beklagter, Antragsteller, Antragsgegner) */
export const PartySchema = z.object({
  name: z.string(),
  anschrift: z.string().optional(),
  vertreter: z.string().optional(),
  rolle: z.enum(["KLAEGER", "BEKLAGTER", "ANTRAGSTELLER", "ANTRAGSGEGNER"]),
});

export type Party = z.infer<typeof PartySchema>;

/** Anlage reference (K1, K2, B1, B2, etc.) */
export const AnlageSchema = z.object({
  nummer: z.string(), // e.g. "K1", "B2"
  bezeichnung: z.string(),
  dokumentId: z.string().optional(), // Reference to Akte Dokument if available
});

export type Anlage = z.infer<typeof AnlageSchema>;

/** Beweisangebot (evidence offer) linking assertion to proof */
export const BeweisangebotSchema = z.object({
  behauptung: z.string(),
  beweismittel: z.string(),
  anlagenNummer: z.string().optional(), // References AnlageSchema.nummer
});

export type Beweisangebot = z.infer<typeof BeweisangebotSchema>;

/** Audit trail: which RAG chunks were used for generation */
export const RetrievalBelegSchema = z.object({
  quelle: z.enum(["gesetz", "urteil", "muster", "akte_dokument"]),
  chunkId: z.string(),
  referenz: z.string(), // e.g. "BGB SS 626", "BAG Az. 2 AZR 123/22"
  score: z.number(),
  auszug: z.string(), // First ~200 chars of the chunk content
});

export type RetrievalBeleg = z.infer<typeof RetrievalBelegSchema>;

/** ERV/beA validation warning */
export const ErvWarnungSchema = z.object({
  typ: z.enum(["INHALT", "FORM", "FRIST"]),
  schwere: z.enum(["INFO", "WARNUNG", "KRITISCH"]),
  text: z.string(),
  feld: z.string().optional(),
});

export type ErvWarnung = z.infer<typeof ErvWarnungSchema>;

// ---------------------------------------------------------------------------
// Intent Result Schema (Stage 1 output)
// ---------------------------------------------------------------------------

/**
 * Result of intent recognition from natural language.
 * Identifies what the user wants to create and for which legal context.
 */
export const IntentResultSchema = z.object({
  rechtsgebiet: z.enum([
    "ARBEITSRECHT",
    "FAMILIENRECHT",
    "VERKEHRSRECHT",
    "MIETRECHT",
    "STRAFRECHT",
    "ERBRECHT",
    "SOZIALRECHT",
    "INKASSO",
    "HANDELSRECHT",
    "VERWALTUNGSRECHT",
    "SONSTIGES",
  ]).describe("Rechtsgebiet matching Prisma Sachgebiet enum"),
  klageart: z
    .string()
    .describe(
      "Specific filing type ID from registry, e.g. kschg_klage, lohnklage, ev_antrag, klageerwiderung, abmahnung, generic"
    ),
  stadium: z.enum([
    "ERSTINSTANZ",
    "BERUFUNG",
    "REVISION",
    "BESCHWERDE",
    "EV",
    "AUSSERGERICHTLICH",
  ]),
  rolle: z.enum(["KLAEGER", "BEKLAGTER"]),
  gerichtszweig: z.enum([
    "ARBG",
    "LG",
    "AG",
    "OLG",
    "LAG",
    "BGH",
    "BAG",
    "VG",
    "SG",
    "FG",
  ]),
  gericht: z
    .string()
    .optional()
    .describe("Specific court name if derivable from context"),
  confidence: z.number().min(0).max(1),
  begruendung: z
    .string()
    .describe("German-language reasoning for this classification"),
});

export type IntentResult = z.infer<typeof IntentResultSchema>;

// ---------------------------------------------------------------------------
// Schriftsatz Schema (pipeline output — stored in HelenaDraft.meta)
// ---------------------------------------------------------------------------

/**
 * Complete Schriftsatz intermediate format.
 * Covers all 8 mandatory sections from the roadmap:
 * Rubrum, Antraege, Sachverhalt, Rechtliche Wuerdigung,
 * Beweisangebote, Anlagen, Kosten, Formales.
 *
 * Stored in HelenaDraft.meta JSON field.
 */
export const SchriftsatzSchema = z.object({
  // --- Metadata ---
  klageart: z.string(),
  rechtsgebiet: z.string(),
  stadium: z.string(),
  rolle: z.string(),
  gerichtszweig: z.string(),
  gericht: z.string(),

  // --- Section 1: Rubrum ---
  rubrum: z.object({
    gericht: z.string(),
    aktenzeichen: z.string().optional(), // May not exist yet for new filings
    klaeger: PartySchema,
    beklagter: PartySchema,
    wegen: z.string(),
    streitwert: z.number().optional(),
  }),

  // --- Section 2: Antraege ---
  antraege: z.array(z.string()), // Numbered claims/motions

  // --- Section 3: Sachverhalt ---
  sachverhalt: z.string(), // Full narrative

  // --- Section 4: Rechtliche Wuerdigung ---
  rechtlicheWuerdigung: z.string(), // Full legal analysis with {{ERGAENZUNG}} placeholders

  // --- Section 5: Beweisangebote ---
  beweisangebote: z.array(BeweisangebotSchema),

  // --- Section 6: Anlagen ---
  anlagen: z.array(AnlageSchema),

  // --- Section 7: Kosten ---
  kosten: z.object({
    streitwert: z.number().optional(),
    gerichtskosten: z.number().optional(),
    anwaltskosten: z.number().optional(),
    hinweise: z.array(z.string()),
  }),

  // --- Section 8: Formales ---
  formales: z.object({
    datum: z.string(),
    unterschrift: z.string(),
    hinweise: z.array(z.string()),
  }),

  // --- Audit trail ---
  retrieval_belege: z.array(RetrievalBelegSchema),

  // --- Completeness status ---
  unresolved_platzhalter: z.array(z.string()), // {{PLATZHALTER}} names that couldn't be filled
  vollstaendig: z.boolean(), // false if any Pflichtfelder are still placeholders
  warnungen: z.array(z.string()), // ERV-Validator warnings
});

export type Schriftsatz = z.infer<typeof SchriftsatzSchema>;
