---
phase: 17-urteile-rag
verified: 2026-02-27T11:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Fetch a live BAG RSS feed and verify title parsing"
    expected: "Items parse correctly with Aktenzeichen, Datum, Entscheidungstyp extracted by TITLE_REGEX"
    why_human: "Cannot call live rechtsprechung-im-internet.de from static analysis; requires network access"
  - test: "Trigger urteile-sync BullMQ job manually via Admin Jobs UI"
    expected: "processUrteileSyncJob returns { inserted, skipped, piiRejected, failed } counts in job result"
    why_human: "Requires running Docker environment with Redis, Ollama, and PostgreSQL"
  - test: "Ask Helena a question about a labor law case in ki-chat"
    expected: "URTEILE-QUELLEN block appears in Helena response with real Gericht + AZ + Datum + Quellenlink — no fabricated Aktenzeichen"
    why_human: "End-to-end test requires populated urteil_chunks table and running Ollama embedding service"
---

# Phase 17: Urteile-RAG Verification Report

**Phase Goal:** Entscheidungen aller 7 Bundesgerichte und BAG-RSS-Updates sind PII-gefiltert in urteil_chunks indiziert — Helena zitiert Urteile nur aus verifizierten Metadaten, nie aus LLM-Imagination
**Verified:** 2026-02-27T11:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All 12 must-have truths from the 3 plan frontmatter sections are verified.

#### Plan 01 Truths (URTEIL-01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `fetchUrteileFeed('BAG')` returns `UrteilRssItem[]` with guid, aktenzeichen, datum, leitsatz, sourceUrl | VERIFIED | `src/lib/urteile/rss-client.ts` lines 107-197: fetches BMJ RSS, parses via XMLParser, returns typed items; TITLE_REGEX captures all 5 fields; flatMap skips parse failures |
| 2 | `ingestUrteilItem()` returns "inserted" / "pii_rejected" / "error" — never throws | VERIFIED | `src/lib/urteile/ingestion.ts` lines 92-163: outer try/catch wraps full function; hasPii:true returns "pii_rejected" at line 108 with no INSERT; catch at line 156 returns "error" |
| 3 | `searchUrteilChunks()` queries pgvector, filters empty aktenzeichen, returns `UrteilChunkResult[]` sorted by score | VERIFIED | Lines 184-226: `$queryRaw` with `ORDER BY embedding <=> ... ASC`, post-filter `.filter(r => r.aktenzeichen && r.aktenzeichen.trim().length > 0)`, then minScore filter |
| 4 | PII-flagged items never get `piiFiltered=true` in urteil_chunks — hasPii:true always returns "pii_rejected" | VERIFIED | Line 104: `if (nerResult.hasPii) { return "pii_rejected"; }` — function exits before reaching INSERT. INSERT at line 124 only runs after hasPii is confirmed false. `piiFiltered: true` in VALUES (line 150) confirms only NER-clean items are marked true |
| 5 | GUID cache load/save round-trips via getSetting/updateSetting with key "urteile.seen_guids" | VERIFIED | `loadGuidCache()` line 59: `getSetting(GUID_CACHE_KEY)` → `new Set(JSON.parse(raw))`; `saveGuidCache()` line 67: `updateSetting(GUID_CACHE_KEY, JSON.stringify(Array.from(guids)))` |

#### Plan 02 Truths (URTEIL-01 + URTEIL-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | `processUrteileSyncJob()` fetches all 7 RSS feeds, skips GUIDs in cache, ingests with PII gate, saves cache, returns counts | VERIFIED | `src/lib/queue/processors/urteile-sync.processor.ts` lines 12-56: iterates `Object.keys(BMJ_RSS_FEEDS)` (7 courts), GUID skip check line 32, saveGuidCache at line 53, returns `{ inserted, skipped, piiRejected, failed }` |
| 7 | `urteileSyncQueue` registered in queues.ts alongside `gesetzeSyncQueue` | VERIFIED | `src/lib/queue/queues.ts` line 150: `export const urteileSyncQueue = new Queue("urteile-sync", ...)` and line 174: added to `ALL_QUEUES` array |
| 8 | `registerUrteileSyncJob()` registers daily cron at 03:00 Europe/Berlin using upsertJobScheduler — idempotent | VERIFIED | `queues.ts` lines 287-301: `upsertJobScheduler("urteile-sync-daily", { pattern: "0 3 * * *", tz: "Europe/Berlin" }, ...)` |
| 9 | urteile-sync Worker registered in worker.ts, in workers[] array | VERIFIED | `src/worker.ts` lines 602-635: `new Worker("urteile-sync", async () => processUrteileSyncJob(), { concurrency: 1 })` with completed/failed/error handlers; `workers.push(urteileSyncWorker)` at line 634 |
| 10 | Per-court RSS fetch failure increments `failed` count and continues — never aborts full sync | VERIFIED | `urteile-sync.processor.ts` lines 23-29: outer try/catch around `fetchUrteileFeed` — catch block does `failed++; continue;` and loops to next gerichtCode |

#### Plan 03 Truths (URTEIL-04)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 11 | Helena's responses include Urteil citations with Gericht + AZ + Datum + Quellenlink — all fields from urteil_chunks, never LLM-generated | VERIFIED | `src/app/api/ki-chat/route.ts` lines 564-579: URTEILE-QUELLEN block reads `u.gericht`, `u.aktenzeichen`, `u.datum`, `u.sourceUrl` directly from `searchUrteilChunks()` DB results; no string composition for these fields |
| 12 | System prompt contains explicit instruction: "Wenn kein Aktenzeichen in den URTEILE-QUELLEN steht, zitiere das Urteil NICHT und erfinde kein AZ" | VERIFIED | `ki-chat/route.ts` line 578: exact phrase present — `" Wenn kein Aktenzeichen in den URTEILE-QUELLEN steht, zitiere das Urteil NICHT und erfinde kein AZ."` |

**Score: 12/12 truths verified**

---

### Required Artifacts

| Artifact | Provides | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `src/lib/urteile/rss-client.ts` | BMJ_RSS_FEEDS (7 courts), UrteilRssItem interface, fetchUrteileFeed | Yes | Yes (198 lines, full implementation) | Imported by ingestion.ts + urteile-sync.processor.ts | VERIFIED |
| `src/lib/urteile/ingestion.ts` | PII-gated ingestion, GUID cache, pgvector search | Yes | Yes (227 lines, full implementation) | Imported by urteile-sync.processor.ts + ki-chat/route.ts | VERIFIED |
| `src/lib/queue/processors/urteile-sync.processor.ts` | processUrteileSyncJob orchestrating 7 courts | Yes | Yes (57 lines, non-stub) | Imported in worker.ts line 22 | VERIFIED |
| `src/lib/queue/queues.ts` | urteileSyncQueue + registerUrteileSyncJob | Yes (modified) | Yes — both exports present (lines 150, 287) | Called in worker.ts lines 766 + 4 | VERIFIED |
| `src/worker.ts` | urteile-sync Worker + startup cron registration | Yes (modified) | Worker registered lines 602-635; cron at line 766; in shutdown list line 829 | Self-contained — boot-time registration | VERIFIED |
| `src/app/api/ki-chat/route.ts` | Chain E parallel Urteil retrieval + URTEILE-QUELLEN injection | Yes (modified) | Chain E lines 494-508; Promise.all lines 511-512; URTEILE-QUELLEN lines 564-579 | searchUrteilChunks imported line 29, called line 501 | VERIFIED |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `ingestion.ts` | `src/lib/pii/ner-filter.ts` | `runNerFilter()` called before any INSERT | WIRED | Line 21: `import { runNerFilter }`, line 103: `const nerResult = await runNerFilter(nerText)`, line 104: `if (nerResult.hasPii) return "pii_rejected"` |
| `ingestion.ts` | `prisma.$executeRaw` | DELETE+INSERT with `::vector` cast | WIRED | Lines 119-153: `prisma.$executeRaw` DELETE then INSERT with `${vectorSql}::vector` |
| `ingestion.ts` | `getSetting/updateSetting` | GUID cache stored as JSON in key "urteile.seen_guids" | WIRED | Lines 29, 59, 67: GUID_CACHE_KEY = "urteile.seen_guids"; loadGuidCache uses getSetting; saveGuidCache uses updateSetting |
| `urteile-sync.processor.ts` | `src/lib/urteile/ingestion.ts` | `ingestUrteilItem()` + GUID cache imports | WIRED | Line 8: `import { ingestUrteilItem, loadGuidCache, saveGuidCache }`, used lines 18, 37, 53 |
| `urteile-sync.processor.ts` | `src/lib/urteile/rss-client.ts` | `fetchUrteileFeed()` + BMJ_RSS_FEEDS | WIRED | Line 7: `import { fetchUrteileFeed, BMJ_RSS_FEEDS }`, used lines 21, 24 |
| `src/worker.ts` | `src/lib/queue/queues.ts` | `registerUrteileSyncJob()` called in startup | WIRED | Line 4: imported in queues import; line 766: `await registerUrteileSyncJob()` in startup sequence |
| `src/app/api/ki-chat/route.ts` | `src/lib/urteile/ingestion.ts` | `searchUrteilChunks()` Chain E | WIRED | Line 29: `import { searchUrteilChunks, type UrteilChunkResult }`, line 501: `await searchUrteilChunks(queryEmbedding, { limit: 5, minScore: 0.6 })` |
| Chain E `urteilChunksPromise` | `Promise.all([...lawChunksPromise])` | 5th element in existing Promise.all | WIRED | Lines 511-512: `const [..., lawChunks, urteilChunks] = await Promise.all([..., lawChunksPromise, urteilChunksPromise])` |
| URTEILE-QUELLEN block | urteil_chunks.aktenzeichen + gericht + datum + sourceUrl | All citation fields read from DB result | WIRED | Lines 566-575: `u.gericht`, `u.aktenzeichen`, `u.datum`, `u.sourceUrl` — all from UrteilChunkResult returned by searchUrteilChunks |

All 9 key links verified as WIRED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| URTEIL-01 | 17-01, 17-02 | BMJ Rechtsprechung-im-Internet in urteil_chunks; HNSW-Index; alle 7 Bundesgerichts-RSS-Feeds | SATISFIED | BMJ_RSS_FEEDS has 7 courts; fetchUrteileFeed + ingestUrteilItem + processUrteileSyncJob implement full pipeline; UrteilChunk model has HNSW-capable `vector(1024)` embedding field |
| URTEIL-02 | 17-02 | Taglicher inkrementeller Update-Kanal (BAG RSS) | SATISFIED | registerUrteileSyncJob registers daily 03:00 cron via upsertJobScheduler; processUrteileSyncJob iterates all 7 courts including BAG; GUID cache ensures only new items ingested |
| URTEIL-04 | 17-03 | Helena cites Urteile with Gericht + AZ + Datum + Leitsatz-Snippet + Quellenlink — AZ always from urteil_chunks, never LLM-generated | SATISFIED | URTEILE-QUELLEN block uses DB fields only; anti-hallucination instruction at line 578 explicitly prohibits fabricated AZ values |

**URTEIL-03 note:** REQUIREMENTS.md maps URTEIL-03 to Phase 16 (NER-based PII filter via Ollama). No Phase 17 plan claims URTEIL-03. This is correct — Phase 17 consumes the ner-filter module created in Phase 16 (`runNerFilter` imported from `@/lib/pii/ner-filter`). No orphan.

**Required IDs from prompt (URTEIL-01, URTEIL-02, URTEIL-04):** All 3 accounted for and satisfied.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `rss-client.ts` | 164, 194 | `return []` | Info | Intentional — flatMap skip pattern for parse-failure isolation. Not a stub. Documented in plan spec. |

No blockers or warnings found. The two `return []` occurrences are legitimate: flatMap returning empty array for parse failures is the intended graceful degradation per the plan spec ("return [] so parse failures silently skip the item").

---

### Human Verification Required

#### 1. Live BMJ RSS Feed Parsing

**Test:** From the running app environment, manually trigger fetchUrteileFeed('BAG') against live rechtsprechung-im-internet.de
**Expected:** Returns an array of UrteilRssItem objects with correctly parsed aktenzeichen (e.g., "7 AZR 185/24"), datum (Date object), entscheidungstyp ("Urteil" or "Beschluss"), and sourceUrl
**Why human:** Live HTTP call to external RSS feed — cannot verify from static analysis. Title regex correctness against actual BGH/BVerfG title variants (Kammerbeschluss, Nichtannahmebeschluss) can only be confirmed with real data.

#### 2. End-to-End BullMQ Sync Job

**Test:** Click "Trigger urteile-sync" in Admin Jobs UI (or use Bull Board). Check job result.
**Expected:** Job completes with `{ inserted: N, skipped: 0, piiRejected: M, failed: 0 }` on first run. On second run: `{ inserted: 0, skipped: N+M, piiRejected: 0, failed: 0 }` confirming GUID cache works.
**Why human:** Requires running Docker environment with Redis, PostgreSQL, Ollama NER service (port 11434), and live network access to BMJ feeds.

#### 3. Helena Urteil Citation in ki-chat

**Test:** Ask Helena: "Was hat das BAG zu Befristungsrecht entschieden?" in a ki-chat session with at least 5 urteil_chunks in the database.
**Expected:** Helena's response includes a URTEILE-QUELLEN citation block with real Aktenzeichen from the database (format: "7 AZR 185/24"), not a hallucinated case number. The Quellenlink points to rechtsprechung-im-internet.de.
**Why human:** End-to-end semantic relevance test — requires populated urteil_chunks, Ollama embedding service, and LLM response evaluation.

---

### Commit Verification

All 5 documented commits verified in git history:

| Commit | Message | Verified |
|--------|---------|---------|
| `381a312` | feat(17-01): create rss-client.ts | Yes |
| `905ff0d` | feat(17-01): create ingestion.ts | Yes |
| `938096b` | feat(17-02): create urteile-sync.processor.ts | Yes |
| `cd225b0` | feat(17-02): wire urteileSyncQueue + urteile-sync Worker | Yes |
| `9b75afd` | feat(17-03): add Chain E — parallel Urteil retrieval and URTEILE-QUELLEN injection | Yes |

---

### Summary

Phase 17 fully achieves its goal. The implementation is complete and non-stub across all 6 files:

1. **Data layer (Plan 01):** `rss-client.ts` fetches and parses all 7 BMJ RSS feeds with a robust title regex and graceful parse-failure skipping. `ingestion.ts` implements the DSGVO gate (runNerFilter inline before any INSERT), idempotent DELETE+INSERT via pgvector, GUID deduplication cache via SystemSetting, and URTEIL-04-compliant search with empty-aktenzeichen post-filter.

2. **BullMQ pipeline (Plan 02):** `urteile-sync.processor.ts` orchestrates all 7 courts with per-court error isolation. `queues.ts` exports `urteileSyncQueue` and `registerUrteileSyncJob` (daily 03:00 Europe/Berlin cron). `worker.ts` registers the Worker with concurrency:1, startup cron call, and graceful shutdown inclusion.

3. **Helena RAG integration (Plan 03):** `ki-chat/route.ts` receives Chain E in parallel with Chain D via the existing `Promise.all()`. The URTEILE-QUELLEN block injects only DB-sourced citation fields (Gericht, AZ, Datum, Quellenlink). The explicit anti-hallucination instruction prohibits fabricated Aktenzeichen values.

Three human verification items remain for end-to-end runtime validation (live RSS, running BullMQ job, populated database).

---

_Verified: 2026-02-27T11:00:00Z_
_Verifier: Claude (gsd-verifier)_
