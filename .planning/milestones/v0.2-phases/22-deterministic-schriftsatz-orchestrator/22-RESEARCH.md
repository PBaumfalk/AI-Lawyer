# Phase 22: Deterministic Schriftsatz Orchestrator - Research

**Researched:** 2026-02-27
**Domain:** Deterministic LLM pipeline for German legal filings (Schriftsaetze)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All Rechtsgebiete from the start (Arbeitsrecht, Zivilrecht, Familienrecht, Mietrecht, etc.) -- no restriction to a single area
- All Stadien: Erstinstanz, Berufung, Revision, Beschwerde, einstweiliger Rechtsschutz
- Both sides: Klage + Klageerwiderung, Antrag + Erwiderung, Berufung + Berufungserwiderung, Replik/Duplik
- Gerichtliche AND aussergerichtliche Schriftsaetze (Abmahnungen, Kuendigungsschreiben, Vergleichsvorschlaege, Aufforderungsschreiben)
- Goldstandard: KSchG-Klage + Lohn-/Gehaltsklage -- daily bread, must work flawlessly
- Intent-Router: Auto-Erkennung from natural language (Rechtsgebiet, Klageart, Stadium, Rolle)
- Uses Akte-Kontext for smarter intent recognition (fewer Rueckfragen)
- Auto-derives zustaendiges Gericht from Akte + Streitwert
- Rueckfragen: Conversational style, one question at a time (not batched, not form-like)
- Maximum pre-fill from Akte data (Mandant -> Klaeger, Gegner -> Beklagter)
- Active warnings on uncertain inferences (e.g., 3-Wochen-Frist warning for KSchG)
- When user cannot answer: set {{PLATZHALTER}} and mark Schriftsatz as incomplete
- Rechtliche Wuerdigung: Hybrid -- fully written paragraphs with {{ERGAENZUNG}} placeholders for missing case-specific details
- Beweisangebote: Fully automatic from Akten-Dokumente
- Anlagenliste: Fully automatic (K1-Kn / B1-Bn), with Anlagenverzeichnis
- Streitwert: Automatic calculation from Klageart + Akte data
- ERV-Validator: Warnings only, never hard-blocks (Anwalt has final say)
- Inhaltliche AND formale Validierung (Rubrum, Parteienbezeichnung, PDF/A, Signatur, Dateigroesse etc.)
- Rechtsgebietsspezifische Pruefungen (KSchG 3-Wochen-Frist, Schlichtungsklausel etc.)
- Validation result: Checkliste at end of draft (green checks / yellow warnings)
- Draft-Approval workflow is Phase 23 -- this phase only produces SchriftsatzSchema + HelenaDraft

### Claude's Discretion
- Exact Zod schema field structure for SchriftsatzSchema (as long as all mandatory sections from roadmap are covered)
- Internal pipeline architecture (how stages chain together)
- RAG query strategy per section (how many chunks, which sources to prioritize)
- Error handling and retry behavior within the pipeline
- Exact wording of Rueckfrage prompts

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORCH-01 | Deterministic Schriftsatz-Orchestrator mit festem Ablauf: Intent-Erkennung -> Slot-Filling -> RAG-Retrieval -> Output-Assembly -> ERV-Validator | Pipeline architecture pattern with generateObject per stage; existing ReAct agent NOT used for Schriftsatz (separate deterministic path) |
| ORCH-02 | Intent-Router erkennt Klageart, Stadium, Gerichtszweig aus Nutzeranfrage | Zod-validated IntentSchema via generateObject; Akte-Kontext enrichment from existing read_akte_detail data |
| ORCH-03 | SchriftsatzSchema als Zod-typisiertes Zwischenformat (Rubrum, Antraege, Sachverhalt, Rechtliche Wuerdigung, Beweisangebote, Anlagen, Kosten, Formales) | Comprehensive Zod schema design; existing party-extractor/deadline-extractor patterns as reference |
| ORCH-04 | Slot-Filling mit automatischer Rueckfrage bei fehlenden Pflichtfeldern | Slot definitions per Klageart; partial-fill from Akte; conversational Rueckfrage loop |
| ORCH-05 | Einheitlicher Platzhalter-Standard ueber alle Muster und Output | Unify {{PLATZHALTER}} convention from seed-amtliche.ts with {{dotted.key}} from vorlagen.ts into single standard |
| ORCH-06 | ERV/beA-Validator als letzter Schritt mit warnungen[] | Pure validation function over SchriftsatzSchema; no external dependencies needed |
| ORCH-07 | Jeder Schriftsatz-Entwurf enthaelt retrieval_belege[] (welche Chunks genutzt wurden -- Audit-Trail) | SourceAttribution from existing tool pattern; collect chunkIds from all RAG calls across pipeline |
</phase_requirements>

## Summary

Phase 22 replaces the current free-form KI-Chat Schriftsatz generation (v0.1 via system prompt injection in `src/app/api/ki-chat/route.ts` lines 601-611) with a **deterministic, multi-stage pipeline** that produces a Zod-validated SchriftsatzSchema. The pipeline is NOT a ReAct agent loop -- it is a fixed sequence of `generateObject` calls, each with a narrowly-scoped schema, chained together in code.

The project already has all the infrastructure needed: AI SDK v4.3.19 with `generateObject` (used in `party-extractor.ts` and `deadline-extractor.ts`), Zod v3.23.8, three RAG sources (law chunks via `searchLawChunks`, case law via `searchUrteilChunks`, templates via `searchMusterChunks`), a hybrid search pipeline (`hybrid-search.ts` with BM25+pgvector+RRF+reranking), a complete placeholder system (`vorlagen.ts` with PLATZHALTER_GRUPPEN), RVG/GKG calculators (`calculator.ts`, `gkg-table.ts`), and the HelenaDraft Prisma model ready to receive the output. No new npm packages are needed.

The key architectural insight is that this pipeline runs **alongside** the existing Helena ReAct agent, not inside it. The complexity classifier already routes "Schriftsatz + Klage/Antrag" to tier 3 + background mode. The new orchestrator intercepts this classification and runs the deterministic pipeline instead of the ReAct loop. The output is stored as a HelenaDraft with typ=DOKUMENT and the structured SchriftsatzSchema in the `meta` JSON field plus `retrieval_belege[]` for audit.

**Primary recommendation:** Build a 5-stage deterministic pipeline (Intent -> SlotFill -> RAG -> Assembly -> Validate) using `generateObject` per stage, store output as HelenaDraft with SchriftsatzSchema in meta, and unify the placeholder standard to `{{UPPER_SNAKE_CASE}}`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ai (AI SDK) | ^4.3.19 | `generateObject` for structured LLM output per pipeline stage | Already in use for party-extractor and deadline-extractor; proven pattern in this codebase |
| zod | ^3.23.8 | Schema definitions for IntentSchema, SlotSchema, SchriftsatzSchema | Already the project standard; used everywhere including tool definitions |
| Prisma | existing | HelenaDraft storage, Akte/Beteiligter reads, HelenaMemory | Project ORM; all relevant models already exist |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pgvector | existing | RAG retrieval for Gesetze, Urteile, Muster chunks | Per-section RAG queries during assembly stage |
| Meilisearch | existing | BM25 component of hybrid search for document retrieval | When searching Akte documents for Beweisangebote |
| RvgCalculator | existing | Streitwert/Kostenvorschuss calculation for Kosten section | When Klageart requires cost calculation |
| GKG table | existing | Court fee lookup for Kostenvorschuss-Hinweis | For Gerichtskosten in Kosten section |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| generateObject per stage | Single large generateObject for entire Schriftsatz | Per-stage is more reliable: smaller schemas -> fewer hallucinations, individual retries, section-specific RAG context injection |
| Deterministic pipeline | ReAct agent with tools | User explicitly decided deterministic pipeline; ReAct too unpredictable for legal filings |
| Hardcoded slot definitions per Klageart | LLM-generated slot requirements | Deterministic slot definitions are more reliable; legal requirements are well-defined |

**Installation:**
```bash
# No new packages needed -- all dependencies already in project
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/helena/
├── schriftsatz/
│   ├── index.ts                  # Public API: runSchriftsatzPipeline()
│   ├── schemas.ts                # All Zod schemas (IntentSchema, SlotSchema, SchriftsatzSchema)
│   ├── intent-router.ts          # Stage 1: Intent recognition via generateObject
│   ├── slot-filler.ts            # Stage 2: Slot extraction + Rueckfrage generation
│   ├── rag-assembler.ts          # Stage 3: Per-section RAG retrieval + content assembly
│   ├── erv-validator.ts          # Stage 4: ERV/beA validation (pure function, no LLM)
│   ├── platzhalter.ts            # Unified placeholder standard + resolution
│   ├── klageart-registry.ts      # Registry of Klagearten with slot definitions + section templates
│   └── __tests__/
│       ├── schemas.test.ts
│       ├── intent-router.test.ts
│       ├── slot-filler.test.ts
│       ├── erv-validator.test.ts
│       └── platzhalter.test.ts
```

### Pattern 1: Deterministic Pipeline (NOT ReAct)
**What:** A fixed sequence of stages where each stage takes the output of the previous stage and produces a Zod-validated intermediate result. The LLM is called via `generateObject` at specific stages, not in a free-form loop.
**When to use:** When output structure is legally mandated and must be complete/validated.
**Example:**
```typescript
// Source: project pattern from party-extractor.ts + deadline-extractor.ts
import { generateObject } from "ai";
import { z } from "zod";

// Each stage has a narrowly-scoped schema
const IntentSchema = z.object({
  rechtsgebiet: z.enum(["ARBEITSRECHT", "ZIVILRECHT", ...]),
  klageart: z.string(),
  stadium: z.enum(["ERSTINSTANZ", "BERUFUNG", "REVISION", ...]),
  rolle: z.enum(["KLAEGER", "BEKLAGTER"]),
  gerichtszweig: z.enum(["ARBG", "LG", "AG", "OLG", "LAG", ...]),
  confidence: z.number().min(0).max(1),
});

// Stage 1: Intent recognition
const intent = await generateObject({
  model,
  schema: IntentSchema,
  system: INTENT_SYSTEM_PROMPT,
  prompt: buildIntentPrompt(userMessage, akteContext),
});

// Stage 2: Slot filling (with Akte pre-fill)
// Stage 3: RAG assembly (per-section retrieval)
// Stage 4: ERV validation (pure function)
```

### Pattern 2: Akte-Context Pre-Fill for Slot Filling
**What:** Before asking the user any Rueckfragen, pre-fill as many slots as possible from Akte data (Beteiligte, Sachgebiet, Gegenstandswert, Dokumente).
**When to use:** Always -- reduces Rueckfragen and improves UX.
**Example:**
```typescript
// Source: existing read_akte_detail.ts pattern
async function prefillSlotsFromAkte(
  akteId: string,
  intent: IntentResult,
  prisma: PrismaClient
): Promise<Partial<SlotValues>> {
  const akte = await prisma.akte.findFirst({
    where: { id: akteId },
    include: {
      beteiligte: { include: { kontakt: { include: { adressen: true } } } },
      dokumente: { select: { id: true, name: true, tags: true } },
      normen: true,
    },
  });

  const mandant = akte.beteiligte.find(b => b.rolle === "MANDANT");
  const gegner = akte.beteiligte.find(b => b.rolle === "GEGNER");

  return {
    klaeger_name: intent.rolle === "KLAEGER"
      ? formatPartyName(mandant?.kontakt) : formatPartyName(gegner?.kontakt),
    beklagter_name: intent.rolle === "KLAEGER"
      ? formatPartyName(gegner?.kontakt) : formatPartyName(mandant?.kontakt),
    gericht: akte.beteiligte.find(b => b.rolle === "GERICHT")?.kontakt,
    streitwert: akte.gegenstandswert,
    sachgebiet: akte.sachgebiet,
    // ... more pre-fills from Akte data
  };
}
```

### Pattern 3: Per-Section RAG Assembly
**What:** Each section of the Schriftsatz (Sachverhalt, Rechtliche Wuerdigung, etc.) gets its own targeted RAG query. The RAG results are injected into the generateObject prompt as context, and the chunkIds are tracked for retrieval_belege[].
**When to use:** Always during the assembly stage.
**Example:**
```typescript
// Source: existing search_gesetze.ts + search_urteile.ts patterns
interface SectionRagResult {
  content: string;       // Generated section content
  belege: RetrievalBeleg[];  // Audit trail
}

interface RetrievalBeleg {
  quelle: "gesetz" | "urteil" | "muster" | "akte_dokument";
  chunkId: string;
  referenz: string;  // e.g., "BGB SS 626" or "BAG, Az. 2 AZR 123/22"
  score: number;
  auszug: string;    // First 200 chars of chunk content
}

async function assembleRechtlicheWuerdigung(
  slots: SlotValues,
  intent: IntentResult,
): Promise<SectionRagResult> {
  // 1. Build section-specific RAG query
  const query = `${intent.klageart} ${slots.anspruchsgrundlage} Rechtliche Wuerdigung`;

  // 2. Parallel retrieval from multiple sources
  const embedding = await generateQueryEmbedding(query);
  const [gesetze, urteile, muster] = await Promise.all([
    searchLawChunks(embedding, { limit: 8 }),
    searchUrteilChunks(embedding, { limit: 5 }),
    searchMusterChunks(embedding, { limit: 3 }),
  ]);

  // 3. Track retrieval_belege
  const belege: RetrievalBeleg[] = [
    ...gesetze.map(g => ({ quelle: "gesetz" as const, chunkId: g.id, ... })),
    ...urteile.map(u => ({ quelle: "urteil" as const, chunkId: u.id, ... })),
    ...muster.map(m => ({ quelle: "muster" as const, chunkId: m.id, ... })),
  ];

  // 4. generateObject with RAG context
  const result = await generateObject({
    model,
    schema: RechtlicheWuerdigungSchema,
    system: buildSectionPrompt("rechtliche_wuerdigung", gesetze, urteile, muster),
    prompt: buildSectionInput(slots),
  });

  return { content: result.object.text, belege };
}
```

### Pattern 4: Klageart Registry (Data-Driven Slot Definitions)
**What:** Each Klageart has a registry entry defining: required slots, optional slots, section templates, Rechtsgebiet mapping, default Anspruchsgrundlagen, Streitwert calculation rules, and ERV-specific validations.
**When to use:** For deterministic slot-filling and validation rules per Klageart.
**Example:**
```typescript
interface KlageartDefinition {
  id: string;
  label: string;
  rechtsgebiet: Sachgebiet;
  stadien: Stadium[];
  requiredSlots: SlotDefinition[];
  optionalSlots: SlotDefinition[];
  sections: SectionConfig[];
  streitwertRegel: StreitwertRegel;
  ervPruefungen: ErvPruefung[];
}

const KLAGEART_REGISTRY: Record<string, KlageartDefinition> = {
  "kschg_klage": {
    id: "kschg_klage",
    label: "Kuendigungsschutzklage",
    rechtsgebiet: "ARBEITSRECHT",
    stadien: ["ERSTINSTANZ", "BERUFUNG"],
    requiredSlots: [
      { key: "klaeger_name", label: "Name des Klaegers", prefillFrom: "mandant" },
      { key: "beklagter_name", label: "Name der Beklagten", prefillFrom: "gegner" },
      { key: "kuendigungsdatum", label: "Datum der Kuendigung", type: "date" },
      { key: "zugang_datum", label: "Zugang der Kuendigung", type: "date" },
      { key: "eintrittsdatum", label: "Eintrittsdatum", type: "date" },
      { key: "bruttogehalt", label: "Monatliches Bruttogehalt", type: "currency" },
    ],
    streitwertRegel: { typ: "VIERTELJAHRESGEHALT", faktor: 3 },
    ervPruefungen: [
      { id: "kschg_frist", check: "3_WOCHEN_FRIST", params: { fromSlot: "zugang_datum" } },
    ],
    // ...
  },
  "lohnklage": { /* ... */ },
  "ev_antrag": { /* ... */ },
  // ...
};
```

### Pattern 5: Pipeline Integration Point (Classifier Hook)
**What:** The existing complexity classifier already routes "Schriftsatz + Klage/Antrag" to tier 3 + background. The pipeline intercepts at the `runHelenaAgent` level: if the classifier detects a Schriftsatz intent, it calls `runSchriftsatzPipeline` instead of `runAgent`.
**When to use:** To integrate without modifying the existing ReAct agent.
**Example:**
```typescript
// In src/lib/helena/index.ts -- new branch before runAgent
if (classification.tier === 3 && isSchriftsatzIntent(message)) {
  // Use deterministic pipeline instead of ReAct
  const pipelineResult = await runSchriftsatzPipeline({
    prisma, userId, userRole, userName,
    akteId, message, abortSignal,
    onStepUpdate,
  });
  // Convert pipeline result to HelenaAgentResult
  return mapPipelineToAgentResult(pipelineResult);
}
```

### Anti-Patterns to Avoid
- **Free-form Schriftsatz generation via ReAct:** The user explicitly decided against this. The Schriftsatz pipeline MUST be deterministic with a fixed stage sequence.
- **Single monolithic generateObject call for entire Schriftsatz:** Too large a schema; LLMs hallucinate more with complex nested schemas. Break into per-section calls.
- **Batched Rueckfragen:** User decided on conversational style (one question at a time). Do NOT present a form with all missing fields.
- **Hard-blocking ERV validation:** Validator produces warnings[], never prevents draft creation. Anwalt always has final say.
- **Mixing placeholder conventions:** The codebase has two conventions: `{{UPPER_SNAKE_CASE}}` (amtliche Muster) and `{{dotted.key}}` (Vorlagen). Must unify to one standard.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured LLM output | Custom JSON parsing + Zod validation | `generateObject` from AI SDK v4 | Already proven in project; handles retries, schema coercion, provider differences |
| RAG retrieval | New vector search pipeline | Existing `searchLawChunks` / `searchUrteilChunks` / `searchMusterChunks` + `hybridSearch` | Full BM25+vector+RRF+reranker pipeline already built and tested |
| Placeholder resolution | New template engine | Existing `resolvePlatzhalter` + `PLATZHALTER_GRUPPEN` from `vorlagen.ts` | Complete placeholder system with all party/akte/date fields already defined |
| RVG fee calculation | Manual fee lookup | Existing `RvgCalculator` builder + `GKG_2025` table | Full VV-catalog, Anrechnung, PKH logic already implemented |
| Party name formatting | String concatenation | Existing `formatName` / `formatAnschrift` from `vorlagen.ts` | Handles natural/legal person, title, address edge cases |
| Document search | New search pipeline | Existing `hybridSearch` from `hybrid-search.ts` | BM25+pgvector+RRF+Ollama reranking already operational |
| Embedding generation | New embedding logic | Existing `generateQueryEmbedding` / `generateEmbedding` from `embedder.ts` | E5 instruction prefixes, batching, graceful fallback already built |
| Model selection | Manual provider wiring | Existing `getModelForTier(3)` from `complexity-classifier.ts` | Tier 3 = cloud model for highest quality, already configured |

**Key insight:** This phase is primarily an orchestration challenge, not an infrastructure challenge. Every building block (RAG, embeddings, models, Prisma models, placeholder engine, fee calculators) already exists. The new code is the pipeline that wires them together in a deterministic sequence.

## Common Pitfalls

### Pitfall 1: Schema Size Explosion
**What goes wrong:** A single Zod schema for the entire SchriftsatzSchema (Rubrum + Antraege + Sachverhalt + Rechtliche Wuerdigung + Beweisangebote + Anlagen + Kosten + Formales) becomes too complex for reliable generateObject output.
**Why it happens:** LLMs struggle with deeply nested schemas exceeding ~20 fields. JSON mode schema compliance degrades significantly above this threshold.
**How to avoid:** Generate sections independently via per-section generateObject calls. Assemble the final SchriftsatzSchema in code, not in the LLM.
**Warning signs:** LLM returns partial objects, omits nested arrays, or hallucinates field names.

### Pitfall 2: Rueckfrage Loop Never Terminates
**What goes wrong:** Slot-filling asks one question at a time but the user provides vague answers, creating an endless loop.
**Why it happens:** No maximum iteration count; LLM keeps finding "missing" information.
**How to avoid:** Cap at 10 Rueckfragen per pipeline run. After cap, fill remaining gaps with `{{PLATZHALTER}}` and mark draft as incomplete. Always offer "weiss ich noch nicht" as valid answer.
**Warning signs:** More than 5 consecutive Rueckfragen without slot progress.

### Pitfall 3: Placeholder Convention Clash
**What goes wrong:** Generated output uses `{{Klaeger_Name}}` while the template engine expects `{{mandant.name}}` or `{{KLAEGER_NAME}}`.
**Why it happens:** Two conventions exist in the codebase: `{{UPPER_SNAKE_CASE}}` in amtliche Muster (seed-amtliche.ts) and `{{dotted.key}}` in DokumentVorlage system (vorlagen.ts).
**How to avoid:** Define a unified PlatzhalterStandard enum/map. For Schriftsatz pipeline output, use `{{UPPER_SNAKE_CASE}}` consistently (matching the amtliche Muster convention). Provide a mapping function to convert to dotted-key format when needed for Vorlage generation.
**Warning signs:** Placeholders in output don't match what `resolvePlatzhalter` can fill.

### Pitfall 4: RAG Context Budget Overflow
**What goes wrong:** Per-section RAG retrieval injects too many chunks into generateObject prompts, exceeding context window.
**Why it happens:** 8 law chunks + 5 case law chunks + 3 templates per section = ~40KB of context per section, times 6-8 sections.
**How to avoid:** Cap RAG context per section at 4000 chars (matching the CONTEXT_BUDGET_CHARS pattern in hybrid-search.ts). Prioritize higher-scoring chunks. Use child chunk content for non-top results instead of parent content.
**Warning signs:** Token budget warnings from the model; truncated output.

### Pitfall 5: Missing Akte-Kontext Causes Redundant Rueckfragen
**What goes wrong:** Pipeline asks for Klaeger name even though the Akte has a MANDANT Beteiligter with full contact data.
**Why it happens:** Slot-filler doesn't read Akte data before generating Rueckfragen.
**How to avoid:** ALWAYS pre-fill from Akte before slot validation. The pre-fill step must run before any Rueckfrage generation. Mark pre-filled slots with source attribution ("aus Akte uebernommen").
**Warning signs:** User reports "Helena fragt mich Sachen die in der Akte stehen."

### Pitfall 6: ERV Frist Calculation Timezone Issues
**What goes wrong:** 3-Wochen-Frist check calculates wrong date because of UTC/local timezone mismatch.
**Why it happens:** JavaScript Date arithmetic uses UTC by default; German legal deadlines use local time.
**How to avoid:** Use date-only strings (ISO 8601 `YYYY-MM-DD`) for all deadline calculations. Never use `new Date()` with time components for legal deadline math. Calculate frist as: zugang_datum + 21 calendar days.
**Warning signs:** Frist warnings off by one day at month/year boundaries.

## Code Examples

### SchriftsatzSchema (Core Zod Type)
```typescript
// Comprehensive Zod schema for Schriftsatz intermediate format
import { z } from "zod";

const PartySchema = z.object({
  name: z.string(),
  anschrift: z.string().optional(),
  vertreter: z.string().optional(),
  rolle: z.enum(["KLAEGER", "BEKLAGTER", "ANTRAGSTELLER", "ANTRAGSGEGNER"]),
});

const AnlageSchema = z.object({
  nummer: z.string(), // K1, K2, B1, B2 etc.
  bezeichnung: z.string(),
  dokumentId: z.string().optional(), // Reference to Akte Dokument if available
});

const BeweisangebotSchema = z.object({
  behauptung: z.string(),
  beweismittel: z.string(),
  anlagenNummer: z.string().optional(), // Reference to AnlageSchema.nummer
});

const RetrievalBelegSchema = z.object({
  quelle: z.enum(["gesetz", "urteil", "muster", "akte_dokument"]),
  chunkId: z.string(),
  referenz: z.string(), // "BGB SS 626", "BAG Az. 2 AZR 123/22"
  score: z.number(),
  auszug: z.string(),
});

export const SchriftsatzSchema = z.object({
  // Metadata
  klageart: z.string(),
  rechtsgebiet: z.string(),
  stadium: z.string(),
  rolle: z.string(),
  gerichtszweig: z.string(),
  gericht: z.string(),

  // Sections
  rubrum: z.object({
    gericht: z.string(),
    aktenzeichen: z.string().optional(), // May not exist yet for new filings
    klaeger: PartySchema,
    beklagter: PartySchema,
    wegen: z.string(),
    streitwert: z.number().optional(),
  }),
  antraege: z.array(z.string()), // Numbered claims/motions
  sachverhalt: z.string(), // Full narrative
  rechtlicheWuerdigung: z.string(), // Full legal analysis
  beweisangebote: z.array(BeweisangebotSchema),
  anlagen: z.array(AnlageSchema),
  kosten: z.object({
    streitwert: z.number().optional(),
    gerichtskosten: z.number().optional(),
    hinweise: z.array(z.string()),
  }),
  formales: z.object({
    datum: z.string(),
    unterschrift: z.string(),
    hinweise: z.array(z.string()),
  }),

  // Audit trail
  retrieval_belege: z.array(RetrievalBelegSchema),

  // Status
  unresolved_platzhalter: z.array(z.string()), // {{PLATZHALTER}} that couldn't be filled
  vollstaendig: z.boolean(), // false if any Pflichtfelder are still PLATZHALTER
  warnungen: z.array(z.string()), // ERV-Validator warnings
});

export type Schriftsatz = z.infer<typeof SchriftsatzSchema>;
```

### Intent Router (Stage 1)
```typescript
// Source: project pattern from party-extractor.ts
import { generateObject } from "ai";

const IntentResultSchema = z.object({
  rechtsgebiet: z.enum([
    "ARBEITSRECHT", "ZIVILRECHT", "FAMILIENRECHT", "MIETRECHT",
    "STRAFRECHT", "ERBRECHT", "SOZIALRECHT", "HANDELSRECHT",
    "VERWALTUNGSRECHT", "SONSTIGES",
  ]),
  klageart: z.string().describe("Specific type of filing, e.g. kschg_klage, lohnklage, ev_antrag"),
  stadium: z.enum(["ERSTINSTANZ", "BERUFUNG", "REVISION", "BESCHWERDE", "EV"]),
  rolle: z.enum(["KLAEGER", "BEKLAGTER"]),
  gerichtszweig: z.enum(["ARBG", "LG", "AG", "OLG", "LAG", "BGH", "BAG", "VG"]),
  confidence: z.number().min(0).max(1),
  begruendung: z.string().describe("Why this intent was recognized"),
});

export async function recognizeIntent(
  userMessage: string,
  akteContext: AkteContext | null,
  model: LanguageModel,
): Promise<z.infer<typeof IntentResultSchema>> {
  const contextBlock = akteContext
    ? `\n\nAkte-Kontext:\n- Sachgebiet: ${akteContext.sachgebiet}\n- Kurzrubrum: ${akteContext.kurzrubrum}\n- Beteiligte: ${akteContext.beteiligte.map(b => `${b.rolle}: ${b.name}`).join(", ")}`
    : "";

  const result = await generateObject({
    model,
    schema: IntentResultSchema,
    system: INTENT_ROUTER_SYSTEM_PROMPT,
    prompt: `${userMessage}${contextBlock}`,
  });

  return result.object;
}
```

### ERV-Validator (Pure Function)
```typescript
// No LLM needed -- pure validation logic
interface ErvWarnung {
  typ: "INHALT" | "FORM" | "FRIST";
  schwere: "INFO" | "WARNUNG" | "KRITISCH";
  text: string;
  feld?: string;
}

export function validateErv(
  schriftsatz: Schriftsatz,
  klageart: KlageartDefinition,
): ErvWarnung[] {
  const warnungen: ErvWarnung[] = [];

  // Rubrum completeness (SS 253 ZPO)
  if (!schriftsatz.rubrum.klaeger.name || schriftsatz.rubrum.klaeger.name.includes("{{")) {
    warnungen.push({
      typ: "INHALT", schwere: "KRITISCH",
      text: "Klaeger-Name fehlt oder enthaelt Platzhalter (SS 253 Abs. 2 Nr. 1 ZPO)",
      feld: "rubrum.klaeger.name",
    });
  }

  // KSchG-specific: 3-Wochen-Frist check
  if (klageart.id === "kschg_klage" && schriftsatz.rubrum.klaeger) {
    // Check if Zugang + 21 days is in the past
    const zugangSlot = /* extract from slots */;
    if (zugangSlot && !zugangSlot.includes("{{")) {
      const fristEnde = addDays(parseISO(zugangSlot), 21);
      if (isBefore(fristEnde, new Date())) {
        warnungen.push({
          typ: "FRIST", schwere: "KRITISCH",
          text: `KSchG 3-Wochen-Frist (SS 4 KSchG) abgelaufen am ${format(fristEnde, "dd.MM.yyyy")}`,
        });
      }
    }
  }

  // Formal: file size (beA limit 60MB)
  // Formal: PDF/A requirement
  // Formal: signature requirement
  warnungen.push({
    typ: "FORM", schwere: "INFO",
    text: "Schriftsatz muss vor Einreichung qualifiziert elektronisch signiert werden (SS 130a ZPO)",
  });

  return warnungen;
}
```

## State of the Art

| Old Approach (v0.1) | Current Approach (Phase 22) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| System prompt injection with Muster chunks in KI-Chat route (lines 601-611) | Deterministic pipeline with per-section generateObject | Phase 22 | Structured output, audit trail, validation, no hallucinated structures |
| Free-form markdown output with manual {{PLATZHALTER}} | Zod-validated SchriftsatzSchema with tracked unresolved_platzhalter[] | Phase 22 | Machine-readable output, completeness checking, downstream processing |
| No retrieval provenance | retrieval_belege[] per Schriftsatz with chunkId + source + score | Phase 22 | Full audit trail, BRAK compliance, quality assurance |
| No validation before user sees output | ERV-Validator with inhaltlich + formal checks | Phase 22 | Catches missing fields, expired deadlines, formal requirements |

**Deprecated/outdated:**
- v0.1 KI-Chat Schriftsatz generation via system prompt injection: will be superseded but NOT removed (ki-chat still works for non-Schriftsatz queries)

## Open Questions

1. **Klageart Registry Completeness**
   - What we know: KSchG-Klage and Lohnklage are goldstandard and well-defined. EV-Antrag, Berufung, Klageerwiderung also needed.
   - What's unclear: How many Klagearten should be registered in v0.2? User said "all Rechtsgebiete from the start" but we need finite slot definitions.
   - Recommendation: Start with a generic KlageartDefinition that works for any type, plus specific definitions for the goldstandard cases (KSchG-Klage, Lohnklage). Other Klagearten use the generic definition with fewer pre-validated slots. Expand the registry iteratively.

2. **Rueckfrage UX: Pipeline vs Chat Integration**
   - What we know: Pipeline runs in background (BullMQ). Rueckfragen need to reach the user and collect answers.
   - What's unclear: Does the pipeline pause (WAITING_APPROVAL style) until the user answers? Or does it collect all known data, produce a partial draft, and note what's missing?
   - Recommendation: For Phase 22, produce a partial draft with {{PLATZHALTER}} for anything that can't be pre-filled. The Rueckfrage happens BEFORE the pipeline starts (synchronous slot-collection in chat), and the pipeline only runs once slots are sufficiently filled. The pipeline itself is fire-and-forget with no mid-execution user interaction.

3. **generateObject Provider Compatibility**
   - What we know: AI SDK v4.3.19 generateObject works with OpenAI, Anthropic, and Ollama. Project uses all three.
   - What's unclear: Ollama qwen3.5:35b schema compliance quality for complex nested Zod schemas. The orchestrator test notes Ollama tool-call instability.
   - Recommendation: Tier 3 (cloud model) is already the default for Schriftsatz generation per complexity classifier. For Ollama fallback, keep schemas simple (flat, few fields) and test thoroughly.

## Sources

### Primary (HIGH confidence)
- Project codebase analysis: `src/lib/helena/orchestrator.ts`, `src/lib/helena/index.ts`, `src/lib/helena/complexity-classifier.ts` -- current agent architecture
- Project codebase analysis: `src/lib/ai/party-extractor.ts`, `src/lib/ai/deadline-extractor.ts` -- proven generateObject patterns
- Project codebase analysis: `src/lib/helena/tools/_read/search-gesetze.ts`, `search-urteile.ts`, `search-muster.ts` -- RAG retrieval patterns
- Project codebase analysis: `src/lib/embedding/hybrid-search.ts` -- hybrid search pipeline
- Project codebase analysis: `src/lib/vorlagen.ts` -- placeholder system (PLATZHALTER_GRUPPEN, resolvePlatzhalter)
- Project codebase analysis: `src/lib/finance/rvg/calculator.ts`, `gkg-table.ts` -- fee calculation infrastructure
- Project codebase analysis: `src/lib/muster/seed-amtliche.ts` -- {{UPPER_SNAKE_CASE}} placeholder convention in legal templates
- Project codebase analysis: `prisma/schema.prisma` -- HelenaDraft, HelenaTask, Beteiligter, Akte, Kontakt models
- Project codebase analysis: `src/app/api/ki-chat/route.ts` lines 601-611 -- v0.1 Schriftsatz generation being replaced

### Secondary (MEDIUM confidence)
- AI SDK v4 documentation for generateObject API behavior, schema constraints, and provider compatibility
- ZPO SS 253 (Klageschrift requirements), SS 130a (electronic filing), SS 130 (form requirements) -- well-established German procedural law

### Tertiary (LOW confidence)
- Ollama qwen3.5:35b schema compliance for complex nested Zod schemas -- needs empirical testing during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use in the project
- Architecture: HIGH -- deterministic pipeline pattern is straightforward; all building blocks exist
- Pitfalls: HIGH -- identified from actual codebase patterns and known LLM limitations
- Klageart registry completeness: MEDIUM -- goldstandard cases are clear, generic fallback strategy is sound but untested

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable domain -- German procedural law does not change frequently)
