---
phase: 28-falldatenblaetter-schema-templates
verified: 2026-02-28T19:30:00Z
status: human_needed
score: 12/12 must-haves verified
re_verification: true
  previous_status: gaps_found
  previous_score: 11/12
  gaps_closed:
    - "Admin can see a queue of submitted templates in the admin panel"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to /dashboard/falldaten-templates as a non-admin user and verify the template list renders with correct status badge colors"
    expected: "ENTWURF=slate, EINGEREICHT=amber, GENEHMIGT=emerald, ABGELEHNT=rose, STANDARD=blue badges visible on respective templates"
    why_human: "CSS rendering and visual badge colors cannot be verified programmatically"
  - test: "Navigate to /dashboard/falldaten-templates/neu and create a template with at least one field of each of the 8 types"
    expected: "Form accepts text, textarea, number, date, select (with options), boolean, currency, multiselect (with options); auto-generates key from label"
    why_human: "Interactive form builder behavior and UX flow require browser interaction"
  - test: "As admin, open /admin/falldaten-templates after another user has submitted a template for review"
    expected: "EINGEREICHT template from other user appears in the pending queue — fix confirmed by code inspection (ADMIN branch in GET route leaves where-clause unfiltered)"
    why_human: "Requires multi-user session state to exercise end-to-end"
---

# Phase 28: Falldatenblaetter Schema + Templates Verification Report

**Phase Goal:** Users and admins have a database-backed template system for structured case data collection, replacing the static TypeScript schema registry

**Verified:** 2026-02-28T19:30:00Z

**Status:** human_needed

**Re-verification:** Yes — after gap closure (plan 28-04, commit 07d0127)

---

## Gap Closure Summary

**Gap closed:** Truth #12 "Admin can see a queue of submitted templates in the admin panel"

**What was wrong:** `GET /api/falldaten-templates` had no admin visibility override. The WHERE clause used `OR [{status: GENEHMIGT/STANDARD}, {erstelltVonId: userId}]` for all authenticated callers, including admins. EINGEREICHT templates created by other users were invisible to admins, making the review queue non-functional for cross-user submissions.

**Fix applied (commit 07d0127):** Added `const userRole = (session.user as any).role as string;` after userId extraction (line 35), then replaced the binary `if/else` visibility block with a three-branch structure:

```typescript
if (eigene) {
  where.erstelltVonId = userId;
} else if (userRole === "ADMIN") {
  // Admins see ALL templates (needed for review queue)
  // where stays empty — no filter
} else {
  where.OR = [
    { status: { in: [FalldatenTemplateStatus.GENEHMIGT, FalldatenTemplateStatus.STANDARD] } },
    { erstelltVonId: userId },
  ];
}
```

The ADMIN branch intentionally leaves `where` empty, so `prisma.falldatenTemplate.findMany({ where: {} })` returns all records. Non-admin visibility behavior is unchanged.

**Wiring confirmed:** `src/app/(dashboard)/admin/falldaten-templates/page.tsx` fetches `/api/falldaten-templates` (line 52), receives the full template list (now including EINGEREICHT from other users when caller is ADMIN), then filters client-side with `t.status === "EINGEREICHT"` (line 61). The end-to-end wiring is now FULLY functional.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | FalldatenTemplate model exists in Prisma schema with all required fields | VERIFIED | `prisma/schema.prisma` line 2084: model with id, name, beschreibung, sachgebiet, schema (Json), version, status, erstelltVonId, geprueftVonId, geprueftAt, ablehnungsgrund, createdAt, updatedAt |
| 2 | FalldatenTemplateStatus enum has all 5 statuses | VERIFIED | Lines 301-306: ENTWURF, EINGEREICHT, GENEHMIGT, ABGELEHNT, STANDARD all present |
| 3 | Akte model has optional falldatenTemplateId FK | VERIFIED | Lines 714-715: `falldatenTemplateId String?` + relation to FalldatenTemplate |
| 4 | 10 STANDARD seed templates exist in DB after worker boot | VERIFIED | `seed-templates.ts` loops over all falldatenSchemas entries, creating one STANDARD record per Sachgebiet with idempotent version guard |
| 5 | Zod validation schemas correctly validate template creation payload with all 8 field types | VERIFIED | `validation.ts`: FALLDATEN_FELD_TYPEN includes all 8 types; falldatenFeldSchema refines select/multiselect to require optionen |
| 6 | Any authenticated user can create a new FalldatenTemplate via POST | VERIFIED | `POST /api/falldaten-templates`: auth check (any role), createTemplateSchema.safeParse, creates with status ENTWURF |
| 7 | Creator can edit/delete own template when status is ENTWURF or ABGELEHNT | VERIFIED | `PATCH /[id]/route.ts`: checks STANDARD guard, creator-only, then ENTWURF/ABGELEHNT status gate; DELETE: ENTWURF-only + Akte usage check |
| 8 | Full approval workflow: ENTWURF -> EINGEREICHT -> GENEHMIGT/ABGELEHNT -> re-edit -> EINGEREICHT | VERIFIED | einreichen (ENTWURF/ABGELEHNT -> EINGEREICHT, clears ablehnungsgrund), genehmigen (4-Augen-Prinzip + notification), ablehnen (rejectTemplateSchema + notification) |
| 9 | STANDARD templates cannot be edited, deleted, or have status changed | VERIFIED | All route handlers check `status === STANDARD` and return 403 before any mutation |
| 10 | User can see a list of their own templates and all approved/standard templates | VERIFIED | `page.tsx`: fetches `/api/falldaten-templates`, renders status badges (ENTWURF=slate, EINGEREICHT=amber, GENEHMIGT=emerald, ABGELEHNT=rose, STANDARD=blue) |
| 11 | User can create/submit template using Gruppen-first builder | VERIFIED | `template-builder.tsx` (824 lines): full group + field management, all 8 types, auto-slugify, options editor for select/multiselect |
| 12 | Admin can see a queue of submitted templates in the admin panel | VERIFIED | `GET /api/falldaten-templates` line 65: `else if (userRole === "ADMIN") {}` — empty branch leaves where-clause unfiltered; admin page line 61 filters for EINGEREICHT from the full result set |

**Score:** 12/12 truths verified

---

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `prisma/schema.prisma` | VERIFIED | FalldatenTemplateStatus enum + FalldatenTemplate model + Akte FK + User relations all present |
| `prisma/migrations/20260228181626_add_falldaten_templates/migration.sql` | VERIFIED | Creates FalldatenTemplateStatus enum, falldaten_templates table, AlterTable akten, 3 indexes, 2 FKs |
| `src/lib/falldaten/validation.ts` | VERIFIED | Exports: falldatenFeldSchema, templateSchemaSchema, createTemplateSchema, updateTemplateSchema, rejectTemplateSchema, FALLDATEN_FELD_TYPEN, FalldatenFeldTypDB |
| `src/lib/falldaten/seed-templates.ts` | VERIFIED | Exports seedFalldatenTemplates(); version guard via SystemSetting, ADMIN lookup, idempotent per-Sachgebiet loop |
| `src/worker.ts` | VERIFIED | Line 7: import, lines 957-962: try/catch call matching seedAmtlicheFormulare pattern |
| `src/app/api/falldaten-templates/route.ts` | VERIFIED | GET (3-branch visibility: eigene / ADMIN all / regular OR) + POST (Zod validation + ENTWURF creation); userRole extracted at line 35 |
| `src/app/api/falldaten-templates/[id]/route.ts` | VERIFIED | GET (visibility check) + PATCH (creator/status gated + updateTemplateSchema) + DELETE (ENTWURF-only + Akte check) |
| `src/app/api/falldaten-templates/[id]/einreichen/route.ts` | VERIFIED | POST: ENTWURF/ABGELEHNT -> EINGEREICHT, clears ablehnungsgrund, creator-only |
| `src/app/api/falldaten-templates/[id]/genehmigen/route.ts` | VERIFIED | POST: ADMIN-only, 4-Augen-Prinzip check, EINGEREICHT -> GENEHMIGT, createNotification |
| `src/app/api/falldaten-templates/[id]/ablehnen/route.ts` | VERIFIED | POST: ADMIN-only, rejectTemplateSchema, EINGEREICHT -> ABGELEHNT, createNotification |
| `src/components/falldaten-templates/template-builder.tsx` | VERIFIED | 824 lines; all 8 field types, group management, inline field editor, auto-slugify (with umlaut transliteration), options editor |
| `src/app/(dashboard)/falldaten-templates/page.tsx` | VERIFIED | Client component; fetches /api/falldaten-templates; status badges with correct colors; ownership-aware actions (ENTWURF/ABGELEHNT actions, EINGEREICHT read-only, ablehnungsgrund box) |
| `src/app/(dashboard)/falldaten-templates/neu/page.tsx` | VERIFIED | Uses TemplateBuilder; POST create then optionally POST einreichen; redirects to list |
| `src/app/(dashboard)/falldaten-templates/[id]/bearbeiten/page.tsx` | VERIFIED | Loads template via GET; guards (owner + ENTWURF/ABGELEHNT); fieldsToGroups() reconstruction; PATCH on save |
| `src/app/(dashboard)/admin/falldaten-templates/page.tsx` | VERIFIED | Fetches /api/falldaten-templates; admin now receives ALL templates (including EINGEREICHT from other users) due to fix in route.ts; client-side filter at line 61 for EINGEREICHT queue; recent decisions history section renders GENEHMIGT/ABGELEHNT |
| `src/app/(dashboard)/admin/falldaten-templates/[id]/page.tsx` | VERIFIED | Full schema preview (grouped fields, type labels, options); approve/reject actions with textarea for reason; success state + redirect |
| `src/app/(dashboard)/admin/layout.tsx` | VERIFIED | Line 13: `{ name: "Falldaten", href: "/admin/falldaten-templates" }` added |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `seed-templates.ts` | `prisma.falldatenTemplate` | findFirst + create in loop | WIRED | Lines 32, 43: both calls present |
| `seed-templates.ts` | `src/lib/falldaten-schemas.ts` | imports falldatenSchemas | WIRED | Line 3: `import { falldatenSchemas } from "@/lib/falldaten-schemas"` |
| `src/worker.ts` | `seed-templates.ts` | import + try/catch call | WIRED | Line 7 import, lines 957-962 call |
| `route.ts (list)` | `validation.ts` | imports createTemplateSchema | WIRED | Line 14: `import { createTemplateSchema } from "@/lib/falldaten/validation"` |
| `[id]/route.ts` | `validation.ts` | imports updateTemplateSchema | WIRED | Line 16: `import { updateTemplateSchema } from "@/lib/falldaten/validation"` |
| `ablehnen/route.ts` | `validation.ts` | imports rejectTemplateSchema | WIRED | Line 15: `import { rejectTemplateSchema } from "@/lib/falldaten/validation"` |
| `genehmigen/route.ts` | notification service | createNotification on approval | WIRED | Line 15 import, line 101 call to createNotification |
| `ablehnen/route.ts` | notification service | createNotification on rejection | WIRED | Line 16 import, line 94 call to createNotification |
| `neu/page.tsx` | `/api/falldaten-templates` | POST fetch | WIRED | Lines 33, 71: fetch with method POST |
| `page.tsx (list)` | `/api/falldaten-templates` | GET fetch | WIRED | Line 103: fetch("/api/falldaten-templates") |
| `admin/[id]/page.tsx` | `/api/falldaten-templates/[id]/genehmigen` | POST fetch | WIRED | Line 118: fetch with method POST |
| `admin/[id]/page.tsx` | `/api/falldaten-templates/[id]/ablehnen` | POST fetch | WIRED | Line 148: fetch with method POST |
| `admin/page.tsx` | `/api/falldaten-templates` | GET fetch — admin now receives EINGEREICHT templates from all users | WIRED | Line 52: fetch("/api/falldaten-templates"); API now returns unfiltered results for ADMIN callers (route.ts line 65 ADMIN branch) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FD-03 | 28-02, 28-03 | User can create a custom Falldatenblatt template with configurable fields | SATISFIED | POST /api/falldaten-templates + TemplateBuilder with 8 field types |
| FD-04 | 28-02, 28-03 | User can submit a custom template to Admin for review | SATISFIED | POST /[id]/einreichen transitions ENTWURF/ABGELEHNT -> EINGEREICHT; UI shows "Einreichen" button |
| FD-05 | 28-02, 28-03, 28-04 | Admin can approve or reject submitted templates | SATISFIED | genehmigen/ablehnen routes work; admin can now discover EINGEREICHT templates from all users via fixed GET list endpoint (commit 07d0127) |
| FD-06 | 28-01, 28-02, 28-03 | Approved templates appear as available Standardfaelle for all users | SATISFIED | GENEHMIGT status visible to all users in GET list; STANDARD templates seeded and also visible to all |
| FD-07 | 28-01 | Existing 10 Sachgebiet schemas migrated as seed templates (single source of truth) | SATISFIED | seed-templates.ts creates one STANDARD record per falldatenSchemas entry; wired in worker.ts |

**Orphaned requirements for Phase 28:** None — all 5 requirement IDs (FD-03 through FD-07) are accounted for in plans 28-01, 28-02, 28-03, and 28-04. REQUIREMENTS.md traceability table confirms Phase 28 covers exactly these 5 IDs.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/(dashboard)/admin/falldaten-templates/page.tsx` | 80-81 | Silent catch block on load error (`catch { }` with no error state) | Warning | If the API call fails, the queue silently shows as empty — admin has no indication of a load error. Retained from initial verification; not introduced by gap fix. |

No TODO/FIXME/placeholder comments found in any phase 28 files. No empty handler implementations. No stubs returning static data.

---

## Human Verification Required

### 1. Template list status badge colors

**Test:** Navigate to `/dashboard/falldaten-templates` as an authenticated user and verify the status badges on template cards.

**Expected:** ENTWURF shows slate/gray badge, EINGEREICHT shows amber badge, GENEHMIGT shows emerald badge, ABGELEHNT shows rose badge, STANDARD shows blue badge.

**Why human:** CSS rendering and visual color accuracy cannot be verified programmatically.

### 2. Gruppen-first builder — all 8 field types

**Test:** Navigate to `/dashboard/falldaten-templates/neu`, add groups and add one field of each type: Text, Textbereich, Zahl, Waehrung, Datum, Dropdown (with options), Checkbox, Mehrfachauswahl (with options).

**Expected:** Each field type is accepted; key is auto-slugified from label with German umlaut handling; options editor appears only for Dropdown/Mehrfachauswahl; Placeholder input appears only for text/textarea/number/currency types.

**Why human:** Interactive form builder behavior requires browser interaction.

### 3. Admin review queue cross-user visibility

**Test:** As user A (non-admin), create and submit a template. Then as user B (admin), navigate to `/admin/falldaten-templates`.

**Expected:** User A's EINGEREICHT template appears in the pending queue. The code fix (ADMIN branch in route.ts, commit 07d0127) has been verified by inspection; this human test exercises the full end-to-end flow with real session state.

**Why human:** Requires multi-user sessions to execute end-to-end; programmatic verification of the fix has been confirmed by code inspection.

---

## Re-verification Summary

**Gap closed:** 1 of 1

The single gap identified in the initial verification has been fully resolved. The fix is in `src/app/api/falldaten-templates/route.ts` at line 35 (userRole extraction) and lines 65-66 (ADMIN branch with empty where-clause). The commit `07d0127` introduced exactly the change specified in the gap's `missing` field. All 12 observable truths now pass automated verification. All 5 requirements (FD-03 through FD-07) are satisfied.

No regressions detected: all 11 previously-verified artifacts still exist and are substantive and wired. The gap-fix file (route.ts) was the only file modified by plan 28-04, and the POST handler in the same file is unchanged.

---

_Verified: 2026-02-28T19:30:00Z_

_Verifier: Claude (gsd-verifier)_

_Re-verification: Yes — initial gaps_found (11/12) -> human_needed (12/12) after plan 28-04_
