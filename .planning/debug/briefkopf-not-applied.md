---
status: awaiting_human_verify
trigger: "briefkopf-not-applied: Standardbriefkopf configured but not applied when creating documents. Also missing Anwaelte field and Ordner-Schemata not editable."
created: 2026-02-27T12:00:00Z
updated: 2026-02-27T12:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - All 4 issues fixed, TypeScript compiles cleanly
test: User needs to verify in browser
expecting: Briefkopf applied to documents, anwaelte field visible in editor, Ordner-Schemata editable
next_action: Awaiting human verification

## Symptoms

expected: When a Standardbriefkopf is configured, it should be used when generating documents/Schriftsaetze
actual: Briefkopf is configured and saved (visible in settings with "Standard" badge) but not applied anywhere
errors: No error messages
reproduction: Configure a briefkopf in Einstellungen > Briefkoepfe, mark as Standard, then create/view a document - no briefkopf appears
started: Feature exists in UI but may never have been fully wired up

## Eliminated

## Evidence

- timestamp: 2026-02-27T12:00:30Z
  checked: Prisma schema for Briefkopf model
  found: Model has all fields (kanzleiName, adresse, etc.) but NO anwaelte field for listing lawyers
  implication: BRAO compliance issue - need to add anwaelte field to schema and editor

- timestamp: 2026-02-27T12:00:35Z
  checked: /api/briefkopf/route.ts (POST) and /api/briefkopf/[id]/route.ts (PUT)
  found: API correctly saves briefkopf data and auto-generates DOCX via generateBriefkopfDocx()
  implication: Data storage works fine - issue is on the consumption side

- timestamp: 2026-02-27T12:00:40Z
  checked: /api/vorlagen/[id]/generieren/route.ts (the Vorlagen wizard API)
  found: This route DOES apply briefkopf correctly (lines 188-216) - loads by ID or default, fetches DOCX from MinIO, calls applyBriefkopfToDocx()
  implication: The Vorlagen wizard flow works correctly for briefkopf

- timestamp: 2026-02-27T12:00:45Z
  checked: /api/akten/[id]/dokumente/aus-vorlage/route.ts (the VorlageErstellenDialog API)
  found: This route does NOT apply briefkopf at all - fills template but skips briefkopf step entirely
  implication: PRIMARY BUG - the Akte document tab's "aus Vorlage" flow never applies briefkopf

- timestamp: 2026-02-27T12:00:50Z
  checked: /api/akten/[id]/dokumente/neu/route.ts (blank document creation)
  found: Creates blank DOCX via createBlankDocx() with NO briefkopf applied
  implication: Blank documents also lack briefkopf

- timestamp: 2026-02-27T12:00:55Z
  checked: ordner-schemata-tab.tsx component
  found: Component has editingSchema state (line 65) and Pencil import (line 14) but NO edit button rendered. API has PATCH endpoint that supports editing. Edit UI is completely missing.
  implication: Ordner-Schemata cannot be edited because the edit button/form was never implemented

- timestamp: 2026-02-27T12:01:00Z
  checked: briefkopf-editor.tsx form fields
  found: No anwaelte/lawyers field in BriefkopfData interface or form. Only braoInfo field exists for regulatory text.
  implication: Lawyers listing required by BRAO/BORA is missing from data model and UI

- timestamp: 2026-02-27T12:05:00Z
  checked: TypeScript compilation after all fixes
  found: npx tsc --noEmit passes with zero errors
  implication: All fixes are type-safe and consistent

## Resolution

root_cause: |
  4 distinct issues found:
  1. PRIMARY: /api/akten/[id]/dokumente/aus-vorlage/route.ts does NOT call applyBriefkopfToDocx() - the most common document creation flow from the Akte documents tab completely skips briefkopf application
  2. /api/akten/[id]/dokumente/neu/route.ts (blank doc) also does not apply briefkopf
  3. Briefkopf model and editor missing "anwaelte" field (String[] for lawyer names) - legally required by German BRAO/BORA
  4. Ordner-Schemata tab: edit button and edit form never implemented despite API support and state variable being declared

fix: |
  7 changes applied:
  1. Added applyBriefkopfToDocx() call to /api/akten/[id]/dokumente/aus-vorlage/route.ts - loads default briefkopf, applies header/footer to filled template
  2. Added applyBriefkopfToDocx() call to /api/akten/[id]/dokumente/neu/route.ts - applies default briefkopf to blank documents
  3. Added "anwaelte String[]" field to Prisma Briefkopf model + migration
  4. Updated BriefkopfData interface in src/lib/briefkopf.ts to include anwaelte
  5. Updated generateBriefkopfDocx() to render anwaelte in DOCX header after kanzleiName
  6. Updated briefkopf-editor.tsx with anwaelte management UI (add/remove lawyers, preview)
  7. Added edit button + edit dialog to ordner-schemata-tab.tsx (wired up existing PATCH API)

verification: TypeScript compiles with zero errors (npx tsc --noEmit)

files_changed:
  - prisma/schema.prisma (added anwaelte field to Briefkopf model)
  - prisma/migrations/20260227160000_add_anwaelte_to_briefkopf/migration.sql
  - src/lib/briefkopf.ts (BriefkopfData type + DOCX generation for anwaelte)
  - src/app/api/briefkopf/route.ts (parse anwaelte in POST)
  - src/app/api/briefkopf/[id]/route.ts (parse anwaelte in PUT + mergedFields)
  - src/components/briefkopf/briefkopf-editor.tsx (anwaelte UI field + preview)
  - src/app/api/akten/[id]/dokumente/aus-vorlage/route.ts (apply briefkopf to template docs)
  - src/app/api/akten/[id]/dokumente/neu/route.ts (apply briefkopf to blank docs)
  - src/components/einstellungen/ordner-schemata-tab.tsx (edit button + edit dialog)
