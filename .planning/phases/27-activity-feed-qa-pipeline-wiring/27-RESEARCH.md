# Phase 27: Activity Feed + QA Pipeline Wiring Fixes - Research

**Researched:** 2026-02-28
**Domain:** Cross-phase integration gap closure (Activity Feed UI, Draft Approval, QA Pipeline)
**Confidence:** HIGH

## Summary

Phase 27 closes 3 cross-phase integration gaps discovered during the v0.2 milestone audit. All components exist on both sides of each gap -- the issue is purely wiring: wrong API paths, missing database writes, and an uncalled function. This is a surgical fix phase, not new feature development.

The 3 gaps are: (1) DraftReviewActions in the activity feed calls non-existent API sub-paths (`/accept`, `/reject`, `/edit`) instead of the single `PATCH /api/helena/drafts/[id]` endpoint with action in body, plus sends wrong body field names. (2) Helena write tools and the Schriftsatz pipeline create HelenaDraft records but never write an AktenActivity entry of type HELENA_DRAFT, so drafts never appear in the chronological activity feed. (3) `logRetrieval()` in `retrieval-log.ts` is defined and tested but never called by any production code, so the SchriftsatzRetrievalLog table is always empty and the QA release gate reads zero data.

**Primary recommendation:** Fix all 3 gaps in 2 focused plans -- one for UI + feed wiring (Gap 1 + 2), one for QA pipeline wiring (Gap 3) plus release gate validation and remaining requirements polish.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DRFT-02 | ENTWURF-Gate auf Prisma-Middleware-Ebene | Already implemented in `src/lib/db.ts` via `$extends`. Gap 1 fix enables the draft review flow to actually reach this gate. |
| DRFT-03 | Draft-Anzeige im Akte-Feed visuell markiert mit Accept/Reject/Edit Buttons | Gap 2 fix creates AktenActivity(HELENA_DRAFT) so drafts appear in feed. Gap 1 fix makes Accept/Reject/Edit buttons functional. |
| DRFT-04 | Bei Ablehnung: Feedback-Feld wird in Helena-Kontext gespeichert | Gap 1 fix enables rejection flow to reach `rejectDraft()` which already stores feedback in HelenaMemory. |
| UI-05 | Helena-Task-Status im Chat: Laufende Tasks zeigen Fortschritt | Already implemented via `HelenaTaskProgress` component + `useHelenaTaskProgress` hook. Gap 2 fix ensures task completion results (drafts) appear in feed. |
| UI-06 | Draft-Review inline im Feed: Accept/Reject/Edit ohne Seitenwechsel | Gap 1 (API path fix) + Gap 2 (AktenActivity creation) together enable this. |
| TASK-03 | HelenaTask speichert vollstaendigen Agent-Trace | Already implemented in `helena-task.processor.ts` line 155-158 (`steps: JSON.parse(JSON.stringify(result.steps))`). Gap 2 fix ensures draft creation is visible in feed alongside task completion. |
| QA-04 | Schriftsatz-Retrieval-Log pro Entwurf | Gap 3 fix: call `logRetrieval()` from `runSchriftsatzPipeline()` after draft creation. |
| QA-06 | Release-Gates: Recall@5 >= 0.85, Halluzinationsrate <= 0.05, Formale Vollstaendigkeit >= 0.90 | Release gate endpoint exists. Gap 3 fix populates data so gate can evaluate real metrics. |
| QA-07 | Keine Mandantendaten in Logs (nur anonymisierte Query-Hashes) | `hashQuery()` using SHA-256 already implemented in `retrieval-log.ts`. Gap 3 fix calls it via `logRetrieval()`. |
</phase_requirements>

## Standard Stack

### Core (No New Dependencies)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Next.js App Router | 14+ | API routes, React components | Existing |
| Prisma | 5.x | ORM for AktenActivity + SchriftsatzRetrievalLog | Existing |
| Socket.IO (via getSocketEmitter) | existing | Real-time feed update notifications | Existing |
| Zod | existing | API validation (ActionSchema already defined) | Existing |

**No new packages needed.** All fixes use existing infrastructure.

## Architecture Patterns

### Existing Patterns to Follow

#### Pattern 1: AktenActivity Creation with Socket.IO Notification
**Source:** `src/app/api/akten/[id]/feed/route.ts` (POST handler, lines 91-113)
**When:** Any time an AktenActivity is created, emit `akten-activity:new` to the Akte's Socket.IO room.
```typescript
// 1. Create activity entry
const activity = await ctx.prisma.aktenActivity.create({
  data: {
    akteId: targetAkteId,
    typ: "HELENA_DRAFT",
    titel: `Helena-Entwurf: ${draft.titel}`,
    inhalt: draft.inhalt?.slice(0, 200) ?? null,
    userId: null, // null = Helena-generated
    meta: {
      draftId: draft.id,
      draftStatus: "PENDING",
      draftTyp: draft.typ,
    },
  },
});

// 2. Emit Socket.IO event for real-time feed banner
try {
  getSocketEmitter()
    .to(`akte:${targetAkteId}`)
    .emit("akten-activity:new", {
      akteId: targetAkteId,
      activityId: activity.id,
      typ: "HELENA_DRAFT",
    });
} catch { /* non-critical */ }
```

#### Pattern 2: Draft API Action Pattern
**Source:** `src/app/api/helena/drafts/[id]/route.ts` (PATCH handler)
**The single correct API endpoint:**
```typescript
// Accept: PATCH /api/helena/drafts/${draftId}
fetch(`/api/helena/drafts/${draftId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "accept" }),
});

// Reject: PATCH /api/helena/drafts/${draftId}
fetch(`/api/helena/drafts/${draftId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "reject",
    text: rejectFeedback,    // NOT "feedback"
    categories: [],          // optional
  }),
});

// Edit: PATCH /api/helena/drafts/${draftId}
fetch(`/api/helena/drafts/${draftId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "edit",
    inhalt: editText,        // NOT "content"
  }),
});
```

#### Pattern 3: Fire-and-Forget Side Effects
**Source:** All write tools use `notifyDraftCreated(...).catch(() => {})` pattern.
**When:** AktenActivity creation + Socket.IO emission in write tools should use same fire-and-forget pattern to never fail the core tool operation.

#### Pattern 4: logRetrieval() Call Shape
**Source:** `src/lib/helena/qa/retrieval-log.ts`
```typescript
import { logRetrieval } from "@/lib/helena/qa/retrieval-log";

await logRetrieval({
  schriftsatzId: draft.id,       // HelenaDraft ID
  queryText: message,             // Original user query (will be SHA-256 hashed)
  retrievalBelege: assemblyResult.allBelege,
  promptVersion: "schriftsatz-v1", // Fixed version string for current pipeline
  modell: modelName,              // From getModelForTier(3)
});
```

## Verified Gap Analysis (Source Code Evidence)

### Gap 1: DraftReviewActions Wrong API Paths + Wrong Body Fields

**File:** `src/components/akten/activity-feed-entry.tsx`

**Problem 1 -- Wrong URLs (3 occurrences):**
- Line 226: `fetch(\`/api/helena/drafts/${draftId}/accept\`, { method: "PATCH" })` -- 404
- Line 241: `fetch(\`/api/helena/drafts/${draftId}/reject\`, ...)` -- 404
- Line 259: `fetch(\`/api/helena/drafts/${draftId}/edit\`, ...)` -- 404

**Problem 2 -- Wrong body fields:**
- `handleAccept()` sends no body at all (needs `{ action: "accept" }`)
- `handleReject()` sends `{ feedback: rejectFeedback }` (API expects `{ action: "reject", text: string, categories?: string[] }`)
- `handleSaveEdit()` sends `{ content: editText }` (API expects `{ action: "edit", inhalt: string }`)

**Correct API:** Single endpoint `PATCH /api/helena/drafts/${draftId}` with discriminated union body `{ action: "accept" | "reject" | "edit", ...fields }` validated by Zod `ActionSchema`.

**Evidence:** API route at `src/app/api/helena/drafts/[id]/route.ts` lines 12-26 define the ActionSchema. No sub-path routes (`[id]/accept/route.ts` etc.) exist.

**Fix:** Update all 3 fetch calls to use correct URL and body format. Detailed field mapping:

| Current | Correct |
|---------|---------|
| `URL: /drafts/${id}/accept`, no body | `URL: /drafts/${id}`, body: `{ action: "accept" }` |
| `URL: /drafts/${id}/reject`, body: `{ feedback }` | `URL: /drafts/${id}`, body: `{ action: "reject", text: feedback }` |
| `URL: /drafts/${id}/edit`, body: `{ content }` | `URL: /drafts/${id}`, body: `{ action: "edit", inhalt: editText }` |

### Gap 2: No AktenActivity Created When Helena Creates Drafts

**Files affected (5 draft creation sites):**
1. `src/lib/helena/tools/_write/create-draft-dokument.ts` -- line 44 (`ctx.prisma.helenaDraft.create`)
2. `src/lib/helena/tools/_write/create-draft-frist.ts` -- line 58
3. `src/lib/helena/tools/_write/create-notiz.ts` -- line 42
4. `src/lib/helena/tools/_write/create-draft-zeiterfassung.ts` -- line 58
5. `src/lib/helena/schriftsatz/index.ts` -- line 276

**Evidence:** Grepping for `aktenActivity.create` in `src/lib/helena/tools/_write/` returns zero matches. The `draft-service.ts` creates AktenActivity entries on accept/reject/edit but NOT on initial draft creation.

**What needs to happen at each site:**
After `helenaDraft.create()` succeeds, add:
```typescript
await ctx.prisma.aktenActivity.create({
  data: {
    akteId: targetAkteId,
    typ: "HELENA_DRAFT",
    titel: `Helena-Entwurf: ${draft.titel}`,
    inhalt: draft.inhalt?.slice(0, 200) ?? null,
    userId: null, // Helena = null user
    meta: {
      draftId: draft.id,
      draftStatus: "PENDING",
      draftTyp: draft.typ,
    },
  },
});
```

Plus emit Socket.IO `akten-activity:new` event.

**Critical consideration:** `meta.draftStatus` MUST be `"PENDING"` to trigger the inline review condition at `activity-feed-entry.tsx:165`.

**Implementation choice -- helper function vs inline:**
Create a shared helper `createDraftActivity(prisma, { akteId, draft })` in a new or existing file (e.g., `draft-notification.ts` or a new `draft-activity.ts`) to avoid 5x copy-paste. All 5 sites follow identical pattern.

### Gap 3: logRetrieval() Never Called

**File:** `src/lib/helena/qa/retrieval-log.ts` -- `logRetrieval()` defined at line 17.
**Evidence:** Grep for `logRetrieval` across all of `src/` returns only the definition file. Zero callers.

**Where it needs to be called:** `src/lib/helena/schriftsatz/index.ts`, after the `helenaDraft.create()` at line 276, when `status === "complete"`. At that point, the following are in scope:
- `draft.id` -- the schriftsatzId
- `message` -- the original query text (will be hashed by logRetrieval)
- `assemblyResult.allBelege` -- the retrieval belege
- Model name from `getModelForTier(3)` -- currently called inside `assembleSchriftsatz()` but modelName is not returned

**Problem:** `assembleSchriftsatz()` calls `getModelForTier(3)` internally (rag-assembler.ts line 104) but does not surface the `modelName` to the caller. Options:
1. Call `getModelForTier(3)` again in the pipeline index (it caches via SystemSettings) -- simplest
2. Return `modelName` from `assembleSchriftsatz()` -- cleaner but changes the interface

**Recommendation:** Call `getModelForTier(3)` in the pipeline and pass the modelName. The function is fast (reads cached settings) and this avoids changing the assembler's return type.

**promptVersion:** Use a static string like `"schriftsatz-v1"`. This can be versioned when the pipeline prompts change.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Draft review API calls | Custom sub-path routes | Existing PATCH endpoint with ActionSchema | Already built, tested, handles RBAC/undo/auto-revise |
| Activity feed entry rendering | New component | Existing ActivityFeedEntry with HELENA_DRAFT case | Already handles expand/collapse, source display, status badges |
| QA metric collection | Custom log aggregation | Existing getRetrievalMetricsSummary + release-gate endpoint | Full metrics pipeline already built |
| Query hashing for PII | Custom hash function | Existing hashQuery() in retrieval-log.ts | SHA-256 already implemented per QA-07 |
| Socket.IO emission | Direct socket calls | Existing getSocketEmitter() pattern | Handles Redis-backed emission consistently |

## Common Pitfalls

### Pitfall 1: Missing `action` field in request body
**What goes wrong:** The DraftReviewActions must include `action: "accept"|"reject"|"edit"` in the JSON body. Without it, the Zod discriminated union validation fails with 400.
**Why it happens:** The accept handler currently sends no body at all (`method: "PATCH"` only). Must add `headers: { "Content-Type": "application/json" }` and `body: JSON.stringify({ action: "accept" })`.
**How to avoid:** Every PATCH call to the drafts endpoint needs both Content-Type header and action field.

### Pitfall 2: Wrong field names in reject/edit bodies
**What goes wrong:** The reject handler sends `{ feedback }` but API expects `{ text }`. The edit handler sends `{ content }` but API expects `{ inhalt }`.
**Why it happens:** The activity-feed-entry.tsx was written independently from the API route and used intuitive English field names instead of the actual German/Zod-defined ones.
**How to avoid:** Map fields exactly to ActionSchema: reject uses `text` (not `feedback`), edit uses `inhalt` (not `content`).

### Pitfall 3: AktenActivity userId must be null for Helena
**What goes wrong:** If userId is set to a user ID, the feed entry shows as human-created (no Bot icon, no brand-blue border).
**Why it happens:** The `isHelena` check in ActivityFeedEntry is `entry.user === null` (line 96). AktenActivity.userId being null cascades through the Prisma include to set `user: null` in the JSON response.
**How to avoid:** When creating AktenActivity for Helena draft creation, always set `userId: null`.

### Pitfall 4: meta.draftStatus must be "PENDING" string
**What goes wrong:** The inline review condition checks `entry.meta?.draftStatus === "PENDING"` at line 165. If meta doesn't contain `draftStatus: "PENDING"`, the Accept/Reject/Edit buttons never render.
**How to avoid:** Include `draftStatus: "PENDING"` in the meta JSON when creating the AktenActivity.

### Pitfall 5: logRetrieval needs model name not available in pipeline scope
**What goes wrong:** `assembleSchriftsatz()` uses `getModelForTier(3)` internally but doesn't return the modelName.
**How to avoid:** Call `getModelForTier(3)` in the pipeline index to get the modelName, or add `modelName` to AssemblyResult.

### Pitfall 6: Draft activity must not fail the tool
**What goes wrong:** If `aktenActivity.create` throws (e.g., DB connection issue), the entire tool fails even though the draft was created successfully.
**Why it happens:** Tool execution is not wrapped in try-catch for the activity creation.
**How to avoid:** Wrap activity creation + Socket.IO in try-catch, same fire-and-forget pattern as `notifyDraftCreated().catch(() => {})`.

## Code Examples

### Fix 1: Corrected DraftReviewActions API calls
```typescript
// activity-feed-entry.tsx -- handleAccept
async function handleAccept() {
  setActionLoading(true);
  try {
    const res = await fetch(`/api/helena/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (!res.ok) throw new Error();
    toast.success("Entwurf angenommen");
    onStatusChange("ACCEPTED");
  } catch {
    toast.error("Fehler beim Annehmen");
  }
  setActionLoading(false);
}

// activity-feed-entry.tsx -- handleReject
async function handleReject() {
  setActionLoading(true);
  try {
    const res = await fetch(`/api/helena/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reject",
        text: rejectFeedback || undefined,
      }),
    });
    if (!res.ok) throw new Error();
    toast.success("Entwurf abgelehnt");
    onStatusChange("REJECTED");
    setRejectMode(false);
  } catch {
    toast.error("Fehler beim Ablehnen");
  }
  setActionLoading(false);
}

// activity-feed-entry.tsx -- handleSaveEdit
async function handleSaveEdit() {
  setActionLoading(true);
  try {
    const res = await fetch(`/api/helena/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "edit",
        inhalt: editText,
      }),
    });
    if (!res.ok) throw new Error();
    toast.success("Entwurf bearbeitet");
    setEditMode(false);
  } catch {
    toast.error("Fehler beim Speichern");
  }
  setActionLoading(false);
}
```

### Fix 2: Shared helper for draft AktenActivity creation
```typescript
// src/lib/helena/draft-activity.ts
import type { ExtendedPrismaClient } from "@/lib/db";
import type { PrismaTransactionClient } from "@/lib/db";
import { getSocketEmitter } from "@/lib/socket/emitter";

/**
 * Create an AktenActivity entry when Helena creates a draft.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function createDraftActivity(
  prisma: ExtendedPrismaClient | PrismaTransactionClient,
  params: {
    akteId: string;
    draftId: string;
    draftTitel: string;
    draftInhalt: string | null;
    draftTyp: string;
  },
): Promise<void> {
  try {
    const activity = await (prisma as ExtendedPrismaClient).aktenActivity.create({
      data: {
        akteId: params.akteId,
        typ: "HELENA_DRAFT",
        titel: `Helena-Entwurf: ${params.draftTitel}`,
        inhalt: params.draftInhalt?.slice(0, 200) ?? null,
        userId: null, // Helena = null user
        meta: {
          draftId: params.draftId,
          draftStatus: "PENDING",
          draftTyp: params.draftTyp,
        },
      },
    });

    // Emit Socket.IO event for real-time feed banner
    getSocketEmitter()
      .to(`akte:${params.akteId}`)
      .emit("akten-activity:new", {
        akteId: params.akteId,
        activityId: activity.id,
        typ: "HELENA_DRAFT",
      });
  } catch {
    // Non-critical: draft was already created successfully
  }
}
```

### Fix 3: Wire logRetrieval into Schriftsatz pipeline
```typescript
// In src/lib/helena/schriftsatz/index.ts, after draft creation (around line 298)
import { logRetrieval } from "@/lib/helena/qa/retrieval-log";
import { getModelForTier } from "../complexity-classifier";

// After draft creation, log retrieval for QA-04 audit trail
try {
  const { modelName } = await getModelForTier(3);
  await logRetrieval({
    schriftsatzId: draft.id,
    queryText: message,
    retrievalBelege: assemblyResult.allBelege,
    promptVersion: "schriftsatz-v1",
    modell: modelName,
  });
} catch {
  // Non-critical: QA logging failure must not fail the pipeline
}
```

## Requirement Status Clarifications

Several requirements assigned to Phase 27 are **already implemented** and just need the wiring fixed to be exercisable:

| Requirement | Current State | What Phase 27 Fixes |
|-------------|--------------|---------------------|
| DRFT-02 (ENTWURF gate) | `$extends` in db.ts fully functional | Gap 1 fix enables the draft review path that exercises the gate |
| DRFT-03 (Draft in feed) | ActivityFeedEntry has full HELENA_DRAFT rendering | Gap 2 creates the AktenActivity so entries actually appear |
| DRFT-04 (Rejection feedback) | `rejectDraft()` stores feedback + updates HelenaMemory | Gap 1 fix enables rejection to reach `rejectDraft()` |
| UI-05 (Task progress) | `HelenaTaskProgress` + `useHelenaTaskProgress` fully wired | Gap 2 ensures completion artifacts appear in feed |
| UI-06 (Inline review) | `DraftReviewActions` component rendered in feed | Gap 1 + Gap 2 make it reachable and functional |
| TASK-03 (Agent trace) | Processor stores `steps: JSON.parse(...)` on completion | Already working -- no changes needed |
| QA-04 (Retrieval log) | `logRetrieval()` + Prisma model + API endpoint exist | Gap 3 calls the function |
| QA-06 (Release gates) | Release gate endpoint computes pass/fail | Gap 3 populates the data it reads |
| QA-07 (No PII in logs) | `hashQuery()` SHA-256 in retrieval-log.ts | Gap 3 routes queries through it |

## Additional Considerations the Audit May Have Missed

### 1. Draft Activity Update on Accept/Reject
The `draft-service.ts` already creates AktenActivity entries on accept/reject/edit with titles like "Helena-Entwurf angenommen/abgelehnt/bearbeitet". However, the original "Helena-Entwurf: ..." activity created by the write tool will still show `draftStatus: "PENDING"` in its meta. The `DraftReviewActions` component uses local `draftStatus` state that updates on action success (line 92-93), so the UI will be correct for the current session. **This is acceptable** because reloading the feed will show both entries (creation + action).

### 2. Socket.IO Import in Write Tools
The write tools currently import from `@/lib/helena/draft-notification` for Socket.IO. Adding `getSocketEmitter` import would introduce an additional dependency. **Recommendation:** Use the shared `createDraftActivity` helper which encapsulates the Socket.IO call, keeping the tools clean.

### 3. Schriftsatz Pipeline Uses Module-Level `prisma` Import
The `schriftsatz/index.ts` receives `prisma` as `options.prisma` (ExtendedPrismaClient). The `logRetrieval()` in `retrieval-log.ts` uses module-level `prisma` import from `@/lib/db`. Both point to the same singleton. **No issue** -- but be aware that `logRetrieval` does NOT accept a prisma parameter; it uses its own import.

### 4. ToolContext Has prisma but Not PrismaTransactionClient
The write tools receive `ctx.prisma` which is `ExtendedPrismaClient`. The AktenActivity creation should use `ctx.prisma` directly (not inside a transaction), matching the existing pattern where `notifyDraftCreated` is called outside the transaction scope.

## Open Questions

1. **Should draft activity update meta.draftStatus on accept/reject?**
   - What we know: The creation-time AktenActivity will keep `draftStatus: "PENDING"` in meta forever. A separate activity is created for accept/reject.
   - What's unclear: Should we also update the original activity's meta? The UI uses component state, so it works per-session.
   - Recommendation: Skip for now. The feed shows both entries chronologically, which is actually more informative than updating in-place.

2. **promptVersion string format**
   - What we know: Needs to be a string identifier for the current pipeline prompt configuration.
   - What's unclear: No existing convention for version strings.
   - Recommendation: Use `"schriftsatz-v1"` as a simple static string. Version bump it when section prompts in rag-assembler.ts change.

## Sources

### Primary (HIGH confidence)
- Source code inspection of 12 files across `src/lib/helena/`, `src/components/akten/`, `src/app/api/` -- verified all audit claims
- Prisma schema inspection for AktenActivity, SchriftsatzRetrievalLog, HelenaTask models
- v0.2 Milestone Audit report (`.planning/v0.2-MILESTONE-AUDIT.md`)

### Source Code Files Verified
| File | Lines | What Was Verified |
|------|-------|-------------------|
| `src/components/akten/activity-feed-entry.tsx` | 528 | Wrong API URLs at lines 226, 241, 259; wrong body fields; meta.draftStatus condition at line 165 |
| `src/lib/helena/tools/_write/create-draft-dokument.ts` | 81 | No AktenActivity creation after helenaDraft.create |
| `src/lib/helena/tools/_write/create-draft-frist.ts` | 101 | No AktenActivity creation after helenaDraft.create |
| `src/lib/helena/tools/_write/create-notiz.ts` | 77 | No AktenActivity creation after helenaDraft.create |
| `src/lib/helena/tools/_write/create-draft-zeiterfassung.ts` | 100 | No AktenActivity creation after helenaDraft.create |
| `src/lib/helena/schriftsatz/index.ts` | 491 | No AktenActivity creation + no logRetrieval() call after draft creation |
| `src/lib/helena/qa/retrieval-log.ts` | 89 | logRetrieval() defined, hashQuery() implemented, zero callers in production |
| `src/app/api/helena/drafts/[id]/route.ts` | 263 | ActionSchema confirmed (discriminated union with action field) |
| `src/lib/helena/draft-service.ts` | 468 | AktenActivity created on accept/reject/edit but NOT on initial creation |
| `src/lib/helena/draft-notification.ts` | 111 | Socket.IO pattern: getSocketEmitter().to().emit() |
| `src/app/api/akten/[id]/feed/route.ts` | 146 | akten-activity:new emission pattern |
| `src/lib/db.ts` | 64 | ENTWURF gate via $extends confirmed (DRFT-02) |
| `src/lib/helena/schriftsatz/rag-assembler.ts` | 657 | getModelForTier(3) called but modelName not returned |
| `src/lib/helena/complexity-classifier.ts` | ~220 | getModelForTier returns { model, modelName } |
| `src/components/akten/helena-task-progress.tsx` | 48 | UI-05 fully implemented |
| `src/lib/queue/processors/helena-task.processor.ts` | 207 | TASK-03 steps stored at line 156 |

## Metadata

**Confidence breakdown:**
- Gap 1 (API paths): HIGH -- verified wrong URLs against existing route, verified body field mismatches against ActionSchema
- Gap 2 (AktenActivity): HIGH -- grep confirms zero activity creation in write tools, schema confirmed
- Gap 3 (logRetrieval): HIGH -- grep confirms zero callers, function signature and schema verified
- Architecture patterns: HIGH -- all patterns taken from existing production code in same codebase

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable internal codebase, no external dependencies)
