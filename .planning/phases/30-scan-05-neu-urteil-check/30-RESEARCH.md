# Phase 30: SCAN-05 Neu-Urteil-Check - Research

**Researched:** 2026-02-28
**Domain:** Cross-Akte semantic matching (pgvector), BullMQ job orchestration, LLM briefing generation
**Confidence:** HIGH

## Summary

Phase 30 implements a proactive court-decision-to-case matching system. When new Urteile are ingested via the daily BMJ RSS sync, the system compares them against active Akten using pgvector cosine similarity and generates NEUES_URTEIL alerts with Helena-produced briefings for relevant matches.

The existing codebase provides all building blocks: `generateEmbedding()` for Ollama E5 embeddings (1024d), `createScannerAlert()` for the full alert pipeline (dedup, AktenActivity, Socket.IO), `processUrteileSyncJob()` as the trigger point, and `getModel()`/`generateText()` for LLM calls. The NEUES_URTEIL enum value already exists in HelenaAlertTyp, and the Alert-Center UI already handles unknown types via fallback rendering. The main implementation work is: (1) adding a vector column to Akte + migration, (2) building the summary text assembler, (3) a nightly embedding refresh cron job, (4) a cross-matching function triggered after Urteile sync, (5) an LLM briefing generator, and (6) two new SystemSettings with admin UI controls.

**Primary recommendation:** Follow the existing scanner check pattern (batch query, resolveAlertRecipients, createScannerAlert) but trigger the Neu-Urteil check from the urteile-sync completion handler rather than the nightly scanner cron, since it needs to run immediately after new Urteile are ingested. The Akte embedding refresh should be a separate cron job running before the Urteile sync (e.g., 02:30).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use everything available for the summary: kurzrubrum + sachgebiet + wegen + HelenaMemory.content (summary, risks, relevantNorms) + Falldaten JSON + pinned Normen
- Store embedding as a new vector column directly on the Akte model (Prisma migration)
- Refresh via nightly BullMQ cron, running before the scanner checks -- rebuild all active Akte embeddings daily
- Akten without HelenaMemory or Falldaten still get embedded from core fields (graceful degradation)
- Match as a batch after processUrteileSyncJob() completes -- all newly inserted Urteile against all active Akten in one pass
- Single global cosine similarity threshold (default ~0.72) stored in SystemSetting -- per-Sachgebiet thresholds deferred to SCAN-F01
- Alert all Akten above threshold per Urteil -- no artificial cap on matches
- Pre-filter by Sachgebiet: only match Urteile against Akten with matching rechtsgebiet, then run semantic similarity within that subset
- Alert title format: "Relevantes Urteil fuer [Akte Kurzrubrum]" -- user-centric, highlights which Akte is affected
- Briefing uses structured format with sections: 1) Was wurde entschieden? 2) Warum relevant fuer diese Akte? 3) Moegliche Auswirkungen -- requires LLM call (Helena/Ollama)
- No auto-resolve for NEUES_URTEIL alerts -- stay until manually dismissed (a relevant Urteil is always relevant)
- Severity is score-based: map cosine similarity to severity (higher similarity = higher severity)
- Threshold setting lives in existing Scanner settings section (alongside scanner.enabled, frist_threshold_hours etc.)
- UI control: range slider 0.50-0.95 with current value displayed and "Strenger" / "Lockerer" labels
- Separate scanner.neues_urteil_enabled toggle -- admin can disable Urteil matching independently from main scanner

### Claude's Discretion
- Exact text concatenation format and field ordering for Akte summary embedding
- Whether the admin sees a match count preview when adjusting threshold (feedback vs complexity tradeoff)
- Exact severity-to-score mapping ranges
- LLM prompt design for the structured briefing

### Deferred Ideas (OUT OF SCOPE)
- SCAN-F01: Per-Sachgebiet relevance thresholds -- already tracked as future requirement
- Helena reads past NEUES_URTEIL alerts to build case strategy recommendations -- separate phase
- Urteil-to-Urteil citation graph (which Urteile cite each other) -- separate capability
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCAN-01 | System generates summary embedding per active Akte from case context | Akte model vector column + embedding assembler function using existing `generateEmbedding()` from `src/lib/embedding/embedder.ts` |
| SCAN-02 | After RSS-Urteil ingestion, system matches new Urteile against active Akten via semantic similarity | Cross-matching function using pgvector cosine similarity with Sachgebiet pre-filter, triggered from `processUrteileSyncJob()` completion |
| SCAN-03 | User receives NEUES_URTEIL alert when a relevant Urteil is found | Existing `createScannerAlert()` + `resolveAlertRecipients()` pipeline; NEUES_URTEIL already in HelenaAlertTyp enum; Alert-Center UI needs NEUES_URTEIL entry in type config |
| SCAN-04 | Admin can configure relevance threshold via SystemSetting | Two new DEFAULT_SETTINGS entries (scanner.neues_urteil_enabled, scanner.neues_urteil_threshold) + custom slider in admin settings page |
| SCAN-05 | Alert includes Helena-generated briefing explaining why the Urteil is relevant | LLM call using `getModel()` + `generateText()` with structured prompt; briefing stored in alert.inhalt field |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pgvector | (Postgres ext) | Cosine similarity vector search | Already used for document_chunks, law_chunks, urteil_chunks |
| Prisma | Current | Schema migration for Akte embedding column | Project ORM, all models in schema.prisma |
| BullMQ | Current | Cron job for Akte embedding refresh + cross-matching trigger | Already powers 16 queues in src/worker.ts |
| Vercel AI SDK | v4 | LLM briefing generation via generateText() | Project standard, multi-provider via getModel() |
| Ollama E5 | multilingual-e5-large-instruct | Embedding model (1024 dimensions) | Already used in src/lib/embedding/embedder.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pgvector (npm) | Current | `pgvector.toSql()` for vector SQL formatting | Every raw SQL vector insert/query |
| date-fns | Current | Date formatting in alert messages | Alert content generation |
| pino (via createLogger) | Current | Structured logging | All new modules |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw SQL for vector ops | Prisma native | Prisma does not support pgvector natively; raw SQL is the project pattern |
| Separate matching table | In-memory matching | Not needed -- pgvector handles the similarity search efficiently |

**Installation:**
```bash
# No new packages needed -- zero new npm packages policy (v0.2 decision, continues into v0.3)
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── scanner/
│   │   ├── checks/
│   │   │   └── neues-urteil-check.ts    # Cross-matching logic (SCAN-02, SCAN-03, SCAN-05)
│   │   ├── akte-embedding.ts            # Summary text assembler + embedding generator (SCAN-01)
│   │   ├── service.ts                   # Existing -- createScannerAlert (reused)
│   │   └── types.ts                     # Existing -- CheckResult (reused)
│   ├── settings/
│   │   └── defaults.ts                  # Add 2 new settings (SCAN-04)
│   └── queue/
│       ├── queues.ts                    # Add akte-embedding queue + registerAkteEmbeddingJob
│       └── processors/
│           └── urteile-sync.processor.ts # Hook cross-matching after sync completes
├── workers/
│   └── processors/
│       └── scanner.ts                   # No change needed -- Neu-Urteil runs from urteile-sync, not scanner
├── app/
│   └── (dashboard)/admin/settings/
│       └── page.tsx                     # Add slider control for threshold (SCAN-04)
└── components/
    └── helena/
        └── alert-center.tsx             # Add NEUES_URTEIL to ALERT_TYPE_CONFIG + TYPE_CHIPS
```

### Pattern 1: Akte Summary Text Assembly
**What:** Concatenate case context fields into a single text for embedding
**When to use:** Before calling `generateEmbedding()` for an Akte
**Example:**
```typescript
// Recommended field ordering for maximum semantic signal
function assembleAkteSummaryText(akte: AkteWithContext): string {
  const parts: string[] = [];

  // Core identity (always available)
  parts.push(`Sachgebiet: ${akte.sachgebiet}`);
  parts.push(`Kurzrubrum: ${akte.kurzrubrum}`);
  if (akte.wegen) parts.push(`Wegen: ${akte.wegen}`);

  // HelenaMemory (richest source when available)
  if (akte.helenaMemory?.content) {
    const mem = akte.helenaMemory.content as HelenaMemoryContent;
    if (mem.summary) parts.push(`Zusammenfassung: ${mem.summary}`);
    if (mem.risks?.length) parts.push(`Risiken: ${mem.risks.join("; ")}`);
    if (mem.relevantNorms?.length) parts.push(`Relevante Normen: ${mem.relevantNorms.join(", ")}`);
    if (mem.proceduralStatus) parts.push(`Verfahrensstand: ${mem.proceduralStatus}`);
  }

  // Falldaten JSON (structured case facts)
  if (akte.falldaten) {
    const fd = akte.falldaten as Record<string, unknown>;
    const fdText = Object.entries(fd)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join("; ");
    if (fdText) parts.push(`Falldaten: ${fdText}`);
  }

  // Pinned Normen
  if (akte.normen?.length) {
    const normenText = akte.normen
      .map((n) => `${n.gesetzKuerzel} ${n.paragraphNr}`)
      .join(", ");
    parts.push(`Gepinnte Normen: ${normenText}`);
  }

  return parts.join("\n");
}
```

### Pattern 2: Sachgebiet Pre-Filter Mapping
**What:** Map urteil_chunks.rechtsgebiet (free text) to Akte.sachgebiet (enum) for pre-filtering
**When to use:** Before running vector similarity to narrow the search space
**Critical insight:** The RECHTSGEBIET_MAP in rss-client.ts produces these strings:
```
BAG    -> "Arbeitsrecht"     -> ARBEITSRECHT (direct match)
BGH    -> "Zivilrecht"       -> maps to multiple: FAMILIENRECHT, MIETRECHT, ERBRECHT, HANDELSRECHT, INKASSO
BVerwG -> "Verwaltungsrecht" -> VERWALTUNGSRECHT (direct match)
BFH    -> "Steuerrecht"      -> no Sachgebiet match (SONSTIGES fallback)
BSG    -> "Sozialrecht"      -> SOZIALRECHT (direct match)
BPatG  -> "Patentrecht"      -> no Sachgebiet match (SONSTIGES fallback)
BVerfG -> "Verfassungsrecht" -> no Sachgebiet match (cross-cutting, match all)
```
**Example:**
```typescript
const RECHTSGEBIET_TO_SACHGEBIET: Record<string, string[]> = {
  "Arbeitsrecht":     ["ARBEITSRECHT"],
  "Zivilrecht":       ["FAMILIENRECHT", "MIETRECHT", "ERBRECHT", "HANDELSRECHT", "INKASSO", "VERKEHRSRECHT"],
  "Verwaltungsrecht": ["VERWALTUNGSRECHT"],
  "Steuerrecht":      ["SONSTIGES"],  // No specific Sachgebiet
  "Sozialrecht":      ["SOZIALRECHT"],
  "Patentrecht":      ["SONSTIGES"],  // No specific Sachgebiet
  "Verfassungsrecht": [],             // Cross-cutting: match all Akten (no pre-filter)
};
```

### Pattern 3: Cross-Matching Query (pgvector)
**What:** Batch cosine similarity between new Urteile and active Akte embeddings
**When to use:** After processUrteileSyncJob() returns with inserted > 0
**Example:**
```typescript
// For each newly inserted Urteil, find matching Akten above threshold
// Uses the existing pgvector cosine distance operator (<=>)
const matches = await prisma.$queryRaw<MatchRow[]>`
  SELECT
    a.id AS "akteId",
    a.kurzrubrum,
    a."anwaltId",
    a."sachbearbeiterId",
    1 - (a."summaryEmbedding" <=> uc.embedding) AS score
  FROM akten a
  INNER JOIN urteil_chunks uc ON uc.id = ${urteilChunkId}
  WHERE a.status = 'OFFEN'
    AND a."summaryEmbedding" IS NOT NULL
    AND a.sachgebiet = ANY(${sachgebietFilter}::text[])
    AND 1 - (a."summaryEmbedding" <=> uc.embedding) >= ${threshold}
  ORDER BY score DESC
`;
```

### Pattern 4: LLM Briefing Generation
**What:** Generate structured German briefing explaining Urteil relevance to a specific Akte
**When to use:** For each match above threshold, before creating the alert
**Example:**
```typescript
const briefing = await generateText({
  model: await getModel(),
  system: `Du bist Helena, eine KI-Rechtsanwaltsfachangestellte. Erstelle eine kurze Anwaltsnotiz
die erklaert, warum ein neues Urteil fuer eine bestimmte Akte relevant ist.
Antworte NUR auf Deutsch. Verwende das folgende Format:

**Was wurde entschieden?**
[1-2 Saetze zum Urteil]

**Warum relevant fuer diese Akte?**
[1-2 Saetze zur Verbindung]

**Moegliche Auswirkungen**
[1-2 Saetze zu konkreten Handlungsempfehlungen]`,
  prompt: `Urteil: ${urteilContent}
Gericht: ${gericht}, Aktenzeichen: ${aktenzeichen}, Datum: ${datum}

Akte: ${akteSummaryText}
Kurzrubrum: ${kurzrubrum}
Sachgebiet: ${sachgebiet}

Cosine-Similarity-Score: ${score.toFixed(3)}`,
  maxTokens: 500,
});
```

### Anti-Patterns to Avoid
- **Running LLM calls inside the vector matching loop:** Generate embeddings and run similarity search first, then batch LLM calls only for confirmed matches. LLM is 100x slower than vector search.
- **Embedding at query time:** Akte embeddings must be pre-computed (nightly cron), not generated during the matching pass. The matching function should only read existing embeddings.
- **Blocking urteile-sync on matching:** The cross-matching should be triggered as a separate job/step after urteile-sync completes, not blocking the sync pipeline. If matching fails, Urteile are still safely ingested.
- **N+1 Akte queries during matching:** Use a single batch pgvector query per Urteil, not individual queries per Akte.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vector similarity search | Custom distance calculation | pgvector `<=>` operator + HNSW index | Already optimized for cosine distance, handles 1024d vectors efficiently |
| Alert creation + dedup | Custom alert pipeline | `createScannerAlert()` from `src/lib/scanner/service.ts` | Handles 24h dedup, AktenActivity, Socket.IO badge in one call |
| Alert recipient routing | Custom user lookup | `resolveAlertRecipients()` | Handles Verantwortlicher + Vertreter vacation routing |
| Embedding generation | Custom Ollama calls | `generateEmbedding()` from `src/lib/embedding/embedder.ts` | Handles E5 prefix, timeout, error handling |
| LLM provider selection | Hardcoded Ollama | `getModel()` from `src/lib/ai/provider.ts` | Multi-provider (Ollama/OpenAI/Anthropic) via SystemSettings |
| Token budget tracking | Manual counting | `checkBudget()` + `trackTokenUsage()` | Budget enforcement and admin dashboard metrics |
| Settings read/write | Direct DB queries | `getSettingTyped()` / `updateSetting()` | In-memory cache, Redis pub/sub propagation |
| Cron job registration | Manual BullMQ setup | `upsertJobScheduler` pattern from `queues.ts` | Idempotent registration, timezone-aware scheduling |

**Key insight:** Every component of this feature has a direct precedent in the codebase. The only truly new logic is the summary text assembly and the cross-matching query.

## Common Pitfalls

### Pitfall 1: Sachgebiet Mismatch Between Urteile and Akten
**What goes wrong:** urteil_chunks.rechtsgebiet is a free-text string ("Arbeitsrecht") while Akte.sachgebiet is an enum (ARBEITSRECHT). Direct string comparison fails.
**Why it happens:** Different source systems use different formats.
**How to avoid:** Build an explicit mapping table (RECHTSGEBIET_TO_SACHGEBIET). Also handle edge cases: BGH "Zivilrecht" maps to many Sachgebiete, BVerfG "Verfassungsrecht" is cross-cutting (match all Akten). Urteile with null rechtsgebiet should be matched against all Akten (no pre-filter).
**Warning signs:** Zero matches in production despite high cosine similarity.

### Pitfall 2: Embedding Column Migration on Existing Table
**What goes wrong:** Adding `Unsupported("vector(1024)")` to the Akte model causes Prisma migrate issues because Prisma cannot natively handle pgvector types.
**Why it happens:** Prisma treats `Unsupported` types as opaque -- it creates the column but cannot generate proper migration SQL for vector types.
**How to avoid:** Create a manual SQL migration file (like `manual_rag_hnsw_indexes.sql`) to add the column and HNSW index. The Prisma schema declares the field as `Unsupported("vector(1024)")?` for type awareness, but the actual column creation is done via raw SQL in the migration or startup.
**Warning signs:** `prisma migrate dev` generates incomplete migration, column type shows as `text` instead of `vector(1024)`.

### Pitfall 3: Ollama Contention During Batch Operations
**What goes wrong:** Embedding all active Akten and then running LLM briefings for matches creates a long pipeline of sequential Ollama calls. If another queue (helena-task, document-embedding) also needs Ollama, they contend for GPU resources.
**Why it happens:** Ollama runs on a single GPU; concurrent embedding + LLM calls degrade both.
**How to avoid:** Schedule the Akte embedding refresh to run at 02:30 (between gesetze-sync at 02:00 and urteile-sync at 03:00). The matching + briefing runs immediately after urteile-sync (03:00+). Ensure concurrency: 1 on the worker to serialize Ollama access.
**Warning signs:** Embedding timeouts (EMBEDDING_TIMEOUT is 10s), LLM calls exceeding 120s lockDuration.

### Pitfall 4: Empty/Minimal Akte Embeddings
**What goes wrong:** Akten with only kurzrubrum + sachgebiet produce very short summary texts. Short texts generate embeddings that are too generic, causing false-positive matches.
**Why it happens:** New Akten may not yet have HelenaMemory, Falldaten, or pinned Normen.
**How to avoid:** The graceful degradation is correct (embed from core fields), but consider a minimum text length threshold. If the assembled text is very short (< 50 chars), the embedding may be too generic. Log a warning but still embed -- better to have a potentially noisy match than no match at all. The threshold (0.72) should filter most false positives.
**Warning signs:** Akten with only "Sachgebiet: ARBEITSRECHT\nKurzrubrum: Mueller ./. Schmidt" matching unrelated Urteile.

### Pitfall 5: Alert Dedup Behavior for NEUES_URTEIL
**What goes wrong:** The existing 24h dedup in `createScannerAlert()` checks `akteId + typ` -- meaning if the same Akte gets a NEUES_URTEIL alert for Urteil A, then 23 hours later gets matched with Urteil B, the second alert is suppressed.
**Why it happens:** The dedup was designed for scanner checks that fire daily on the same condition.
**How to avoid:** Include the urteilChunkId in the dedup logic. Either: (a) modify the dedup check to also consider `meta.urteilChunkId`, or (b) use a more specific approach -- check for existing alerts where `meta.urteilChunkId = X AND akteId = Y` regardless of time window. Option (b) is cleaner: it prevents re-alerting for the same Urteil-Akte pair ever (since NEUES_URTEIL alerts don't auto-resolve).
**Warning signs:** Only one NEUES_URTEIL alert per Akte per day despite multiple relevant Urteile.

### Pitfall 6: Large Batch Sizes in Cross-Matching
**What goes wrong:** If urteile-sync inserts 50 new Urteile and there are 200 active Akten, running 50 individual pgvector queries is slow.
**Why it happens:** Naive loop: for each Urteil, query all Akten.
**How to avoid:** Consider batching: fetch all newly-inserted Urteil chunk IDs from this sync run, then for each one run a single pgvector query with the Sachgebiet pre-filter. With the pre-filter, each query typically scans 20-50 Akten, not 200. Also: the typical daily RSS yield is 5-20 items per court, so ~100 max per day across all 7 courts. With GUID cache, most are skipped.
**Warning signs:** Matching step taking > 5 minutes (target: < 2 minutes).

## Code Examples

### Prisma Schema Addition for Akte Embedding
```prisma
model Akte {
  // ... existing fields ...

  // Phase 30: Summary embedding for Neu-Urteil matching
  summaryEmbedding     Unsupported("vector(1024)")?
  summaryEmbeddingAt   DateTime?  // Last embedding refresh timestamp

  // ... existing relations ...
}
```

### Manual SQL Migration for Vector Column + Index
```sql
-- Phase 30: Akte summary embedding for SCAN-05 Neu-Urteil-Check
ALTER TABLE akten ADD COLUMN IF NOT EXISTS "summaryEmbedding" vector(1024);
ALTER TABLE akten ADD COLUMN IF NOT EXISTS "summaryEmbeddingAt" TIMESTAMP;

-- HNSW index for efficient cosine similarity search on Akte embeddings
CREATE INDEX IF NOT EXISTS akten_summary_embedding_hnsw
  ON akten USING hnsw ("summaryEmbedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### New SystemSetting Defaults
```typescript
// In src/lib/settings/defaults.ts, add to scanner category:
{
  key: "scanner.neues_urteil_enabled",
  value: "true",
  type: "boolean",
  category: "scanner",
  label: "Neu-Urteil-Check aktiviert",
},
{
  key: "scanner.neues_urteil_threshold",
  value: "0.72",
  type: "number",
  category: "scanner",
  label: "Relevanz-Schwellenwert (Cosine Similarity)",
  min: 0.50,
  max: 0.95,
},
```

### Severity Mapping (Claude's Discretion)
```typescript
// Map cosine similarity score to alert severity (1-10)
// Higher similarity = higher severity
function scoreToseverity(score: number): number {
  if (score >= 0.90) return 9;  // Very high relevance
  if (score >= 0.85) return 8;  // High relevance
  if (score >= 0.80) return 7;  // Above average
  if (score >= 0.75) return 6;  // Moderate-high
  return 5;                      // Threshold match (default moderate)
}
```

### Alert-Center NEUES_URTEIL Config Addition
```typescript
// Add to ALERT_TYPE_CONFIG in src/components/helena/alert-center.tsx:
NEUES_URTEIL: {
  icon: Scale,  // from lucide-react (legal/justice icon)
  label: "Neues Urteil",
  color: "text-violet-600 dark:text-violet-400",
},

// Add to TYPE_CHIPS:
{ value: "NEUES_URTEIL", label: "Neues Urteil" },
```

### Cross-Match Trigger in urteile-sync Worker
```typescript
// In src/worker.ts, modify urteileSyncWorker.on("completed"):
urteileSyncWorker.on("completed", async (job) => {
  if (!job) return;
  const result = job.returnvalue as { inserted: number };
  log.info({ jobId: job.id, result }, "[Worker] urteile-sync job completed");

  // Trigger cross-matching if any new Urteile were inserted
  if (result?.inserted > 0) {
    const enabled = await getSettingTyped<boolean>("scanner.neues_urteil_enabled", true);
    if (enabled) {
      // Enqueue the cross-matching job (separate queue for isolation)
      // Or call directly since urteile-sync is already concurrency: 1
      try {
        await runNeuesUrteilCheck();
        log.info("Neu-Urteil cross-matching completed");
      } catch (err) {
        log.error({ err }, "Neu-Urteil cross-matching failed (non-fatal)");
      }
    }
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-document embedding only | Per-entity (Akte) summary embedding | Phase 30 | Enables entity-level semantic matching, not just document search |
| Scanner is purely rule-based | Scanner + semantic matching | Phase 30 | First scanner check that uses pgvector and LLM |
| Manual Urteil review | Proactive alert-driven review | Phase 30 | Lawyer is notified automatically instead of manually checking feeds |

**Deprecated/outdated:**
- None -- this is a new capability building on existing foundations

## Open Questions

1. **HNSW Index Performance with Mixed Column**
   - What we know: HNSW index works well on dedicated embedding tables (document_chunks, urteil_chunks). Adding it to akten table (which has many non-vector columns and is heavily queried) is new territory.
   - What's unclear: Whether the HNSW index on akten degrades other query performance. Likely negligible since HNSW is a separate data structure, but worth monitoring.
   - Recommendation: Add the index, monitor query performance. The akten table has ~200 rows max for a small Kanzlei -- not a concern at this scale.

2. **Optimal Cosine Similarity Threshold (0.72)**
   - What we know: The 0.72 default is an estimate from the user, not empirically validated. E5 multilingual embeddings can have different similarity distributions than English-only models.
   - What's unclear: Whether 0.72 produces good precision/recall for German legal texts. May need tuning after deployment.
   - Recommendation: Make configurable via SystemSetting (already decided). Log match scores in the first weeks to calibrate. Consider starting at 0.70 and adjusting upward if too many false positives appear.

3. **Newly Inserted Urteil IDs for Cross-Matching**
   - What we know: `processUrteileSyncJob()` currently returns `{ inserted, skipped, piiRejected, failed }` -- counts only, not IDs.
   - What's unclear: How to identify which specific urteil_chunks were newly inserted in this sync run.
   - Recommendation: Either (a) modify processUrteileSyncJob() to also return inserted IDs, or (b) query urteil_chunks by `ingestedAt >= syncStartTime`. Option (b) is simpler and avoids changing the existing sync processor signature. Record the start timestamp before calling processUrteileSyncJob().

4. **Admin Threshold UI Control (No Slider Package)**
   - What we know: The existing admin settings page uses standard Input (number), Switch (boolean), and Select (options) components. `@radix-ui/react-slider` is NOT installed, and zero-new-packages policy prohibits adding it.
   - What's clear: HTML5 `<input type="range">` provides native slider functionality without any package dependency.
   - Recommendation: Use native HTML5 `<input type="range" min="0.50" max="0.95" step="0.01">` styled with Tailwind CSS. This gives the slider UX the user requested without adding any packages. Display the current value alongside "Strenger" / "Lockerer" labels.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/embedding/embedder.ts` -- verified generateEmbedding() API, 1024 dimensions, E5 prefix format
- Codebase analysis: `src/lib/scanner/service.ts` -- verified createScannerAlert() signature and dedup behavior
- Codebase analysis: `src/lib/urteile/ingestion.ts` -- verified searchUrteilChunks() pgvector pattern
- Codebase analysis: `src/workers/processors/scanner.ts` -- verified scanner processor pattern
- Codebase analysis: `src/worker.ts` -- verified BullMQ worker setup, queue registrations, cron schedules
- Codebase analysis: `src/lib/queue/queues.ts` -- verified upsertJobScheduler pattern
- Codebase analysis: `src/lib/settings/defaults.ts` -- verified SettingDefinition format and scanner category
- Codebase analysis: `src/components/helena/alert-center.tsx` -- verified ALERT_TYPE_CONFIG and TYPE_CHIPS format
- Codebase analysis: `prisma/schema.prisma` -- verified Akte model, HelenaMemory, HelenaAlert, HelenaAlertTyp enum, UrteilChunk model
- Codebase analysis: `src/lib/urteile/rss-client.ts` -- verified RECHTSGEBIET_MAP values
- Codebase analysis: `src/lib/ai/provider.ts` -- verified getModel()/generateText() pattern

### Secondary (MEDIUM confidence)
- pgvector HNSW behavior on mixed tables -- based on general pgvector documentation knowledge, not specifically tested on this codebase

### Tertiary (LOW confidence)
- Optimal threshold of 0.72 for E5 multilingual German legal text embeddings -- user estimate, needs empirical validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, zero new packages needed
- Architecture: HIGH - follows established patterns (scanner checks, pgvector queries, BullMQ jobs)
- Pitfalls: HIGH - identified from direct codebase analysis (dedup behavior, Sachgebiet mismatch, Ollama contention)
- LLM prompt design: MEDIUM - structured format decided, but prompt quality needs iteration
- Threshold calibration: LOW - 0.72 is an estimate, not empirically validated

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable -- all foundational code exists)
