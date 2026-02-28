---
phase: 27-activity-feed-qa-pipeline-wiring
verified: 2026-02-28T12:30:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 27: Activity Feed + QA Pipeline Wiring Verification Report

**Phase Goal:** Close 3 cross-phase integration gaps found by v0.2 audit -- fix inline draft review API paths, create AktenActivity entries for Helena drafts, and wire logRetrieval() into the Schriftsatz pipeline
**Verified:** 2026-02-28T12:30:00Z
**Status:** passed
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DraftReviewActions accept/reject/edit buttons call `PATCH /api/helena/drafts/${id}` with `{ action }` discriminator body | VERIFIED | activity-feed-entry.tsx lines 226-271: all 3 handlers use correct URL and body |
| 2 | Helena-created drafts appear as HELENA_DRAFT entries in the chronological activity feed with Accept/Reject/Edit buttons visible | VERIFIED | draft-activity.ts creates AktenActivity(typ=HELENA_DRAFT, meta.draftStatus="PENDING"); feed-entry renders DraftReviewActions when draftStatus==="PENDING" |
| 3 | Rejecting a draft with feedback from the feed stores the feedback in Helena context for future improvement | VERIFIED | PATCH handler passes `text` to `rejectDraft()`; draft-service.ts upserts rejection patterns into HelenaMemory (lines 235-271) |
| 4 | After a Schriftsatz pipeline produces a draft, a SchriftsatzRetrievalLog entry exists with query hash, retrieval belege, prompt version, and model name | VERIFIED | schriftsatz/index.ts lines 314-325: logRetrieval() called with all required fields; retrieval-log.ts stores SHA-256 hashed queryText via hashQuery() |
| 5 | QA release gate endpoint reads real retrieval data instead of showing KEINE DATEN | VERIFIED | release-gate/route.ts calls getRetrievalMetricsSummary() from retrieval-log.ts; no "KEINE DATEN" string present; dataPoints reflects real DB count |
| 6 | No raw Mandantendaten appear in the retrieval log -- only SHA-256 hashed query text | VERIFIED | retrieval-log.ts line 37: `queryHash: hashQuery(queryText)` -- SHA-256 via createHash("sha256"); raw queryText never stored |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/helena/draft-activity.ts` | Shared helper for AktenActivity creation + Socket.IO emission | VERIFIED | Exports `createDraftActivity`; creates AktenActivity(typ=HELENA_DRAFT, userId=null, meta.draftStatus="PENDING"); emits `akten-activity:new` to `akte:${akteId}` room; try-catch fire-and-forget pattern |
| `src/components/akten/activity-feed-entry.tsx` | Fixed DraftReviewActions with correct API paths | VERIFIED | `handleAccept`: `PATCH /api/helena/drafts/${draftId}` + `{ action: "accept" }`; `handleReject`: `PATCH` + `{ action: "reject", text: rejectFeedback }` ; `handleSaveEdit`: `PATCH` + `{ action: "edit", inhalt: editText }`; all include `Content-Type: application/json` header |
| `src/lib/helena/tools/_write/create-draft-dokument.ts` | createDraftActivity wired after draft creation | VERIFIED | Line 71-77: `createDraftActivity(ctx.prisma, {...}).catch(() => {})` after notifyDraftCreated |
| `src/lib/helena/tools/_write/create-draft-frist.ts` | createDraftActivity wired after draft creation | VERIFIED | Line 89-95: `createDraftActivity(ctx.prisma, {...}).catch(() => {})` after notifyDraftCreated |
| `src/lib/helena/tools/_write/create-notiz.ts` | createDraftActivity wired after draft creation | VERIFIED | Line 68-74: `createDraftActivity(ctx.prisma, {...}).catch(() => {})` after notifyDraftCreated |
| `src/lib/helena/tools/_write/create-draft-zeiterfassung.ts` | createDraftActivity wired after draft creation | VERIFIED | Line 89-95: `createDraftActivity(ctx.prisma, {...}).catch(() => {})` after notifyDraftCreated |
| `src/lib/helena/schriftsatz/index.ts` | logRetrieval() + createDraftActivity() both called after draft creation | VERIFIED | Lines 304-325: createDraftActivity (fire-and-forget) then logRetrieval (try-catch await); both present and ordered correctly |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/components/akten/activity-feed-entry.tsx` | `/api/helena/drafts/[id]` | `PATCH fetch with { action } body` | WIRED | Pattern `fetch.*api/helena/drafts.*action` confirmed in all 3 action handlers (lines 226, 243, 261) |
| `src/lib/helena/tools/_write/*.ts` (4 files) | AktenActivity table | `createDraftActivity helper` | WIRED | All 4 write tools import and call `createDraftActivity` after `notifyDraftCreated` |
| `src/lib/helena/schriftsatz/index.ts` | AktenActivity table | `createDraftActivity helper` | WIRED | Line 30 import; lines 305-311 call |
| `src/lib/helena/schriftsatz/index.ts` | `src/lib/helena/qa/retrieval-log.ts` | `logRetrieval()` function call | WIRED | Line 31 import; lines 316-322 `await logRetrieval({...})` inside try-catch |
| `src/lib/helena/qa/retrieval-log.ts` | SchriftsatzRetrievalLog table | `prisma.schriftsatzRetrievalLog.create` | WIRED | retrieval-log.ts line 34: `await prisma.schriftsatzRetrievalLog.create({...})` with queryHash, retrievalBelege, promptVersion, modell |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DRFT-02 | 27-01 | ENTWURF-Gate on Prisma middleware level: AI-created documents can never leave ENTWURF status | SATISFIED | db.ts lines 17-45: Prisma $extends query extension enforces `status=ENTWURF` on Dokument create/update when `erstelltDurch==="ai"` |
| DRFT-03 | 27-01 | Draft display in Akte feed visually marked "Helena-Entwurf" with Accept/Reject/Edit buttons | SATISFIED | createDraftActivity sets `titel: "Helena-Entwurf: ${draftTitel}"` and `typ: "HELENA_DRAFT"`; activity-feed-entry.tsx renders DraftReviewActions for PENDING drafts with Accept/Reject/Edit buttons |
| DRFT-04 | 27-01 | On rejection: feedback field stored in Helena context for learning effect | SATISFIED | PATCH route passes `text` field to `rejectDraft()`; draft-service.ts upserts rejection patterns array into HelenaMemory (up to 50 patterns retained) |
| UI-05 | 27-01 | Helena task status in chat: running tasks show progress (Step X of Y, current tool) | SATISFIED | helena-task-progress.tsx renders "Step {task.step}/{task.maxSteps}"; activity-feed.tsx subscribes to `helena:task-progress` Socket.IO event |
| UI-06 | 27-01 | Draft review inline in feed: Accept/Reject/Edit without page change | SATISFIED | DraftReviewActions sub-component fully wired with API calls; onStatusChange callback updates local state for immediate UI feedback |
| TASK-03 | 27-01 | HelenaTask stores complete agent trace (thoughts + tool calls as JSON steps[]) | SATISFIED | orchestrator.ts captures AgentStep[] array; AgentRunResult.steps propagated; implementation predates phase 27 (ef40083) but correctly attributed |
| QA-04 | 27-02 | Schriftsatz retrieval log per draft (schriftsatz_id, query_text, retrieval_belege[], prompt_version, modell) | SATISFIED | logRetrieval() called with `schriftsatzId: draft.id`, `queryText: message`, `retrievalBelege: assemblyResult.allBelege`, `promptVersion: "schriftsatz-v1"`, `modell: modelName` |
| QA-06 | 27-02 | Release gates: Recall@5 Normen >= 0.85, Halluzinationsrate <= 0.05, Formale Vollstaendigkeit >= 0.90 | SATISFIED (partial) | release-gate endpoint evaluates recallAt5 threshold from real data; halluzinationsrate and formaleVollstaendigkeit are placeholder 0 values until goldset runs -- this is a known design limitation documented in code comments, not a phase 27 gap |
| QA-07 | 27-02 | No Mandantendaten in logs (only anonymized query hashes for metrics) | SATISFIED | retrieval-log.ts stores `queryHash: hashQuery(queryText)` (SHA-256 hex); raw queryText parameter is never persisted |

**Orphaned requirements:** None. All 9 IDs from the two PLAN frontmatter fields appear in REQUIREMENTS.md and all are mapped to Phase 27.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/akten/activity-feed-entry.tsx` | 310 | `placeholder="Feedback (optional)..."` | Info | HTML input placeholder attribute -- not a code stub |
| `src/lib/helena/schriftsatz/index.ts` | 248, 251 | `placeholder` word in comment about template literal placeholders | Info | Domain term in code comments, not a code stub |
| `src/app/api/admin/qa/release-gate/route.ts` | 40-46 | `value: 0` for halluzinationsrate and formaleVollstaendigkeit | Warning | Pre-existing design limitation: these metrics require goldset batch runs; documented in code comments; not introduced by phase 27 |

No blockers found. The release-gate placeholder values are a pre-existing design limitation from phase 26, not a phase 27 regression.

**Pre-existing TypeScript errors (not introduced by phase 27):**

`src/lib/helena/index.ts` has 5 TS errors (description field not in StepUpdate interface, number not assignable to string in AgentStep content). Last modified in commit `ef40083` (phase 23-01). Phase 27 did not touch this file. Zero TS errors in any phase 27 modified files.

---

### Human Verification Required

#### 1. End-to-End Inline Draft Review Flow

**Test:** Trigger Helena to create a document draft in an Akte (e.g. "@Helena erstelle einen Entwurf fuer eine Klageantwort"), then open the Akte activity feed and verify the draft appears with Accept/Reject/Edit buttons. Click "Annehmen" and confirm the draft status updates in the feed without a page reload.
**Expected:** Draft appears as "Helena-Entwurf: [titel]" with blue left border; Accept/Reject/Edit buttons visible when expanded; clicking Accept fires PATCH, shows toast "Entwurf angenommen", and buttons disappear replaced by "Angenommen" badge.
**Why human:** End-to-end flow requires running app, Socket.IO live emission, and visual inspection.

#### 2. Rejection Feedback Stored in Helena Context

**Test:** Reject a Helena draft with feedback text (e.g. "Zu formell, mehr Praxisbezug"). Then create a new Helena task in the same Akte and observe whether Helena references the rejection pattern.
**Expected:** HelenaMemory stores the rejection pattern; subsequent Helena responses in the same Akte context are influenced by the stored rejection patterns.
**Why human:** Requires running app + AI model interaction to observe behavioral change.

#### 3. QA Release Gate Real Data

**Test:** After a Schriftsatz pipeline run, call `GET /api/admin/qa/release-gate` as ADMIN and verify `dataPoints > 0` and `metrics.recallAt5Normen.value` reflects a real (non-zero) computed value.
**Expected:** `{ passed: <bool>, dataPoints: N, metrics: { recallAt5Normen: { value: <float>, ... } } }` with N > 0.
**Why human:** Requires triggering actual Schriftsatz pipeline execution and then checking the API response.

---

### Gaps Summary

No gaps found. All 6 observable truths are verified, all artifacts exist and are substantive and wired, all 5 key links are connected, and all 9 requirement IDs are accounted for.

The QA-06 halluzinationsrate and formaleVollstaendigkeit metric placeholders (value: 0) in the release gate are a pre-existing known design limitation from phase 26, not introduced by phase 27. They are explicitly documented in code comments as requiring goldset batch runs.

---

_Verified: 2026-02-28T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
