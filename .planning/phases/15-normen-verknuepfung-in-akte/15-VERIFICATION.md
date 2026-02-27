---
phase: 15-normen-verknuepfung-in-akte
verified: 2026-02-27T08:00:00Z
status: passed
score: 16/16 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Open an Akte detail page and confirm NormenSection renders between the stats row and AkteDetailTabs"
    expected: "A 'Verknuepfte Normen' glass-card section is visible with a 'Norm hinzufuegen' button"
    why_human: "Visual placement and CSS rendering cannot be verified programmatically"
  - test: "Click 'Norm hinzufuegen', type 'BGB' in the search field, select a result, optionally add Anmerkung, click 'Hinzufuegen'"
    expected: "POST returns 201, toast appears, chip appears in the list after router.refresh()"
    why_human: "Full user interaction flow and toast rendering require browser testing"
  - test: "Click the X button on a norm chip"
    expected: "DELETE returns 204, toast 'Norm entfernt', chip disappears after router.refresh()"
    why_human: "Requires live browser interaction and visual confirmation"
  - test: "Click the chip label (e.g. 'BGB 242')"
    expected: "Sheet side panel opens on the right showing full paragraph text, 'nicht amtlich' disclaimer, and source URL"
    why_human: "Sheet open/close animation and content rendering require browser testing"
  - test: "Chat with Helena using an Akte that has pinned normen"
    expected: "The system prompt contains '--- PINNED NORMEN (Akte X --- hoeChste Prioritaet) ---' block before QUELLEN and GESETZE-QUELLEN"
    why_human: "System prompt content at runtime requires server log inspection or debug output"
---

# Phase 15: Normen-Verknuepfung in Akte Verification Report

**Phase Goal:** Anwaelte koennen §§ strukturiert an Akten pinnen — pinned Normen fliessen automatisch in Helenas System-Kontext fuer genau diese Akte ein
**Verified:** 2026-02-27T08:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/akten/[id]/normen returns list of pinned normen (newest first) | VERIFIED | `prisma.akteNorm.findMany` with `orderBy: { createdAt: "desc" }` — route.ts:23-33 |
| 2 | POST /api/akten/[id]/normen adds a norm, returns 201 with created AkteNorm; returns 409 if already pinned | VERIFIED | `prisma.akteNorm.create` (line 89), 201 return (line 111); duplicate check + 409 (lines 72-87) |
| 3 | DELETE /api/akten/[id]/normen/[normId] removes a norm, returns 204 | VERIFIED | `prisma.akteNorm.delete` (line 29), `new NextResponse(null, { status: 204 })` (line 43) |
| 4 | GET /api/akten/[id]/normen/search?q=... returns up to 20 law_chunks matching ILIKE | VERIFIED | `prisma.$queryRaw` with ILIKE on gesetzKuerzel, paragraphNr, titel; LIMIT 20 (search/route.ts:23-44) |
| 5 | All routes enforce requireAkteAccess RBAC | VERIFIED | Every route calls `requireAkteAccess(akteId)` or `requireAkteAccess(akteId, { requireEdit: true })` |
| 6 | Mutations are logged via logAuditEvent | VERIFIED | POST logs NORM_VERKNUEPFT (route.ts:104-109); DELETE logs NORM_ENTFERNT ([normId]/route.ts:33-41); both types added to AuditAktion union in audit.ts |
| 7 | When an Akte has pinned normen, ki-chat system prompt includes PINNED NORMEN block | VERIFIED | `prisma.akteNorm.findMany` (ki-chat/route.ts:365-368), Promise.all(findFirst) (lines 371-381), block built lines 383-401 and injected at line 508 |
| 8 | Pinned norms block appears BEFORE QUELLEN and GESETZE-QUELLEN | VERIFIED | `if (pinnedNormenBlock)` at line 507 precedes `if (sources.length > 0)` at line 511 and `if (lawChunks.length > 0)` at line 520 |
| 9 | Each pinned norm entry shows gesetzKuerzel, paragraphNr, titel, content, optional anmerkung, 'nicht amtlich' disclaimer, sourceUrl | VERIFIED | Lines 392-398: `[P${i+1}]` label, content, `if (norm.anmerkung)` block, HINWEIS disclaimer with standDate + sourceUrl |
| 10 | When no Akte is selected (akteId is null), pinned norm lookup is skipped | VERIFIED | Line 236: `if (!akteId) return { aktenKontextBlock: "", pinnedNormenBlock: "" }` — early return before any DB call |
| 11 | When a pinned norm's law_chunk is not found, that norm is silently skipped | VERIFIED | Line 386: `if (!chunk) return;` null guard inside forEach |
| 12 | A 'Verknuepfte Normen' section is visible in the Akte detail page between stats row and AkteDetailTabs | VERIFIED | `<NormenSection>` at page.tsx:131-134, positioned after stats grid (line 97-128) and before `<AkteDetailTabs>` (line 137) |
| 13 | Clicking 'Norm hinzufuegen' opens search modal with live results from normen/search | VERIFIED | `fetch(\`/api/akten/${akteId}/normen/search?q=...\`)` in 300ms debounced useEffect (normen-section.tsx:68) |
| 14 | Adding a norm POSTs and chip appears after router.refresh() | VERIFIED | `fetch(..., { method: "POST" })` in handleAdd (line 95-103), `router.refresh()` on success (line 112) |
| 15 | Clicking X removes norm and chip disappears after router.refresh() | VERIFIED | `fetch(..., { method: "DELETE" })` in handleRemove (line 123-125), `router.refresh()` on success (line 130) |
| 16 | Empty state shows correct message when no norms pinned | VERIFIED | `initialNormen.length === 0` branch renders `<p>Noch keine Normen verknuepft. Normen fliessen automatisch in Helenas Kontext ein.</p>` (normen-section.tsx:188-191) |

**Score:** 16/16 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/akten/[id]/normen/route.ts` | GET (list) + POST (add) for AkteNorm | VERIFIED | 113 lines, exports GET + POST, full Prisma implementation |
| `src/app/api/akten/[id]/normen/search/route.ts` | ILIKE text search on law_chunks for add-norm modal | VERIFIED | 47 lines, exports GET, prisma.$queryRaw with ILIKE + LIMIT 20 |
| `src/app/api/akten/[id]/normen/[normId]/route.ts` | DELETE for removing a pinned norm | VERIFIED | 45 lines, exports DELETE, prisma.akteNorm.delete + 204 response |
| `src/app/api/ki-chat/route.ts` | Extended Chain A with pinned norms injection | VERIFIED | Contains "PINNED NORMEN" (lines 383, 399), `akteNorm.findMany` (line 365), `lawChunk.findFirst` (line 373), Promise.all injection |
| `src/components/akten/normen-section.tsx` | NormenSection client component | VERIFIED | 404 lines, exports NormenSection, chip list + Radix Dialog modal + Sheet detail panel |
| `src/app/(dashboard)/akten/[id]/page.tsx` | Akte detail page with normen Prisma include + NormenSection rendered | VERIFIED | Import at line 15, normen include at line 53, NormenSection JSX at line 131-134 |
| `src/lib/audit.ts` | NORM_VERKNUEPFT + NORM_ENTFERNT in AuditAktion union | VERIFIED | Lines 63-64: union types; lines 130-131: AKTION_LABELS entries |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| normen/route.ts | prisma.akteNorm | findMany / create | VERIFIED | `prisma.akteNorm.findMany` (GET), `prisma.akteNorm.create` (POST) — both substantive, not stubs |
| normen/search/route.ts | law_chunks | prisma.$queryRaw ILIKE | VERIFIED | `prisma.$queryRaw` with safe template-literal interpolation on law_chunks table |
| normen/[normId]/route.ts | prisma.akteNorm | delete | VERIFIED | `prisma.akteNorm.delete({ where: { id: normId } })` with prior findUnique ownership check |
| ki-chat/route.ts | prisma.akteNorm.findMany | Chain A closure parallel | VERIFIED | `akteNorm.findMany` called inside akteContextPromise IIFE (line 365) |
| ki-chat/route.ts | prisma.lawChunk.findFirst | Promise.all per pinned norm | VERIFIED | `Promise.all(pinnedNormen.map((norm) => prisma.lawChunk.findFirst(...)))` (lines 371-381) |
| normen-section.tsx | /api/akten/[id]/normen/search | fetch in useEffect debounce 300ms | VERIFIED | `fetch(\`/api/akten/${akteId}/normen/search?q=...\`)` inside `setTimeout(..., 300)` in useEffect |
| normen-section.tsx | /api/akten/[id]/normen | fetch POST / DELETE | VERIFIED | `method: "POST"` in handleAdd (line 96); `method: "DELETE"` in handleRemove (line 123) |
| page.tsx | normen-section.tsx | import + render with akteId + initialNormen | VERIFIED | Import: line 15; JSX: `<NormenSection akteId={id} initialNormen={serializedAkte.normen ?? []} />` (lines 131-134) |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GESETZ-04 | 15-01, 15-02, 15-03 | Nutzer kann §§ strukturiert an Akte verknuepfen — Suchmodal ueber law_chunks, Hinzufuegen mit optionaler Notiz, Anzeige als Chip-Liste in Akte-Detailseite; pinned Normen werden in Helenas System-Kontext fuer die Akte injiziert | SATISFIED | All four sub-requirements confirmed: search modal exists (NormenSection search), optional Anmerkung field present, chip list renders with gesetzKuerzel+paragraphNr, ki-chat Chain A injects PINNED NORMEN block. Requirements.md marks it Complete at Phase 15. |

No orphaned requirements found. All Phase 15 requirement IDs declared across plans are accounted for.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| normen-section.tsx | 265, 327, 329 | `placeholder=` attribute on input/textarea | Info | Legitimate HTML input placeholder text (UI hint for user). Not a code stub. |

No blocker or warning-level anti-patterns found in any phase file.

---

### Human Verification Required

#### 1. NormenSection visual placement

**Test:** Navigate to any Akte detail page (e.g. `/akten/[id]`) in the browser.
**Expected:** A 'Verknuepfte Normen' glass-card section appears between the stats KPI row and the AkteDetailTabs component.
**Why human:** CSS layout, glass-card rendering, and visual positioning cannot be verified programmatically.

#### 2. Add norm full flow

**Test:** Click 'Norm hinzufuegen', type 'BGB' in the search field (min 2 chars triggers 300ms debounce), select a result, optionally enter an Anmerkung, click 'Hinzufuegen'.
**Expected:** Modal closes, toast.success fires, chip appears with the gesetzKuerzel + paragraphNr label and optional truncated Anmerkung.
**Why human:** Browser interaction, debounce timing, toast rendering, and router.refresh() re-render require live browser.

#### 3. Remove norm flow

**Test:** Click the X button on an existing norm chip.
**Expected:** DELETE 204 returned, toast 'Norm entfernt', chip disappears from the list.
**Why human:** Requires live browser interaction.

#### 4. Chip detail sheet

**Test:** Click the chip label (e.g. 'BGB § 242').
**Expected:** Sheet side panel slides in from the right showing the full paragraph text in a `<pre>` block, a 'nicht amtlich' disclaimer with the sync date, and an external link to the source if available.
**Why human:** Sheet animation and rendered content require browser.

#### 5. Helena system prompt injection at runtime

**Test:** With the application running, select an Akte that has at least one pinned norm, then send a chat message to Helena. Check server logs for `[ki-chat] Chain A (Akte context + pinned normen) took Xms (N pinned norms)` where N > 0.
**Expected:** System prompt contains `--- PINNED NORMEN (Akte [aktenzeichen] --- hoechste Prioritaet) ---` block before `--- QUELLEN ---`.
**Why human:** Runtime system prompt content requires log inspection on a live server with DB data.

---

### Gaps Summary

No gaps. All 16 observable truths verified, all 7 artifacts exist and are substantively implemented, all 8 key links confirmed wired. GESETZ-04 is fully satisfied.

---

## Commit Verification

All task commits from SUMMARY files confirmed present in git log:

| Commit | Plan | Description |
|--------|------|-------------|
| b0fe1c1 | 15-01 Task 1 | feat(15-01): add GET+POST handlers for AkteNorm list and pin |
| 1452c68 | 15-01 Task 2 | feat(15-01): add norm search + delete route handlers |
| 3bb3b14 | 15-02 Task 1 | feat(15-02): extend Chain A to inject pinned normen into ki-chat system prompt |
| 748d182 | 15-03 Task 1 | feat(15-03): build NormenSection client component |
| 95b0b05 | 15-03 Task 2 | feat(15-03): wire NormenSection into Akte detail page |

---

_Verified: 2026-02-27T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
