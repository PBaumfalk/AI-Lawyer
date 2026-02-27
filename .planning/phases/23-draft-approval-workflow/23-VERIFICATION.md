---
phase: 23-draft-approval-workflow
verified: 2026-02-27T22:05:00Z
status: passed
score: 5/5 success criteria verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Socket.IO notification fires to the responsible user when Helena creates a new draft (DRFT-06)"
  gaps_remaining: []
  regressions: []
---

# Phase 23: Draft-Approval Workflow Verification Report

**Phase Goal:** Every Helena output goes through explicit human approval before becoming a real record, with BRAK-compliant enforcement at the database level
**Verified:** 2026-02-27T22:05:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (23-03 wired notifyDraftCreated into all 5 draft creation sites)

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Prisma middleware enforces that any document created by Helena always has status=ENTWURF — cannot be bypassed even by direct Prisma calls (BRAK 2025 / BRAO 43) | VERIFIED | `src/lib/db.ts` uses `$extends` with `dokument.create` and `dokument.update` interceptors. Gate checks `erstelltDurch === "ai"` and forces `status = "ENTWURF"`. Defense-in-depth: `acceptDraft()` also sets `status: "ENTWURF"` explicitly inside the transaction. |
| 2 | HelenaDraft entries appear in the Akte feed as "Helena-Entwurf - ausstehend" with Accept/Reject/Edit buttons | VERIFIED | `DraftCard` renders with `border-2 border-dashed border-violet-300`, type icon, `Badge` with status label ("ausstehend"), and three action buttons (Annehmen/Bearbeiten/Ablehnen). `DraftPinnedSection` fetches `GET /api/helena/drafts?akteId=X&status=PENDING` and groups by type with collapsible UI. |
| 3 | Rejecting a draft with feedback stores the reason in Helena context for future improvement | VERIFIED | `rejectDraft()` in `draft-service.ts` calls `prisma.helenaMemory.upsert()` with `content.rejectionPatterns[]` array (capped at 50 entries). Each pattern stores `{ draftTyp, categories, text, timestamp }`. API route passes `categories`, `text`, `noRevise` from the zod-validated body. |
| 4 | Accepting a draft automatically creates the corresponding Dokument/Frist/Notiz in the Akte | VERIFIED | `acceptDraft()` uses `prisma.$transaction` with a `switch(draft.typ)` covering DOKUMENT, FRIST, NOTIZ, and ALERT cases. Each branch creates the appropriate real record. Draft is marked ACCEPTED with `undoExpiresAt` set for 5s undo window. |
| 5 | Socket.IO notification fires to the responsible user when Helena creates a new draft | VERIFIED | All 5 draft creation sites now import and call `notifyDraftCreated` from `draft-notification.ts` with fire-and-forget `.catch(() => {})` pattern. Commits 64581d4 (4 tool executors) and ec48704 (Schriftsatz pipeline Stage 6) confirmed in git history. |

**Score:** 5/5 success criteria verified

---

### Required Artifacts

#### Plan 23-01 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | HelenaDraft revision fields | VERIFIED | `parentDraftId`, `revisionCount`, `feedbackCategories`, `noRevise`, `undoExpiresAt` all present at lines 1933-1943. Self-referential relation "DraftRevisions" and `@@index([parentDraftId])` confirmed. |
| `src/lib/db.ts` | Prisma $extends ENTWURF gate | VERIFIED | `createExtendedPrisma()` wraps PrismaClient with `$extends({ query: { dokument: { create, update } } })`. Both handlers fire for AI-created documents. |
| `src/lib/helena/draft-service.ts` | acceptDraft, rejectDraft, undoAcceptDraft, editDraft | VERIFIED | All four functions exported with full business logic. `rejectDraft` upserts HelenaMemory. `undoAcceptDraft` deletes created record and reverts draft. |
| `src/app/api/helena/drafts/route.ts` | GET endpoint with filters | VERIFIED | Auth, RBAC filter, type/status validation, pagination, includes `user` and `akte` (kurzrubrum). Returns `{ drafts, total, page, limit }`. |
| `src/app/api/helena/drafts/[id]/route.ts` | GET single draft, PATCH accept/reject/edit | VERIFIED | Zod discriminated union `ActionSchema`, routes to service functions, auto-revise via `createHelenaTask` on rejection. |
| `src/app/api/helena/drafts/[id]/undo/route.ts` | POST undo accept within 5s | VERIFIED | Validates undo window, calls `undoAcceptDraft`, returns 409 on expired window. |
| `src/app/api/helena/drafts/[id]/lock/route.ts` | POST/DELETE Redis lock | VERIFIED | `SET NX EX 300` pattern with ownership check on DELETE. Socket.IO `draft:locked` / `draft:unlocked` emits. Fail-open on Redis unavailability. |

#### Plan 23-02 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `src/lib/notifications/types.ts` | 4 helena:draft-* types | VERIFIED | `helena:draft-created`, `helena:draft-revision`, `helena:draft-accepted`, `helena:draft-rejected` present in `NotificationType` union. |
| `src/lib/helena/draft-notification.ts` | notifyDraftCreated, notifyDraftRevision | VERIFIED | 111 lines, calls `createNotification` + `getSocketEmitter`. Module now has 5 active callers — no longer orphaned. |
| `src/components/helena/draft-card.tsx` | DraftCard with type icon, status badge, action buttons | VERIFIED | 250 lines, dashed violet border, type icon map, relative time formatter, action buttons with stopPropagation. DraftLockIndicator integrated. |
| `src/components/helena/draft-detail-modal.tsx` | DraftDetailModal with A/B/R shortcuts, arrow nav, lock acquisition | VERIFIED | 456 lines. `useEffect` keydown listener with tagName guard. Lock acquired on open via `POST /api/helena/drafts/${id}/lock`, released on close. Undo toast with 5s duration. Arrow navigation implemented. |
| `src/components/helena/draft-pinned-section.tsx` | Pending drafts grouped by type, Socket.IO banner | VERIFIED | Fetches `GET /api/helena/drafts?akteId=X&status=PENDING`. Groups by `draft.typ`. `useSocket()` listens for `helena:draft-created` and shows refetch banner. Collapsible per type group. |
| `src/components/helena/draft-reject-form.tsx` | 4 categories, free text, noRevise | VERIFIED | 4 categories ("Inhaltlich falsch", "Unvollstaendig", "Ton/Stil unpassend", "Formatierung"), free text textarea, "Nicht ueberarbeiten" checkbox with explanation. |
| `src/components/helena/draft-lock-indicator.tsx` | "Wird von [Name] geprueft" amber indicator | VERIFIED | Renders amber background with lock icon and "Wird von {lockedBy} geprueft" text. |
| `src/components/helena/draft-inbox.tsx` | Global inbox with Akte/type filters | VERIFIED | Fetches all PENDING drafts, type filter buttons, Akte select dropdown derived from loaded data, pagination with "Mehr laden", DraftDetailModal integration. |
| `src/app/(dashboard)/entwuerfe/page.tsx` | Global draft inbox page | VERIFIED | Server component with FileCheck icon, renders `<DraftInbox />`. |
| `src/components/layout/sidebar.tsx` | Entwuerfe nav item with badge count | VERIFIED | Nav item at position after Dokumente with `badgeKey: "pendingDrafts"`. Socket.IO listeners for all 4 draft event types update badge count in real time. Badge hidden when count is 0. |

#### Plan 23-03 Artifacts (Gap Closure)

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `src/lib/helena/tools/_write/create-draft-dokument.ts` | notifyDraftCreated call after helenaDraft.create | VERIFIED | Line 12: import confirmed. Lines 57-67: akte.findUnique resolves `anwaltId ?? sachbearbeiterId`, then `notifyDraftCreated(...).catch(() => {})` before return. |
| `src/lib/helena/tools/_write/create-draft-frist.ts` | notifyDraftCreated call after helenaDraft.create | VERIFIED | Line 11: import confirmed. Lines 75-85: akte.findUnique resolves `anwaltId ?? sachbearbeiterId`, then `notifyDraftCreated(...).catch(() => {})` before return. |
| `src/lib/helena/tools/_write/create-notiz.ts` | notifyDraftCreated call after helenaDraft.create | VERIFIED | Line 11: import confirmed. Lines 53-64: akte.findUnique resolves `anwaltId ?? sachbearbeiterId`, then `notifyDraftCreated(...).catch(() => {})` before return. |
| `src/lib/helena/tools/_write/create-draft-zeiterfassung.ts` | notifyDraftCreated call after helenaDraft.create | VERIFIED | Line 11: import confirmed. Lines 74-85: akte.findUnique resolves `anwaltId ?? sachbearbeiterId`, then `notifyDraftCreated(...).catch(() => {})` before return. |
| `src/lib/helena/schriftsatz/index.ts` | notifyDraftCreated call after helenaDraft.create in Stage 6 | VERIFIED | Line 29: import confirmed. Lines 289-299: `akteForNotify.findUnique` resolves `anwaltId ?? sachbearbeiterId`, then `notifyDraftCreated(...).catch(() => {})` before pipeline return. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/db.ts` | `prisma.dokument.create/update` | `$extends` query interception | WIRED | Pattern `\$extends.*query.*dokument` found at line 15 of db.ts. Both create and update handlers confirmed. |
| `src/app/api/helena/drafts/[id]/route.ts` | `src/lib/helena/draft-service.ts` | `import { acceptDraft, rejectDraft, editDraft }` | WIRED | Line 4 of route file imports all three functions; all three are called in the switch statement. |
| `src/lib/helena/draft-service.ts` | `prisma.helenaMemory.upsert` | rejection patterns stored in HelenaMemory content JSON | WIRED | `helenaMemory.upsert` confirmed at line 259 of draft-service.ts, inside `rejectDraft()` conditional. |
| `src/lib/helena/tools/_write/create-draft-dokument.ts` | `src/lib/helena/draft-notification.ts` | `import { notifyDraftCreated }` | WIRED | Import at line 12, call at line 64 with `.catch(() => {})`. No `await`. |
| `src/lib/helena/tools/_write/create-draft-frist.ts` | `src/lib/helena/draft-notification.ts` | `import { notifyDraftCreated }` | WIRED | Import at line 11, call at line 82 with `.catch(() => {})`. No `await`. |
| `src/lib/helena/tools/_write/create-notiz.ts` | `src/lib/helena/draft-notification.ts` | `import { notifyDraftCreated }` | WIRED | Import at line 11, call at line 61 with `.catch(() => {})`. No `await`. |
| `src/lib/helena/tools/_write/create-draft-zeiterfassung.ts` | `src/lib/helena/draft-notification.ts` | `import { notifyDraftCreated }` | WIRED | Import at line 11, call at line 82 with `.catch(() => {})`. No `await`. |
| `src/lib/helena/schriftsatz/index.ts` | `src/lib/helena/draft-notification.ts` | `import { notifyDraftCreated }` | WIRED | Import at line 29, call at line 296 with `.catch(() => {})`. No `await`. |
| `src/lib/helena/draft-notification.ts` | `src/lib/notifications/service.ts` | `createNotification()` calls with helena:draft-created type | WIRED | Module is substantive (111 lines) and now has 5 active callers making it reachable at runtime. |
| `src/lib/helena/draft-notification.ts` | `src/lib/socket/emitter.ts` | `getSocketEmitter()` for akte room broadcast | WIRED | Same — module is reachable via all 5 callers. `getSocketEmitter().to(\`akte:${draft.akteId}\`).emit("helena:draft-created", ...)` at line 52. |
| `src/components/helena/draft-pinned-section.tsx` | `/api/helena/drafts` | fetch call to list pending drafts for Akte | WIRED | `fetch(\`/api/helena/drafts?akteId=${akteId}&status=PENDING\`)` confirmed. |
| `src/components/helena/draft-detail-modal.tsx` | `/api/helena/drafts/[id]` | PATCH for accept/reject/edit actions | WIRED | PATCH calls delegated to parent `onAccept`/`onReject`/`onEdit` props which call the API. |
| `src/components/layout/sidebar.tsx` | `/entwuerfe` | navigation item linking to global inbox | WIRED | `{ name: "Entwuerfe", href: "/entwuerfe", icon: FileCheck, badgeKey: "pendingDrafts" }` confirmed. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| DRFT-02 | 23-01 | ENTWURF-Gate auf Prisma-Middleware-Ebene: Helena-erstellte Dokumente koennen nie status!=ENTWURF haben | SATISFIED | `$extends` gate on `dokument.create/update` in `src/lib/db.ts`. Fires for all `erstelltDurch === "ai"` records globally. |
| DRFT-03 | 23-02 | Draft-Anzeige im Akte-Feed visuell markiert ("Helena-Entwurf ausstehend") mit Accept/Reject/Edit Buttons | SATISFIED | `DraftCard` and `DraftPinnedSection` components render with dashed violet border, "Entwurf: {Typ}" label, "ausstehend" badge, and three action buttons. |
| DRFT-04 | 23-01 | Bei Ablehnung: Feedback-Feld wird in Helena-Kontext gespeichert (Lerneffekt) | SATISFIED | `rejectDraft()` upserts `HelenaMemory.content.rejectionPatterns[]` with structured feedback (categories + text + timestamp), capped at 50 entries. |
| DRFT-05 | 23-01 | Akzeptierter Draft wird automatisch als Dokument/Frist/Notiz in der Akte angelegt | SATISFIED | `acceptDraft()` creates real records in a Prisma transaction: `dokument.create` (DOKUMENT), `kalenderEintrag.create` (FRIST), `aktenActivity.create` (NOTIZ/ALERT). |
| DRFT-06 | 23-02, 23-03 | Socket.IO Benachrichtigung an Zustaendigen wenn Helena einen Draft erstellt hat | SATISFIED | `notifyDraftCreated()` imported and called with fire-and-forget pattern from all 5 creation sites. `draft-notification.ts` is now reachable at runtime. Plan deviation: `sachbearbeiterId` used as fallback instead of non-existent `verantwortlichId`. |

---

### Anti-Patterns Found

None — no blockers or warnings after gap closure. The previously identified anti-pattern (dead module with no callers) has been resolved: `draft-notification.ts` is imported by 5 files and is reachable at runtime.

---

### Human Verification Required

None — all automated checks are sufficient for this phase. The gap was code-level (missing function calls), now confirmed closed by grep evidence on actual file contents.

---

### Re-verification Summary

**Gap DRFT-06 is closed.** The single gap from the initial verification has been resolved by Plan 23-03.

**Evidence of closure:**

1. `grep -rn "notifyDraftCreated" src/lib/helena/tools/_write/ src/lib/helena/schriftsatz/index.ts` returns 10 lines: import + invocation in each of the 5 files (5 imports + 5 calls).

2. `grep -rn "await notifyDraftCreated" ...` returns no output — all 5 calls are correctly fire-and-forget.

3. `grep -rn "\.catch(() => {})" ...` returns 5 lines — all 5 invocation sites apply the required error suppression pattern.

4. `grep -rn "import.*draft-notification" src/` returns exactly 5 importers — all are the expected tool executor and pipeline files.

5. Git commits 64581d4 and ec48704 exist and correspond to the described changes.

6. Plan deviation (`sachbearbeiterId` used as fallback instead of non-existent `verantwortlichId`) is correct — the Akte schema has `anwaltId` and `sachbearbeiterId`, not `verantwortlichId`.

All phase 23 deliverables — ENTWURF gate (DRFT-02), UI components (DRFT-03), rejection feedback storage (DRFT-04), draft-to-record acceptance (DRFT-05), and Socket.IO notification wiring (DRFT-06) — are fully implemented and wired. Phase goal achieved.

---

_Verified: 2026-02-27T22:05:00Z_
_Verifier: Claude (gsd-verifier)_
