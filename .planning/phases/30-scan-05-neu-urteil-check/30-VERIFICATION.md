---
phase: 30-scan-05-neu-urteil-check
verified: 2026-02-28T23:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 30: SCAN-05 Neu-Urteil-Check Verification Report

**Phase Goal:** The system proactively detects when newly ingested court decisions are relevant to active cases and alerts the responsible user with a Helena-generated briefing
**Verified:** 2026-02-28T23:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Active Akten have a summaryEmbedding vector generated from their case context | VERIFIED | `prisma/schema.prisma` line 730: `summaryEmbedding Unsupported("vector(1024)")?`; `refreshAkteEmbeddings()` queries all OFFEN Akten and writes embeddings via `$executeRaw` |
| 2  | Akte embedding refresh runs nightly via BullMQ cron before urteile-sync | VERIFIED | `queues.ts`: `registerAkteEmbeddingJob(cronPattern = "30 2 * * *")` with `tz: "Europe/Berlin"`; `worker.ts` calls `registerAkteEmbeddingJob()` before `registerUrteileSyncJob()` in startup |
| 3  | Akten without HelenaMemory or Falldaten still get embedded from core fields | VERIFIED | `assembleAkteSummaryText()` always pushes Sachgebiet + Kurzrubrum first; HelenaMemory and Falldaten blocks are guarded with null checks and `try/catch` |
| 4  | Admin can toggle Neu-Urteil matching and adjust threshold via SystemSetting | VERIFIED | `defaults.ts`: `scanner.neues_urteil_enabled` (boolean) and `scanner.neues_urteil_threshold` (number, min:0.50, max:0.95); admin settings page renders range slider for threshold |
| 5  | After RSS-Urteil ingestion, new Urteile are matched against active Akten and relevant matches are detected | VERIFIED | `runNeuesUrteilCheck()` queries `urteil_chunks` for last 24h, PII-filtered, non-null embedding; runs pgvector cosine similarity join against `akten` with optional Sachgebiet pre-filter |
| 6  | User receives a NEUES_URTEIL alert when a relevant Urteil is found for one of their Akten | VERIFIED | `runNeuesUrteilCheck()` calls `resolveAlertRecipients()` then `createScannerAlert()` with `typ: "NEUES_URTEIL"` per recipient; per-Urteil dedup via `meta.urteilChunkId` JSON path query |
| 7  | Each NEUES_URTEIL alert includes a Helena-generated briefing explaining why the Urteil is relevant | VERIFIED | `generateBriefing()` calls `getModel()` + `generateText()` with 3-section German structured prompt; result stored in `inhalt` field of alert; fallback on LLM failure |
| 8  | Alert-Center UI shows NEUES_URTEIL alerts with proper icon, label, and filter chip | VERIFIED | `alert-center.tsx`: `Scale` icon imported from lucide-react; `NEUES_URTEIL` entry in `ALERT_TYPE_CONFIG` (violet color); `{ value: "NEUES_URTEIL", label: "Neues Urteil" }` in `TYPE_CHIPS` |
| 9  | Admin can adjust threshold via range slider and toggle Neu-Urteil matching independently | VERIFIED | `admin/settings/page.tsx`: special case for `scanner.neues_urteil_threshold` renders `<input type="range">` with Lockerer/Strenger labels and `accent-violet-600` |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | `summaryEmbedding` and `summaryEmbeddingAt` fields on Akte model | VERIFIED | Lines 730-731: `Unsupported("vector(1024)")?` and `DateTime?` present |
| `prisma/migrations/manual_akte_summary_embedding.sql` | Vector column + HNSW index DDL | VERIFIED | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS "summaryEmbedding" vector(1024)` + `CREATE INDEX IF NOT EXISTS akten_summary_embedding_hnsw ... USING hnsw` |
| `src/lib/scanner/akte-embedding.ts` | `assembleAkteSummaryText` + `refreshAkteEmbeddings` | VERIFIED | Both exported; 136 lines; substantive implementation with field ordering, null guards, error isolation |
| `src/lib/queue/processors/akte-embedding.processor.ts` | `processAkteEmbeddingJob` BullMQ processor | VERIFIED | Exported; delegates to `refreshAkteEmbeddings()`; logs result |
| `src/lib/settings/defaults.ts` | `scanner.neues_urteil_enabled` and `scanner.neues_urteil_threshold` | VERIFIED | Both entries present in `DEFAULT_SETTINGS` array with correct types and labels |
| `src/lib/scanner/types.ts` | `neuesUrteilEnabled` and `neuesUrteilThreshold` on `ScannerConfig` | VERIFIED | Lines 32-33: both fields with comments and default values |
| `src/lib/scanner/checks/neues-urteil-check.ts` | Cross-matching logic, Sachgebiet pre-filter, LLM briefing, alert creation | VERIFIED | 331 lines (exceeds 100 min); exports `runNeuesUrteilCheck`; full pipeline present |
| `src/components/helena/alert-center.tsx` | `NEUES_URTEIL` in `ALERT_TYPE_CONFIG` and `TYPE_CHIPS` | VERIFIED | Both present; `Scale` icon imported; violet color applied |
| `src/app/(dashboard)/admin/settings/page.tsx` | Range slider for `scanner.neues_urteil_threshold` | VERIFIED | `type="range"` with Lockerer/Strenger labels rendered conditionally for the threshold key |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/scanner/akte-embedding.ts` | `src/lib/embedding/embedder.ts` | `generateEmbedding()` call | WIRED | Line 8: `import { generateEmbedding }` called at line 110 with result passed to `pgvector.toSql()` |
| `src/worker.ts` | `src/lib/queue/processors/akte-embedding.processor.ts` | BullMQ Worker registration | WIRED | Line 28: import; line 722-724: `new Worker("akte-embedding", async () => processAkteEmbeddingJob())`; pushed to `workers` array |
| `src/lib/queue/queues.ts` | `src/worker.ts` | `registerAkteEmbeddingJob` export | WIRED | Line 4 of worker.ts: `registerAkteEmbeddingJob` imported from queues; called at startup line 962 |
| `src/worker.ts` | `src/lib/scanner/checks/neues-urteil-check.ts` | `urteileSyncWorker.on('completed')` handler | WIRED | Line 29: import; lines 627-632: called inside `if (result?.inserted > 0)` guard |
| `src/lib/scanner/checks/neues-urteil-check.ts` | `src/lib/scanner/service.ts` | `createScannerAlert()` + `resolveAlertRecipients()` | WIRED | Line 13: import; called at lines 245 and 284 respectively |
| `src/lib/scanner/checks/neues-urteil-check.ts` | `src/lib/ai/provider.ts` | `getModel()` + `generateText()` for briefing | WIRED | Lines 15-16: both imported; called at lines 73-74 inside `generateBriefing()` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCAN-01 | 30-01 | System generates summary embedding per active Akte from case context | SATISFIED | `refreshAkteEmbeddings()` queries all OFFEN Akten with helenaMemory + normen includes; calls `assembleAkteSummaryText()` + `generateEmbedding()` + raw SQL UPDATE |
| SCAN-02 | 30-02 | After RSS-Urteil ingestion, system matches new Urteile against active Akten via semantic similarity | SATISFIED | `runNeuesUrteilCheck()` queries last-24h Urteile with pgvector cosine similarity join; Sachgebiet pre-filter applied from `RECHTSGEBIET_TO_SACHGEBIET` mapping |
| SCAN-03 | 30-02 | User receives NEUES_URTEIL alert when a relevant Urteil is found | SATISFIED | `createScannerAlert()` called per recipient with `typ: "NEUES_URTEIL"`; per-Urteil dedup via JSON meta path prevents duplicates |
| SCAN-04 | 30-01 | Admin can configure relevance threshold via SystemSetting | SATISFIED | Two settings in `defaults.ts`; range slider in admin settings page; `getSettingTyped()` reads both at runtime in `runNeuesUrteilCheck()` |
| SCAN-05 | 30-02 | Alert includes Helena-generated briefing explaining why the Urteil is relevant | SATISFIED | `generateBriefing()` uses `getModel()` + `generateText()` with 3-section structured German prompt; result stored in alert `inhalt` field; graceful fallback on failure |

No orphaned requirements found — all 5 SCAN IDs claimed by plans 30-01 and 30-02 are accounted for and verified.

---

### Anti-Patterns Found

No blockers or warnings found.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/scanner/akte-embedding.ts` | 109 | `as unknown as AkteWithContext` cast | Info | Documented workaround for ExtendedPrismaClient / generic incompatibility; type-safe at the query boundary |
| `src/lib/scanner/checks/neues-urteil-check.ts` | 262 | `as unknown as Parameters<...>[0]` cast | Info | Same pattern; consistent with Phase 30 approach; not a stub |

---

### Human Verification Required

#### 1. End-to-End Alert Delivery

**Test:** Ingest a new Urteil via the RSS sync worker and confirm a NEUES_URTEIL alert appears in the Alert-Center for the responsible Anwalt/Sachbearbeiter.
**Expected:** Alert appears with violet Scale icon, structured 3-section German briefing in `inhalt`, and the filter chip "Neues Urteil" filters it correctly.
**Why human:** Requires live Ollama + PostgreSQL + BullMQ environment; pgvector similarity scores depend on actual embeddings.

#### 2. Admin Range Slider Save

**Test:** Open Admin > Settings > Scanner, move the Neu-Urteil threshold slider, and click Save.
**Expected:** New threshold value persisted; subsequent `runNeuesUrteilCheck()` reads updated value from `getSettingTyped()`.
**Why human:** Requires browser interaction and database write confirmation.

#### 3. Nightly Cron Timing

**Test:** Verify the `akte-embedding-daily` job scheduler fires at 02:30 Europe/Berlin and completes before `urteile-sync` at 03:00.
**Expected:** BullMQ Bull Board shows `akte-embedding-daily` scheduled between `gesetze-sync-daily` (02:00) and `urteile-sync-daily` (03:00).
**Why human:** Requires observing BullMQ scheduler in production or staging environment.

---

### Gaps Summary

No gaps. All automated checks passed across all 9 must-have truths, 9 artifacts (all substantive and wired), 6 key links, and 5 requirement IDs.

---

_Verified: 2026-02-28T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
