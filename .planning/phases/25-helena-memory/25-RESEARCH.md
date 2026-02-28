# Phase 25: Helena Memory - Research

**Researched:** 2026-02-28
**Domain:** LLM memory service, staleness detection, system prompt injection, DSGVO cascade
**Confidence:** HIGH

## Summary

Phase 25 adds a memory service layer that makes Helena "remember" case context across sessions. The existing infrastructure is already substantial: the `HelenaMemory` Prisma model exists with `akteId @unique`, `onDelete: Cascade`, JSON `content`, `version` counter, and `lastRefreshedAt`. The `buildSystemPrompt()` in `system-prompt.ts` already accepts `helenaMemory` and renders it -- currently as raw `JSON.stringify`. The `helena-task.processor.ts` already loads `HelenaMemory` from DB and passes it to `runHelenaAgent()`. The `ki-chat/route.ts` does NOT load HelenaMemory yet -- this is a key gap.

The work is therefore: (1) build a `HelenaMemoryService` with `loadOrRefresh()` that detects staleness via `HelenaMemory.lastRefreshedAt < Akte.geaendert`, triggers LLM-based memory generation when stale, and returns the memory content; (2) create a `formatMemoryForPrompt()` function that renders the structured JSON into German markdown for injection into system prompts; (3) wire both `ki-chat/route.ts` and `helena-task.processor.ts` to use the service; (4) add a cooldown mechanism to prevent rapid-fire regeneration during bulk operations.

**Primary recommendation:** Build a single `src/lib/helena/memory-service.ts` module with `loadOrRefresh(prisma, akteId)` and `formatMemoryForPrompt(content)` functions. Use AI SDK `generateObject` with a Zod schema matching the decided content structure for memory generation. Wire into both invocation paths. DSGVO cascade is already handled at schema level.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Memory content has a rich JSON structure: `summary`, `risks`, `nextSteps`, `openQuestions`, `relevantNorms`, `strategy`, `keyEvents`, `beteiligteNotes`, `proceduralStatus`
- Memory generated from BOTH Akte structured data (documents, deadlines, Beteiligte) AND past Helena conversations (AiConversation history for that Akte)
- Staleness detection: simple timestamp comparison `HelenaMemory.lastRefreshedAt < Akte.geaendert` (Akte uses `geaendert` not `updatedAt`)
- No tracking of specific change types -- any Akte change triggers staleness
- Auto-refresh happens on Helena invocation (both ki-chat and background task) when stale
- Adds 5-15s latency on first call after Akte changes -- acceptable tradeoff
- Show user indicator during refresh: "Helena aktualisiert ihr Fallgedaechtnis..."
- BOTH ki-chat (streaming) and helena-task (background) load HelenaMemory
- BOTH paths trigger memory refresh if stale -- consistent behavior
- Shared `formatMemoryForPrompt()` function used by both system prompt builders
- Structured German markdown format with sections: Fallgedaechtnis, Aenderungen seit letztem Gespraech, Zusammenfassung, Erkannte Risiken, Strategie, Naechste Schritte, Offene Fragen
- Change summary enables Helena to proactively address new developments

### Claude's Discretion
- Minimum refresh cooldown interval (to prevent rapid-fire regeneration during bulk operations)
- Token budget cap for memory section in system prompt
- Memory generation prompt design (what instructions to give the LLM for synthesis)
- How to handle cases with no conversation history (initial memory from Akte data only)
- Exact handling of the "Aenderungen" diff (track previous content vs. detect changes from Akte data)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MEM-02 | Memory wird bei jedem Helena-Aufruf in dieser Akte als Kontext geladen ("Helena erinnert sich") | `loadOrRefresh()` service called from both ki-chat and helena-task processor; `formatMemoryForPrompt()` renders into system prompt |
| MEM-03 | Automatischer Memory-Refresh wenn Akte seit letztem Scan veraendert wurde | Staleness check via `HelenaMemory.lastRefreshedAt < Akte.geaendert`; LLM call via `generateObject` to regenerate content |
| MEM-04 | DSGVO-konform: Memory-Eintraege werden bei Akten-Loeschung kaskadierend geloescht (Art. 17 DSGVO) | Already implemented in Prisma schema: `onDelete: Cascade` on HelenaMemory.akte relation. **Verification only needed.** |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ai (AI SDK) | 4.3.19 | `generateObject` for structured memory generation | Already used throughout (orchestrator, schriftsatz intent router) |
| zod | (existing) | Schema for memory content structure | Already used for SchriftsatzSchema, IntentResultSchema |
| @prisma/client | (existing) | Database operations, upsert pattern | HelenaMemory model already defined |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| token-budget.ts | (existing) | `estimateTokens()` for memory token cap | Cap memory section to prevent context window overflow |

### Alternatives Considered
None -- this phase uses exclusively existing libraries. Zero new npm packages (per project decision).

## Architecture Patterns

### Recommended Project Structure
```
src/lib/helena/
  memory-service.ts       # NEW: loadOrRefresh(), formatMemoryForPrompt(), generateMemory()
  system-prompt.ts        # MODIFY: replace JSON.stringify with formatMemoryForPrompt()
  index.ts                # NO CHANGE (helenaMemory already threaded through)
  token-budget.ts         # REUSE: estimateTokens() for memory cap
src/app/api/ki-chat/
  route.ts                # MODIFY: add HelenaMemory loading + staleness check chain
src/lib/queue/processors/
  helena-task.processor.ts # MODIFY: replace direct findUnique with loadOrRefresh()
```

### Pattern 1: Service Module with loadOrRefresh
**What:** A single `loadOrRefresh(prisma, akteId)` function that encapsulates the full memory lifecycle: load from DB, check staleness, regenerate if needed, return content.
**When to use:** Every Helena invocation path (ki-chat route, helena-task processor).
**Example:**
```typescript
// Source: project pattern from draft-service.ts, helena-task.processor.ts
export interface HelenaMemoryContent {
  summary: string;
  risks: string[];
  nextSteps: string[];
  openQuestions: string[];
  relevantNorms: string[];
  strategy: string;
  keyEvents: Array<{ date: string; event: string }>;
  beteiligteNotes: Record<string, string>;
  proceduralStatus: string;
  rejectionPatterns?: unknown[]; // Preserved from draft-service.ts
}

export async function loadOrRefresh(
  prisma: ExtendedPrismaClient,
  akteId: string,
  options?: { cooldownMs?: number },
): Promise<{ content: HelenaMemoryContent | null; refreshed: boolean }> {
  // 1. Load HelenaMemory + Akte.geaendert in single query
  // 2. If no memory exists -> generate fresh
  // 3. If memory.lastRefreshedAt < akte.geaendert -> check cooldown -> regenerate
  // 4. Return content + refreshed flag (for UX indicator)
}
```

### Pattern 2: generateObject for Structured Memory Generation
**What:** Use AI SDK's `generateObject` with a Zod schema to produce well-typed memory content from Akte data + conversation history.
**When to use:** Memory regeneration on staleness or first creation.
**Example:**
```typescript
// Source: pattern from src/lib/helena/schriftsatz/intent-router.ts
import { generateObject } from "ai";
import { z } from "zod";

const HelenaMemorySchema = z.object({
  summary: z.string().describe("Detaillierte Fallzusammenfassung (1-2 Absaetze)"),
  risks: z.array(z.string()).describe("Erkannte Risiken und Schwachstellen"),
  nextSteps: z.array(z.string()).describe("Ausstehende Handlungen und Fristen"),
  openQuestions: z.array(z.string()).describe("Unbeantwortete Fragen zum Fall"),
  relevantNorms: z.array(z.string()).describe("Relevante Rechtsnormen (z.B. BGB SS 626)"),
  strategy: z.string().describe("Strategie des Anwalts aus bisherigen Gespraechen"),
  keyEvents: z.array(z.object({
    date: z.string(),
    event: z.string(),
  })).describe("Chronologie wichtiger Ereignisse"),
  beteiligteNotes: z.record(z.string()).describe("Erkenntnisse zu Beteiligten"),
  proceduralStatus: z.string().describe("Aktueller Verfahrensstand"),
});

const result = await generateObject({
  model,
  schema: HelenaMemorySchema,
  system: MEMORY_GENERATION_SYSTEM_PROMPT,
  prompt: buildMemoryPrompt(akteData, conversations, previousMemory),
});
```

### Pattern 3: Parallel Chain in ki-chat
**What:** Add memory loading as a parallel chain alongside existing RAG chains in ki-chat/route.ts.
**When to use:** ki-chat POST handler when akteId is present.
**Example:**
```typescript
// Source: existing pattern in ki-chat/route.ts (Chain A-F parallel structure)
// Chain G: Helena Memory (load from DB, staleness check, optional refresh)
const memoryPromise = akteId
  ? loadOrRefresh(prisma, akteId)
  : Promise.resolve({ content: null, refreshed: false });

// Await alongside existing chains
const [akteContext, ragResult, modelConfig, lawChunks, urteilChunks, musterChunks, memoryResult] =
  await Promise.all([...existingChains, memoryPromise]);

// Inject into system prompt
if (memoryResult.content) {
  systemPrompt += formatMemoryForPrompt(memoryResult.content);
}
```

### Pattern 4: Upsert with Version Increment
**What:** Use Prisma upsert with version increment for atomic memory updates, preserving existing `rejectionPatterns` from draft-service.ts.
**When to use:** Memory regeneration.
**Example:**
```typescript
// Source: existing pattern in src/lib/helena/draft-service.ts (lines 259-276)
await prisma.helenaMemory.upsert({
  where: { akteId },
  create: {
    akteId,
    content: newContent as Prisma.InputJsonValue,
    lastRefreshedAt: new Date(),
  },
  update: {
    content: newContent as Prisma.InputJsonValue,
    version: { increment: 1 },
    lastRefreshedAt: new Date(),
  },
});
```

### Anti-Patterns to Avoid
- **Loading memory in system-prompt.ts:** The system prompt builder is a pure function that takes data. Memory loading (DB + staleness + LLM call) must happen in the caller (ki-chat route, processor), not inside `buildSystemPrompt()`.
- **Blocking ki-chat response for memory generation:** Memory refresh adds 5-15s latency. The user indicator ("Helena aktualisiert ihr Fallgedaechtnis...") should be communicated via a response header or initial stream chunk, not by blocking the entire response.
- **Overwriting rejectionPatterns:** The `draft-service.ts` already stores `rejectionPatterns` in HelenaMemory.content. The memory regeneration must preserve these (merge, not replace).
- **Generating memory without conversations:** When no AiConversation history exists for the Akte, generate from Akte structured data only. Do NOT skip memory creation -- Akte data alone provides valuable context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured LLM output | Custom JSON parsing of freeform LLM text | `generateObject` with Zod schema | AI SDK handles retries, validation, schema enforcement |
| Token estimation | Character counting with ad-hoc ratio | `estimateTokens()` from `token-budget.ts` | Already calibrated for German/English mix at 3.5 chars/token |
| DSGVO cascade delete | Manual deletion logic | Prisma `onDelete: Cascade` | Already implemented in schema, automatic and reliable |
| Cooldown tracking | Redis-based or file-based timer | In-memory `Map<akteId, lastRefreshTimestamp>` | Simple, process-local, lost on restart is fine (just re-generates) |

**Key insight:** This phase is a service layer between existing infrastructure (Prisma model, AI SDK, system prompt builder) -- the complexity is in the orchestration and prompt design, not in new technology.

## Common Pitfalls

### Pitfall 1: Overwriting rejectionPatterns in HelenaMemory.content
**What goes wrong:** Memory regeneration replaces the entire `content` JSON, losing draft rejection feedback stored by `draft-service.ts`.
**Why it happens:** The `rejectDraft` function upserts `rejectionPatterns` into `HelenaMemory.content`. If `generateMemory()` generates fresh content without merging, these are lost.
**How to avoid:** Load existing content first, extract `rejectionPatterns`, merge into newly generated content before upsert.
**Warning signs:** Draft rejection feedback stops influencing Helena's behavior after a memory refresh.

### Pitfall 2: Memory refresh blocking ki-chat streaming
**What goes wrong:** The ki-chat streaming response is delayed 5-15s while memory regenerates, and the user sees nothing.
**Why it happens:** `loadOrRefresh()` is awaited before `streamText()` starts.
**How to avoid:** Accept the latency but communicate it clearly. The CONTEXT.md says this is acceptable. Options: (a) send an initial "Helena aktualisiert ihr Fallgedaechtnis..." text chunk before streaming, or (b) add a response header `X-Memory-Refreshing: true` for the frontend to show an indicator.
**Warning signs:** Users complain about slow first response after Akte changes.

### Pitfall 3: Memory too large for context window
**What goes wrong:** A complex case with extensive conversation history produces a memory section that consumes too much of the LLM context window, leaving insufficient space for RAG sources, Akte context, and conversation history.
**Why it happens:** No token cap on the memory section.
**How to avoid:** Cap the formatted memory section at ~2000 tokens (~7000 chars). This leaves ample room for the system prompt (~1500 tokens), Akte context (~1000 tokens), RAG sources (~3000 tokens), and conversation history within even the smallest context window (32k for qwen3.5:35b).
**Warning signs:** LLM responses become truncated or incomplete. Token budget truncation kicks in frequently.

### Pitfall 4: Akte.geaendert not updated for all relevant changes
**What goes wrong:** Staleness detection misses changes because `Akte.geaendert` (the `@updatedAt` field) only updates when the Akte model itself is modified, not when related models (Dokument, KalenderEintrag, Beteiligter) change.
**Why it happens:** Prisma's `@updatedAt` only triggers on direct Akte row updates, not on related model changes.
**How to avoid:** This is actually acceptable per CONTEXT.md: "any Akte change triggers staleness." The existing codebase frequently touches Akte fields when related data changes (e.g., document upload triggers Akte activity). If edge cases are found, they can be addressed in a future phase. For now, the simple timestamp comparison is the locked decision.
**Warning signs:** Helena doesn't notice new documents or deadlines. If this becomes an issue, add a `touch` helper that updates `Akte.geaendert` in critical paths.

### Pitfall 5: Rapid-fire regeneration during bulk operations
**What goes wrong:** Importing 50 documents triggers 50 Akte updates, each triggering a separate memory refresh on the next Helena invocation.
**Why it happens:** No cooldown between regenerations.
**How to avoid:** Implement a cooldown (recommended: 5 minutes). Use an in-memory `Map<string, number>` keyed by akteId storing the timestamp of the last refresh. If `Date.now() - lastRefresh < cooldownMs`, skip regeneration and use existing (slightly stale) memory.
**Warning signs:** Token usage spikes during bulk import operations.

## Code Examples

### Memory Content Zod Schema
```typescript
// Source: derived from CONTEXT.md locked decisions
import { z } from "zod";

export const HelenaMemoryContentSchema = z.object({
  summary: z.string().describe("Detaillierte Fallzusammenfassung in 1-2 Absaetzen"),
  risks: z.array(z.string()).describe("Erkannte Risiken und Schwachstellen"),
  nextSteps: z.array(z.string()).describe("Ausstehende Handlungen"),
  openQuestions: z.array(z.string()).describe("Unbeantwortete Fragen"),
  relevantNorms: z.array(z.string()).describe("Relevante Normen, z.B. 'BGB SS 626'"),
  strategy: z.string().describe("Strategie des Anwalts"),
  keyEvents: z.array(z.object({
    date: z.string().describe("Datum im Format TT.MM.JJJJ"),
    event: z.string().describe("Beschreibung des Ereignisses"),
  })).describe("Chronologie wichtiger Fallereignisse"),
  beteiligteNotes: z.record(z.string(), z.string()).describe("Erkenntnisse pro Beteiligtem"),
  proceduralStatus: z.string().describe("Aktueller Verfahrensstand"),
});

export type HelenaMemoryContent = z.infer<typeof HelenaMemoryContentSchema>;
```

### formatMemoryForPrompt Function
```typescript
// Source: derived from CONTEXT.md locked prompt format
export function formatMemoryForPrompt(
  content: HelenaMemoryContent,
  changes?: string[],
): string {
  const now = new Date().toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  let md = `\n\n## Fallgedaechtnis (Stand: ${now})\n`;

  if (changes && changes.length > 0) {
    md += `\n### Aenderungen seit letztem Gespraech\n`;
    md += changes.map(c => `- ${c}`).join("\n") + "\n";
  }

  md += `\n### Zusammenfassung\n${content.summary}\n`;

  if (content.risks.length > 0) {
    md += `\n### Erkannte Risiken\n`;
    md += content.risks.map(r => `- ${r}`).join("\n") + "\n";
  }

  if (content.strategy) {
    md += `\n### Strategie\n${content.strategy}\n`;
  }

  if (content.nextSteps.length > 0) {
    md += `\n### Naechste Schritte\n`;
    md += content.nextSteps.map(s => `- ${s}`).join("\n") + "\n";
  }

  if (content.openQuestions.length > 0) {
    md += `\n### Offene Fragen\n`;
    md += content.openQuestions.map(q => `- ${q}`).join("\n") + "\n";
  }

  return md;
}
```

### Memory Generation Prompt (Recommendation)
```typescript
// Source: project pattern for German LLM prompts
const MEMORY_GENERATION_SYSTEM_PROMPT = `Du bist Helena, juristische KI-Assistentin. Deine Aufgabe: Erstelle eine strukturierte Fallzusammenfassung fuer eine Akte.

Analysiere die Akte-Daten und die bisherigen Gespraeche und erstelle:
1. **summary**: Detaillierte Zusammenfassung des Falls (Sachverhalt, Parteien, Kernkonflikt, Verfahrensstand)
2. **risks**: Erkannte Risiken und Schwachstellen der Position
3. **nextSteps**: Konkrete naechste Handlungen
4. **openQuestions**: Unbeantwortete Fragen die geklaert werden muessen
5. **relevantNorms**: Anwendbare Rechtsnormen (Format: "BGB SS 626")
6. **strategy**: Falls aus Gespraechen erkennbar, die Strategie des Anwalts
7. **keyEvents**: Chronologie der wichtigsten Ereignisse mit Datum
8. **beteiligteNotes**: Erkenntnisse zu einzelnen Beteiligten
9. **proceduralStatus**: Aktueller Verfahrensstand in einem Satz

REGELN:
- Schreibe auf Deutsch
- Erfinde keine Fakten -- nur was in den Daten steht
- Fasse Gespraeche zusammen, zitiere nicht woertlich
- Halte die Zusammenfassung praegnant aber vollstaendig
- Wenn keine Gespraeche vorliegen, nutze nur die Akte-Daten`;
```

### Staleness Check + Cooldown Logic
```typescript
// In-memory cooldown map (process-local, lost on restart is fine)
const refreshCooldowns = new Map<string, number>();
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function isOnCooldown(akteId: string, cooldownMs: number): boolean {
  const lastRefresh = refreshCooldowns.get(akteId);
  if (!lastRefresh) return false;
  return Date.now() - lastRefresh < cooldownMs;
}

function markRefreshed(akteId: string): void {
  refreshCooldowns.set(akteId);
  // Prevent memory leak: clean up entries older than 1 hour
  if (refreshCooldowns.size > 1000) {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, ts] of refreshCooldowns) {
      if (ts < oneHourAgo) refreshCooldowns.delete(key);
    }
  }
}
```

### Change Detection for "Aenderungen" Section
```typescript
// Recommendation: detect changes from Akte data vs. previous memory content
// rather than tracking a full diff log (simpler, no schema changes needed)
function detectChanges(
  previousMemory: HelenaMemoryContent | null,
  currentAkteData: AkteSummaryData,
): string[] {
  if (!previousMemory) return ["Erste Analyse dieser Akte"];
  const changes: string[] = [];

  // Compare document counts
  if (currentAkteData.dokumentCount > (previousMemory as any)._meta?.dokumentCount) {
    changes.push(`${currentAkteData.dokumentCount - (previousMemory as any)._meta?.dokumentCount} neue Dokumente`);
  }

  // Compare Beteiligte
  // Compare Fristen
  // etc.

  return changes.length > 0 ? changes : ["Akte wurde aktualisiert"];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw JSON.stringify in system prompt | Structured German markdown via formatMemoryForPrompt() | This phase | LLM understands memory better, Helena sounds more natural |
| No memory loading in ki-chat | Memory loaded as parallel chain (Chain G) | This phase | Helena remembers case context in streaming chat |
| Manual memory creation only (via draft rejection) | Auto-generated memory from Akte data + conversations | This phase | Helena has comprehensive case understanding from first invocation |

**Existing code that changes:**
- `system-prompt.ts` line 37: `JSON.stringify(helenaMemory, null, 2)` -> `formatMemoryForPrompt(helenaMemory)`
- `ki-chat/route.ts`: Add Chain G for HelenaMemory loading
- `helena-task.processor.ts` lines 110-112: Replace `prisma.helenaMemory.findUnique` with `loadOrRefresh()`

## Open Questions

1. **Akte.geaendert vs. related model changes**
   - What we know: Prisma `@updatedAt` only fires on direct Akte row updates
   - What's unclear: Does every relevant change (new Dokument, new KalenderEintrag, new Beteiligter) also touch the Akte row?
   - Recommendation: Accept for now (CONTEXT.md locked simple timestamp). If gaps found, add `prisma.akte.update({ where: { id: akteId }, data: { geaendert: new Date() } })` in critical paths.

2. **ki-chat UX indicator for memory refresh**
   - What we know: CONTEXT.md says "Helena aktualisiert ihr Fallgedaechtnis..." should be shown
   - What's unclear: ki-chat uses `streamText` -> `toDataStreamResponse()`. Injecting an initial indicator before the stream starts needs a mechanism.
   - Recommendation: Use the `X-Memory-Refreshing: true` response header. The frontend can detect this and show a status indicator. Alternatively, the memory refresh text could be the first content of the stream if using a data stream annotation.

3. **Token budget for memory section**
   - What we know: Smallest context window is 32k (qwen3.5:35b). System prompt + Akte context + RAG sources + conversation history compete for space.
   - What's unclear: Exact token distribution across all sections.
   - Recommendation: Cap formatted memory at ~2000 tokens (~7000 chars). Use `estimateTokens()` to verify and truncate if needed. This leaves ~22k tokens for everything else after the 75% budget.

4. **Storing _meta for change detection**
   - What we know: CONTEXT.md says "Aenderungen seit letztem Gespraech" section is desired.
   - What's unclear: Without tracking previous state, how to know what changed.
   - Recommendation: Store a `_meta` field in HelenaMemory.content alongside the LLM-generated fields. Track `{ dokumentCount, beteiligteCount, fristenCount, lastConversationId }`. On refresh, compare against current Akte data to generate change strings. This avoids complex diff tracking.

## Discretion Recommendations

### Cooldown Interval: 5 minutes
**Rationale:** Bulk operations (document imports, Akte reorganization) can trigger many rapid updates. A 5-minute cooldown prevents wasteful LLM calls while ensuring memory stays reasonably current. Worst case: memory is 5 minutes stale, which is imperceptible in a legal workflow.

### Token Budget Cap: 2000 tokens (~7000 chars)
**Rationale:** The smallest context window is 32k (qwen3.5:35b). With 75% budget (24.5k usable), system prompt takes ~1.5k, Akte context ~1k, RAG sources ~3k, conversation history up to ~15k. Memory at 2k leaves ~2k buffer. For larger models (128k, 200k), this is even more comfortable.

### No Conversation History: Generate from Akte Data Only
**Rationale:** Even without conversations, Akte data provides: parties, case type, documents, deadlines, procedural status. The LLM prompt should explicitly note "Keine bisherigen Helena-Gespraeche vorhanden" so the strategy/openQuestions fields are populated from observable data rather than left empty.

### Aenderungen Diff: _meta Field Approach
**Rationale:** Store counts and IDs in a `_meta` field in the memory JSON. On refresh, compare current Akte data against stored counts to generate human-readable change strings ("3 neue Dokumente", "Neuer Beteiligter: Schmidt (GEGNER)"). Simple, no schema changes, no separate diff table.

## Sources

### Primary (HIGH confidence)
- Prisma schema: `prisma/schema.prisma` -- HelenaMemory model (lines 1983-1997), Akte model (lines 692-750)
- Existing code: `src/lib/helena/system-prompt.ts` -- current helenaMemory handling (line 36-38)
- Existing code: `src/lib/helena/index.ts` -- helenaMemory threading (line 67, 119, 283)
- Existing code: `src/lib/queue/processors/helena-task.processor.ts` -- memory loading (lines 110-112)
- Existing code: `src/lib/helena/draft-service.ts` -- rejectionPatterns upsert (lines 235-277)
- Existing code: `src/app/api/ki-chat/route.ts` -- parallel chain architecture (lines 504-798)
- Existing code: `src/lib/helena/schriftsatz/intent-router.ts` -- generateObject pattern (line 14)
- Existing code: `src/lib/helena/token-budget.ts` -- estimateTokens() utility
- AI SDK v4.3.19: `generateObject` with Zod schema (used in project's intent-router.ts)

### Secondary (MEDIUM confidence)
- CONTEXT.md: User decisions and implementation constraints
- REQUIREMENTS.md: MEM-02, MEM-03, MEM-04 requirement definitions
- STATE.md: @unique on HelenaMemory.akteId for one-memory-per-Akte upsert pattern (accumulated decision)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - uses exclusively existing libraries already in the project
- Architecture: HIGH - extends well-established patterns (parallel chains, service modules, Prisma upsert)
- Pitfalls: HIGH - derived from reading actual code (rejectionPatterns, Akte.geaendert @updatedAt behavior)
- Memory generation prompt: MEDIUM - prompt design is discretionary and may need iteration
- Change detection: MEDIUM - _meta approach is a recommendation, not proven in this codebase

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable domain, no external dependencies)
