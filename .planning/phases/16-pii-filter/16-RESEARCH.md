# Phase 16: PII-Filter - Research

**Researched:** 2026-02-27
**Domain:** NER-based PII anonymization for German legal text via Ollama + BullMQ state machine
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| URTEIL-03 | NER-basierter PII-Filter via Ollama (5+ German-Legal-Few-Shot-Beispiele + Institution-Whitelist-Regex fuer Gerichtsnamen) — nur Urteile mit `pii_geprueft: true` werden indexiert | Few-shot prompt design documented, whitelist regex patterns provided, Ollama `/api/generate` with `format:json` verified |
| ARBW-03 | PII-Anonymisierung vor Ingestion kanzlei-eigener Muster via Ollama NER (identisches Modul wie URTEIL-03); Status-Machine `PENDING_NER → NER_RUNNING → INDEXED | REJECTED_PII_DETECTED` — kein Bypass-Pfad (BRAO §43a) | MusterNerStatus enum already in schema, BullMQ processor pattern documented, state machine design verified |

</phase_requirements>

---

## Summary

Phase 16 builds a single reusable NER-PII-filter module consumed by two downstream phases: Phase 17 (Urteile-RAG) and Phase 18 (Muster-RAG). The filter uses Ollama's `/api/generate` endpoint with `qwen3.5:35b` (already the project's validated LLM) to extract named persons from German legal text in a few-shot prompted JSON format, combined with a Regex-based institution whitelist that prevents courts and government bodies from being classified as PII.

The state machine for Muster is already defined in the Prisma schema (`MusterNerStatus`: PENDING_NER, NER_RUNNING, INDEXED, REJECTED_PII_DETECTED). The UrteilChunk model uses a simpler `piiFiltered: Boolean` flag. The BullMQ processor pattern is well-established in this codebase (see gesetze-sync.processor.ts, embedding.processor.ts). The NER call must fail hard on timeout (>45s) — no silent pass-through — matching success criterion 4.

**Primary recommendation:** Build `src/lib/pii/ner-filter.ts` as the shared module, add a `ner-pii` BullMQ queue and processor, wire status updates for Muster via Prisma, and write a deterministic acceptance test against 10 hardcoded real Urteil excerpts.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Ollama `/api/generate` | direct fetch | NER inference via qwen3.5:35b | Already used in reranker.ts — same pattern |
| Prisma + `prisma.$executeRaw` | existing | Status machine updates for Muster | Project standard, raw SQL used for vector operations |
| BullMQ | existing | Queue-based NER processing | Entire job pipeline uses BullMQ |
| TypeScript | existing | Type-safe NerResult, filter logic | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | existing in project | Parse and validate Ollama JSON response | Parsing `{ persons: string[] }` from LLM output |
| `createLogger` from `@/lib/logger` | existing | Structured logging in processor | Match existing processor convention |
| Node.js `AbortSignal.timeout()` | built-in | 45s hard timeout on Ollama NER call | Same pattern as reranker.ts (3s), embedder.ts (10s) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| qwen3.5:35b for NER | Dedicated NER model (e.g., UniversalNER on Ollama) | qwen3.5:35b is already validated and pulled; UniversalNER (7B LLaMA2) exists on Ollama but NER quality for German legal text is unverified |
| Few-shot prompt in `/api/generate` | Ollama structured output `format` JSON schema | Both work; `/api/generate` with `format:"json"` + explicit JSON schema in prompt is simpler to parse; Ollama structured output via `format` JSON schema is MORE reliable (grammar-constrained) — use it |
| Inline NER per-document in ingestion | Separate BullMQ queue for NER | BullMQ queue is required for timeout isolation, retries, and state machine correctness |

**Installation:** No new packages needed. All required dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure

```
src/lib/pii/
├── ner-filter.ts          # Core NER module: runNerFilter(), buildNerPrompt(), applyWhitelist()
└── institution-whitelist.ts  # GERMAN_COURT_WHITELIST regex + isInstitutionName()

src/lib/queue/processors/
└── ner-pii.processor.ts   # BullMQ processor: processNerPiiJob()

src/lib/queue/queues.ts    # +nerPiiQueue export
src/worker.ts              # +NER PII Worker registration

tests/pii/
└── ner-filter.acceptance.test.ts  # 10 Urteil excerpts, assertion: no false positives/negatives
```

### Pattern 1: Ollama NER with Structured JSON Output

**What:** POST to `/api/generate` with `format:"json"` + JSON schema embedded in prompt. Ollama's grammar-constrained decoding guarantees valid JSON.

**When to use:** Whenever LLM must return machine-parseable structured data (same pattern as reranker.ts, but reranker uses plain JSON parsing; NER should use `format:"json"` for stricter guarantees).

**Example:**

```typescript
// Source: Ollama API docs (docs.ollama.com/api/generate) + verified pattern from reranker.ts
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const NER_MODEL = "qwen3.5:35b";
const NER_TIMEOUT_MS = 45_000; // 45s per success criterion 4

export interface NerResult {
  persons: string[];      // Full names found that are NOT whitelisted institutions
  hasPii: boolean;        // true if any persons[] remain after whitelist filtering
}

export async function runNerFilter(text: string): Promise<NerResult> {
  const prompt = buildNerPrompt(text);

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: NER_MODEL,
      prompt,
      stream: false,
      format: "json",       // Grammar-constrained JSON output
      temperature: 0,       // Deterministic for compliance
      num_predict: 500,     // Sufficient for persons array
    }),
    signal: AbortSignal.timeout(NER_TIMEOUT_MS), // Hard 45s kill
  });

  if (!response.ok) {
    throw new Error(`Ollama NER failed HTTP ${response.status}`);
  }

  const data = await response.json() as { response: string };
  const parsed = JSON.parse(data.response) as { persons?: string[] };
  const rawPersons = parsed.persons ?? [];

  // Apply institution whitelist — remove false positives
  const filteredPersons = rawPersons.filter(p => !isInstitutionName(p));

  return {
    persons: filteredPersons,
    hasPii: filteredPersons.length > 0,
  };
}
```

### Pattern 2: Institution Whitelist Regex

**What:** Regex patterns covering all German court and government institution name patterns. Applied AFTER NER extraction to remove false positives before PII decision.

**When to use:** Always after NER extraction, before setting `hasPii`.

**Example:**

```typescript
// Source: German federal court system structure (verified against real Urteil metadata)
// These are the exact institution name patterns that MUST NOT be redacted (success criterion 1)

const INSTITUTION_PATTERNS: RegExp[] = [
  // Federal courts (7 Bundesgerichte)
  /\bBundesgerichtshof\b/i,
  /\bBundesarbeitsgericht\b/i,
  /\bBundesverwaltungsgericht\b/i,
  /\bBundesfinanzhof\b/i,
  /\bBundessozialgericht\b/i,
  /\bBundespatentgericht\b/i,
  /\bBundesverfassungsgericht\b/i,
  // Regional courts (pattern-based)
  /\b(Amtsgericht|Landgericht|Oberlandesgericht|Arbeitsgericht|Landesarbeitsgericht|Sozialgericht|Landessozialgericht|Finanzgericht|Verwaltungsgericht|Oberverwaltungsgericht|Bundesgerichtshof)\s+\w+/i,
  /\b(AG|LG|OLG|LAG|LSG|SG|VG|OVG|BAG|BGH|BVerfG|BFH|BVerwG|BSG|BPatG)\b/,
  // Government / statutory bodies
  /\bBundesministerium\b/i,
  /\bLandesministerium\b/i,
  /\bSenatskommission\b/i,
  /\bSenat\b/i,              // "Der Senat" in Urteil headers
  /\bKammer\b/i,             // "Die Kammer", "2. Kammer"
  /\bStaatsanwaltschaft\b/i,
  /\bGeneralbundesanwalt\b/i,
  /\bJustizminister(ium)?\b/i,
];

export function isInstitutionName(candidate: string): boolean {
  return INSTITUTION_PATTERNS.some(pattern => pattern.test(candidate));
}
```

### Pattern 3: Muster State Machine via BullMQ Processor

**What:** BullMQ processor reads Muster rows with `nerStatus: PENDING_NER`, transitions them through NER_RUNNING → INDEXED | REJECTED_PII_DETECTED. Throw on timeout to leave at PENDING_NER.

**When to use:** For all kanzlei-eigene Muster uploaded via /admin/muster (Phase 18 depends on this).

**Example:**

```typescript
// Source: established pattern from gesetze-sync.processor.ts + embedding.processor.ts
import { prisma } from "@/lib/db";
import { runNerFilter } from "@/lib/pii/ner-filter";
import { createLogger } from "@/lib/logger";

const log = createLogger("ner-pii-processor");

export interface NerPiiJobData {
  musterId?: string;     // For Muster NER (ARBW-03)
  urteilText?: string;   // For ad-hoc Urteil NER check (URTEIL-03)
  urteilId?: string;
}

export async function processNerPiiJob(data: NerPiiJobData): Promise<void> {
  if (data.musterId) {
    await processMusterNer(data.musterId);
  } else if (data.urteilText && data.urteilId) {
    await processUrteilNer(data.urteilText, data.urteilId);
  }
}

async function processMusterNer(musterId: string): Promise<void> {
  // Transition: PENDING_NER → NER_RUNNING
  await prisma.muster.update({
    where: { id: musterId },
    data: { nerStatus: "NER_RUNNING" },
  });

  try {
    // Extract text from MinIO (muster.minioKey) — read file content
    const text = await extractMusterText(musterId);

    // Run NER — throws on timeout, which is caught by BullMQ and retried 0 times
    const result = await runNerFilter(text);

    if (result.hasPii) {
      await prisma.muster.update({
        where: { id: musterId },
        data: { nerStatus: "REJECTED_PII_DETECTED" },
      });
      log.warn({ musterId, persons: result.persons }, "Muster rejected: PII detected");
    } else {
      await prisma.muster.update({
        where: { id: musterId },
        data: { nerStatus: "INDEXED" },
      });
      log.info({ musterId }, "Muster NER passed: no PII");
      // Phase 18 will trigger chunk+embedding after INDEXED status
    }
  } catch (err) {
    // Reset to PENDING_NER so next retry picks it up
    await prisma.muster.update({
      where: { id: musterId },
      data: { nerStatus: "PENDING_NER" },
    });
    throw err; // Re-throw so BullMQ marks job failed
  }
}
```

### Pattern 4: Few-Shot NER Prompt for German Legal Text

**What:** Prompt with 5+ authentic German Urteil excerpts demonstrating Person vs. Institution distinction.

**When to use:** As the system/user prompt for the NER Ollama call.

**Critical design:** The prompt MUST include examples where "Bundesgerichtshof", "Amtsgericht Köln", "Kammer" are correctly NOT extracted as persons. The few-shot examples should come from actual BGH/BAG Urteil language.

```typescript
// Source: German LER dataset classes (Leitner et al. 2020, elenanereiss/Legal-Entity-Recognition)
// Verified entity taxonomy: PII = {Person, Richter, Rechtsanwalt}
//                           NOT PII = {Gericht, Institution, Organisation, Land, Stadt, ...}

export function buildNerPrompt(text: string): string {
  return `Du bist ein Datenschutz-Experte fuer deutsche Gerichtsentscheidungen.
Deine Aufgabe: Extrahiere alle vollstaendigen Personennamen natuerlicher Personen aus dem Text.

WICHTIGE REGELN:
- Extrahiere NUR Namen von natuerlichen Personen (Klaeger, Beklagte, Zeugen, einzelne Richter bei Namensnennung)
- NICHT extrahieren: Gerichtsnamen (Bundesgerichtshof, Amtsgericht, Landgericht, BAG, BGH usw.)
- NICHT extrahieren: Behoerden und Institutionen (Bundesministerium, Staatsanwaltschaft usw.)
- NICHT extrahieren: Kammern, Senate, Gremien (2. Senat, 1. Kammer usw.)
- NICHT extrahieren: Firmen und Organisationen
- NICHT extrahieren: Abkuerzungen wie "Kl.", "Bekl.", "Klaegerin"

Antworte AUSSCHLIESSLICH mit folgendem JSON-Format:
{"persons": ["Vollstaendiger Name 1", "Vollstaendiger Name 2"]}
Wenn keine natuerlichen Personen gefunden: {"persons": []}

BEISPIELE:
---
Text: "Die Beklagte, die Bundesrepublik Deutschland, vertreten durch das Bundesministerium der Finanzen, wendet sich gegen die Entscheidung des Bundesarbeitsgerichts vom 12.03.2021."
Antwort: {"persons": []}

Text: "Der Klaeger Hans Mueller, wohnhaft in Koeln, verklagte die Maria Schmidt GmbH vor dem Amtsgericht Koeln."
Antwort: {"persons": ["Hans Mueller"]}

Text: "Richterin Dr. Sabine Hoffmann verlas die Entscheidung des 2. Senats des Bundesgerichtshofs."
Antwort: {"persons": ["Dr. Sabine Hoffmann"]}

Text: "Rechtsanwalt Dr. Klaus Weber vertritt den Klaeger Thomas Fischer gegen die Beklagte, vertreten durch Rechtsanwaeltin Anna Braun."
Antwort: {"persons": ["Dr. Klaus Weber", "Thomas Fischer", "Anna Braun"]}

Text: "Das Landesarbeitsgericht Hamm, Kammer 5, hat unter Vorsitz von Richter am LAG Karl Lehmann entschieden."
Antwort: {"persons": ["Karl Lehmann"]}

Text: "Die Klage wird abgewiesen. Der Klaeger traegt die Kosten. Das Urteil ist vorbehaltlich einer Entscheidung des Bundesverfassungsgerichts vollstreckbar."
Antwort: {"persons": []}
---

Jetzt analysiere folgenden Text:
${text.slice(0, 6000)}`;
}
```

### Anti-Patterns to Avoid

- **Silent NER pass on timeout:** If Ollama times out after 45s, the processor MUST throw — NOT silently set `piiFiltered: true`. This is a hard BRAO §43a compliance requirement (success criterion 4).
- **Bypass path via direct DB write:** The state machine must be the only path to `INDEXED` status. Never write to `urteil_chunks` or allow Muster ingestion without the NER gate completing.
- **Not resetting to PENDING_NER on failure:** If the processor throws, Muster status must revert from NER_RUNNING to PENDING_NER (not left as NER_RUNNING, which is a stuck state).
- **Over-redacting institution names:** The whitelist regex must be applied before returning `hasPii`. Failing success criterion 1 (0 institution names falsely redacted) fails the acceptance test.
- **Using JSON.parse without validation:** If `format:"json"` is set, Ollama guarantees JSON. But `parsed.persons` may be `null` — always default to `[]`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timeout for Ollama NER | Custom setTimeout/Promise.race | `AbortSignal.timeout(45_000)` | Built-in, clean, already used in reranker.ts and embedder.ts |
| JSON output guarantee | Manual JSON parsing with regex | Ollama `format:"json"` parameter | Grammar-constrained decoding — no partial JSON, no `<think>` leakage |
| BullMQ queue boilerplate | New Queue constructor inline | Add to existing `src/lib/queue/queues.ts` + `ALL_QUEUES` array | Consistency with Bull Board registration |
| Text extraction from MinIO | Custom MinIO client | `src/lib/storage.ts` (existing MinIO client) | Already handles authentication and streams |

**Key insight:** The NER logic itself is a prompt-engineering problem, not a library-installation problem. The entire filtering module can be built in < 200 lines using only project-existing dependencies.

---

## Common Pitfalls

### Pitfall 1: Qwen3.5 `<think>` Prefix Leaks into JSON

**What goes wrong:** qwen3.5:35b in "thinking" mode prepends `<think>...</think>` before the actual JSON. `JSON.parse()` fails.

**Why it happens:** Qwen3's extended thinking is sometimes triggered even in non-reasoning tasks when temperature=0 and prompt is complex.

**How to avoid:** Use `format:"json"` (grammar-constrained) which prevents non-JSON tokens, OR extract JSON with `rawText.match(/\{[\s\S]*\}/)` as done in reranker.ts (line 98).

**Warning signs:** `SyntaxError: Unexpected token '<'` in NER processor logs.

### Pitfall 2: NER_RUNNING Stuck State After Worker Crash

**What goes wrong:** Worker crashes after setting `nerStatus: NER_RUNNING` but before completing NER. Muster is stuck in NER_RUNNING forever.

**Why it happens:** Worker crash between two DB writes (status update + NER result update).

**How to avoid:** Always reset to PENDING_NER in the catch block before re-throwing. BullMQ will retry (up to `attempts` count). If `attempts: 1`, the job fails — add a startup recovery sweep that resets all NER_RUNNING rows to PENDING_NER (same pattern as at-startup checks in other processors).

**Warning signs:** Muster rows stuck in NER_RUNNING with no active BullMQ job.

### Pitfall 3: Institution Names Extracted as Persons by LLM

**What goes wrong:** LLM extracts "Bundesgerichtshof" or "2. Senat" as person names, causing false PII rejection.

**Why it happens:** Without strong few-shot examples, LLMs over-extract entities. Qwen3.5 may tag "BGH" as a named entity.

**How to avoid:** (1) Include 6+ explicit negative few-shot examples with institution names. (2) Apply the institution whitelist regex AFTER extraction. (3) Validate acceptance test first.

**Warning signs:** Acceptance test failure on criterion 1 — institution names in `persons[]`.

### Pitfall 4: Text Truncation Cuts Off Person Names

**What goes wrong:** Urteil texts can be 50,000+ characters. Slicing to 6,000 chars for NER may miss person names in the signature block at the end.

**Why it happens:** Person names often appear in Rubrum (header) AND in the Tenor/Unterschriften (footer).

**How to avoid:** For UrteilChunk, NER runs on `content` (child chunk, 2000-token window) — not the full document. For Muster, run NER on first 6,000 chars (covers the Rubrum where client names appear) + last 2,000 chars (covers signatures). Use `text.slice(0, 6000) + "\n...\n" + text.slice(-2000)`.

**Warning signs:** Acceptance test passes but production Urteile with names in Tenor are not caught.

### Pitfall 5: UrteilChunk Has No Status Machine (Unlike Muster)

**What goes wrong:** UrteilChunk uses `piiFiltered: Boolean @default(false)` — not a state machine. Phase 17 (Urteil scraper) needs to call the NER filter inline during ingestion, not via a separate queue.

**Why it happens:** Schema was designed before Phase 16 existed. Muster has a proper `MusterNerStatus` enum; UrteilChunk does not.

**How to avoid:** For UrteilChunk ingestion (Phase 17), the scraper calls `runNerFilter()` directly and only inserts the row if `!result.hasPii`. The BullMQ queue is only needed for Muster (because Muster upload is async). For Urteile, the gate is synchronous within the ingestion function.

**Warning signs:** Phase 17 planner tries to add `nerStatus` to UrteilChunk — not needed, `piiFiltered` boolean is sufficient.

---

## Code Examples

Verified patterns from project codebase:

### Ollama /api/generate with AbortSignal.timeout (from reranker.ts)

```typescript
// Source: src/lib/ai/reranker.ts lines 77-88 (verified in codebase)
const response = await fetch(`${OLLAMA_URL}/api/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: RERANKER_MODEL,
    prompt,
    stream: false,
    temperature: 0,
    num_predict: 500,
  }),
  signal: AbortSignal.timeout(timeoutMs),  // Use 45_000 for NER
});
const data = (await response.json()) as { response: string };
// Extract JSON — handles potential <think>...</think> prefix
const jsonMatch = data.response.match(/\{[\s\S]*\}/);
```

### BullMQ Queue Definition (from src/lib/queue/queues.ts pattern)

```typescript
// Source: src/lib/queue/queues.ts pattern (verified)
export const nerPiiQueue = new Queue("ner-pii", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 1,           // NER is non-retryable by design (timeout = fail)
    backoff: { type: "custom" },
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});
// Add to ALL_QUEUES array for Bull Board discovery
```

### Worker Registration (from src/worker.ts pattern)

```typescript
// Source: src/worker.ts pattern (verified, e.g. gesetze-sync worker at line ~515)
const nerPiiWorker = new Worker<NerPiiJobData>(
  "ner-pii",
  async (job) => processNerPiiJob(job.data),
  {
    connection,
    concurrency: 1,  // NER is Ollama-bound; sequential to avoid GPU contention
    settings: {
      backoffStrategy: (attemptsMade: number) => calculateBackoff(attemptsMade),
    },
  }
);
nerPiiWorker.on("completed", (job) => { ... });
nerPiiWorker.on("failed", (job, err) => { ... });
workers.push(nerPiiWorker);
```

### Prisma Status Update Pattern (from project convention)

```typescript
// Source: Prisma update pattern used across project
// PENDING_NER → NER_RUNNING
await prisma.muster.update({
  where: { id: musterId },
  data: { nerStatus: "NER_RUNNING" },
});

// NER_RUNNING → INDEXED or REJECTED_PII_DETECTED
await prisma.muster.update({
  where: { id: musterId },
  data: { nerStatus: result.hasPii ? "REJECTED_PII_DETECTED" : "INDEXED" },
});

// On error: reset to PENDING_NER
await prisma.muster.update({
  where: { id: musterId },
  data: { nerStatus: "PENDING_NER" },
});
```

### Acceptance Test Structure

```typescript
// tests/pii/ner-filter.acceptance.test.ts
// 10 real German Urteil excerpts — verify success criteria 1 and 2
const URTEIL_EXCERPTS = [
  {
    id: "bgh-no-persons",
    text: "Der Bundesgerichtshof, VI. Zivilsenat, hat am 12. Mai 2021 durch den Vorsitzenden Richter und die Richter Dr. Seiters, Dr. Offenloch, Dr. Roloff und Böhm beschlossen...",
    expectedPersons: ["Dr. Seiters", "Dr. Offenloch", "Dr. Roloff", "Böhm"],
    expectedHasPii: true,
    // Note: "Bundesgerichtshof" and "VI. Zivilsenat" must NOT appear in persons[]
  },
  {
    id: "bag-pure-institution",
    text: "Das Bundesarbeitsgericht hat die Revision des Klaeger zurückgewiesen. Die Entscheidung ergeht durch die erkennende Kammer in der Besetzung des Bundesarbeitsgerichts.",
    expectedPersons: [],
    expectedHasPii: false,
  },
  // ... 8 more real excerpts
];

for (const excerpt of URTEIL_EXCERPTS) {
  test(excerpt.id, async () => {
    const result = await runNerFilter(excerpt.text);
    // Criterion 1: no institution name in persons[]
    expect(result.persons).not.toContain("Bundesgerichtshof");
    expect(result.persons).not.toContain("Bundesarbeitsgericht");
    // Criterion 2: hasPii matches expectation
    expect(result.hasPii).toBe(excerpt.expectedHasPii);
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BERT-based NER (fine-tuned) | LLM few-shot NER via Ollama | 2023+ | No training data needed, in-context examples sufficient for legal domain |
| Separate NER service | LLM-as-NER via existing Ollama instance | Project decision | qwen3.5:35b already running; no new infrastructure |
| Hard-coded PII lists | LLM extraction + Regex whitelist hybrid | Best practice 2024+ | LLM handles unknown person name formats; Regex prevents false positives for institutions |

**Deprecated/outdated:**
- `format:"json"` string-only mode: Still works but the JSON Schema object form is more reliable for structured extraction (grammar-constrained). For simple `{persons: string[]}`, string `"json"` is sufficient since we also embed the schema in the prompt.

---

## Open Questions

1. **Does qwen3.5:35b reliably NOT extract Qwen3's own `<think>` tokens when `format:"json"` is set?**
   - What we know: reranker.ts uses `data.response.match(/\{[\s\S]*\}/)` as defense; the structured output blog post says grammar-constrained decoding prevents non-JSON tokens.
   - What's unclear: Whether `format:"json"` fully suppresses thinking tokens in qwen3.5:35b specifically.
   - Recommendation: Use BOTH `format:"json"` AND `jsonMatch` extraction as double defense.

2. **Should UrteilChunk get a `nerStatus` enum (like Muster) or remain boolean `piiFiltered`?**
   - What we know: Schema has `piiFiltered: Boolean @default(false)`. Muster has `MusterNerStatus` enum with 4 states.
   - What's unclear: Whether Phase 17 scraper needs async NER (needs state machine) or synchronous inline NER (boolean sufficient).
   - Recommendation: Keep `piiFiltered` boolean for UrteilChunk. Urteil ingestion runs NER inline (synchronous gate). Only Muster needs the async state machine because uploads are user-triggered and the NER call is too long for an HTTP response.

3. **How much text to send to NER for Muster (PDFs can be very long)?**
   - What we know: Urteil chunks are 2000-token child chunks — small enough for direct NER. Muster are full DOCX/PDFs (potentially 50,000+ chars).
   - What's unclear: Whether name-in-footer problem is real for Muster or mainly for Urteile.
   - Recommendation: For Muster, NER on first 6,000 chars (Rubrum, Sachverhalt) + last 2,000 chars (signatures, Unterschriften). Document this in processor code.

---

## Architecture Decision: Two-Path Design

Phase 16 delivers ONE shared NER module (`src/lib/pii/ner-filter.ts`) used in TWO ways:

**Path A — Muster (async BullMQ):**
- Upload triggers `nerPiiQueue.add()`
- BullMQ processor calls `processNerPiiJob({ musterId })`
- Processor transitions: PENDING_NER → NER_RUNNING → INDEXED | REJECTED_PII_DETECTED
- Phase 18 reads `nerStatus = INDEXED` before creating MusterChunks

**Path B — Urteile (inline synchronous):**
- Phase 17 scraper calls `runNerFilter(urteilContent)` inline
- If `result.hasPii`: skip row, log warning, increment rejected counter
- If `!result.hasPii`: insert UrteilChunk with `piiFiltered: true`
- No separate queue needed

This means Phase 16 delivers: `ner-filter.ts` module + BullMQ queue/processor for Muster + acceptance test. Phase 17 imports `runNerFilter` directly.

---

## Sources

### Primary (HIGH confidence)

- Ollama API docs (docs.ollama.com/api/generate, docs.ollama.com/capabilities/structured-outputs) — format parameter, stream:false behavior, AbortSignal usage
- Project codebase `src/lib/ai/reranker.ts` — Ollama `/api/generate` with `AbortSignal.timeout()`, JSON extraction pattern (verified)
- Project codebase `prisma/schema.prisma` lines 294-299, 981-1017 — MusterNerStatus enum, UrteilChunk.piiFiltered field (verified)
- Project codebase `src/lib/queue/queues.ts`, `src/worker.ts` — BullMQ queue/worker registration pattern (verified)
- Leitner et al. (2020) German Legal NER Dataset — 19-class taxonomy, PII vs. non-PII entity distinction (aclanthology.org/2020.lrec-1.551)

### Secondary (MEDIUM confidence)

- STATE.md project decision: "qwen3.5:35b als Ollama-Standard — validiert fuer LLM-as-reranker" — confirms model availability without additional pull
- Ollama structured outputs blog (ollama.com/blog/structured-outputs) — confirms `format` JSON schema parameter behavior
- German LER GitHub dataset (elenanereiss/Legal-Entity-Recognition) — entity class breakdown confirming Court/Institution are non-PII categories

### Tertiary (LOW confidence)

- qwen3.5:35b NER performance on German text: No benchmarks found specific to this model+task combination. Recommendation is based on the model's general German language capability (119 supported languages, released 2026-02-24) and the fact that few-shot prompting significantly reduces model-specific sensitivity.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries are existing project dependencies; no new installs
- Architecture: HIGH — patterns directly from existing codebase (reranker.ts, gesetze-sync.processor.ts); schema already has required enums
- NER prompt quality: MEDIUM — few-shot examples designed from known German legal entity taxonomy; empirical validation required via acceptance test (this is explicitly called out in STATE.md blockers)
- Pitfalls: HIGH — all derived from either project code review or verified Ollama behavior

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (30 days; Ollama API is stable; qwen3.5:35b is newly released — check for updates)
