---
phase: 02-deadline-calculation-document-templates
plan: 02
subsystem: api, ui, database
tags: [prisma, fristen, kalender, pdf-lib, bullmq, shadcn-sheet, warn-ampel, tagesuebersicht, fristenrechner]

# Dependency graph
requires:
  - phase: 02-deadline-calculation-document-templates
    provides: "FristenRechner pure-function library (berechneFrist, berechneVorfristen, berechneHalbfrist, DEFAULT_FRISTEN_PRESETS)"
  - phase: 01-infrastructure-foundation
    provides: "BullMQ worker, Socket.IO notifications, notification service"
provides:
  - "Enhanced KalenderEintrag schema with Frist fields, FristPrioritaet enum, FristPreset model"
  - "Fristen Rechner API endpoint with Sonderfaelle (Oeffentliche Zustellung, Auslandszustellung EU)"
  - "Fristen Presets CRUD API with auto-seed from library defaults"
  - "Fristenzettel PDF generation (daily overview + per-Akte formats)"
  - "Fristverlaengerung workflow with history preservation"
  - "Mandatory Erledigungsgrund for Frist completion"
  - "FristenRechner sidebar Sheet UI (Cmd+Shift+F + Cmd+K integration)"
  - "Tagesuebersicht dashboard widget (Fristen/WV/Termine)"
  - "FristenAmpel color-coded deadline indicator component"
  - "Auto-Wiedervorlage on document upload to Akte"
  - "Keine-Akte-ohne-Frist/WV validation warning"
  - "BullMQ frist-reminder worker with halbfrist support"
affects: [03-email-client, 05-financial-module, 06-ai-features]

# Tech tracking
tech-stack:
  added: [pdf-lib]
  patterns: [frist-sonderfall-api-pattern, sheet-command-palette-bridge, ampel-color-coding, auto-wiedervorlage-hook, erledigungsgrund-mandatory-pattern]

key-files:
  created:
    - src/app/api/fristen/rechner/route.ts
    - src/app/api/fristen/presets/route.ts
    - src/app/api/fristen/fristenzettel/route.ts
    - src/app/api/kalender/[id]/verlaengerung/route.ts
    - src/lib/queues.ts
    - src/components/ui/sheet.tsx
    - src/components/fristen/fristen-ampel.tsx
    - src/components/fristen/fristenrechner-form.tsx
    - src/components/fristen/fristenrechner-ergebnis.tsx
    - src/components/fristen/fristenrechner-sheet.tsx
    - src/components/fristen/tagesuebersicht.tsx
    - src/components/layout/command-fristenrechner-wrapper.tsx
  modified:
    - prisma/schema.prisma
    - src/app/api/kalender/route.ts
    - src/app/api/kalender/[id]/erledigt/route.ts
    - src/app/api/akten/route.ts
    - src/app/api/akten/[id]/route.ts
    - src/app/api/akten/[id]/dokumente/route.ts
    - src/workers/processors/frist-reminder.ts
    - src/components/kalender/kalender-eintrag-dialog.tsx
    - src/components/layout/command-palette.tsx
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/dashboard/page.tsx

key-decisions:
  - "pdf-lib for Fristenzettel PDF generation (lightweight, no native deps, A4 landscape layout)"
  - "Sheet component bridge pattern: CommandFristenRechnerWrapper client component connects server-rendered CommandPalette with FristenRechnerSheet"
  - "Sonderfaelle as nullable string field on KalenderEintrag (OEFFENTLICHE_ZUSTELLUNG | AUSLANDSZUSTELLUNG_EU | null)"
  - "FristHistorie stored as Json field for Verlaengerung audit trail"
  - "Auto-Wiedervorlage on document upload with DRINGEND priority and next-business-day date"
  - "Mandatory erledigungsgrund for FRIST entries, plus ueberschreitungsgrund for overdue"
  - "Warn-Ampel colors: emerald >7d, amber 3-7d, rose <3d, slate-900 overdue, slate-400 erledigt"

patterns-established:
  - "Sonderfall API pattern: nullable sonderfall field adjusts Fristbeginn before standard calculation"
  - "Sheet-Command-Palette bridge: client wrapper component mediates between Command Palette and Sheet sidebar"
  - "Ampel color-coding pattern: differenceInDays thresholds with consistent emerald/amber/rose/slate palette"
  - "Auto-hook pattern: document upload triggers automatic Wiedervorlage creation"
  - "Erledigungsgrund mandatory pattern: certain calendar entry types require reason when completed"
  - "Fristenzettel PDF pattern: pdf-lib A4 landscape with colored Ampel circles and table layout"

requirements-completed: [REQ-FK-003, REQ-FK-004, REQ-FK-005]

# Metrics
duration: 15min
completed: 2026-02-24
---

# Phase 02 Plan 02: FristenRechner UI + API + Tagesuebersicht Summary

**Full Fristen management stack: Prisma schema enhancements (FristPrioritaet, FristPreset, 20+ KalenderEintrag fields), Fristen API with Sonderfaelle, FristenRechner sidebar Sheet (Cmd+Shift+F), Tagesuebersicht dashboard widget with Warn-Ampel, Fristenzettel PDF generation, mandatory Erledigungsgrund, Fristverlaengerung with history, Auto-Wiedervorlage on document upload, and BullMQ reminder worker with halbfrist support.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-24T10:46:08Z
- **Completed:** 2026-02-24T11:01:08Z
- **Tasks:** 2
- **Files modified:** 31

## Accomplishments
- Enhanced Prisma schema with FristPrioritaet enum (5 levels), FristPreset model, and 20+ new fields on KalenderEintrag including self-relation for Hauptfrist/Vorfrist, Sonderfaelle, and fristHistorie Json
- Built complete Fristen API surface: rechner endpoint (with Oeffentliche Zustellung/Auslandszustellung support), presets CRUD (auto-seeded), fristenzettel PDF (daily/per-Akte), verlaengerung (history preservation), enhanced erledigt (mandatory reason)
- Created FristenRechner sidebar Sheet (600px) with form supporting presets, direction toggle, Sonderfaelle, Notfrist, Bundesland selector, and result display with Ampel + Vorfristen + localStorage history
- Built Tagesuebersicht dashboard widget showing today's Fristen (with Ampel), Wiedervorlagen, and Termine with quick actions (Erledigen with dialog, Akte oeffnen, Fristenzettel drucken)
- Implemented Auto-Wiedervorlage on document upload and Keine-Akte-ohne-Frist/WV validation warning
- Enhanced BullMQ frist-reminder worker with halbfrist check support

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema Enhancements + Fristen API + Presets CRUD + Fristenzettel + Reminder Worker** - `d70ba7f` (feat)
2. **Task 2: FristenRechner UI + Tagesuebersicht + Warn-Ampel Components** - `6f4d707` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

**Created:**
- `src/app/api/fristen/rechner/route.ts` - POST endpoint for deadline calculation with Sonderfaelle, preset loading, forward/backward mode
- `src/app/api/fristen/presets/route.ts` - CRUD for Fristen presets, auto-seeds defaults on first GET
- `src/app/api/fristen/fristenzettel/route.ts` - GET endpoint generating A4 landscape PDF with Ampel circles, table layout, daily/akte formats
- `src/app/api/kalender/[id]/verlaengerung/route.ts` - POST for deadline extension, preserves history in fristHistorie, recalculates Vorfristen
- `src/lib/queues.ts` - BullMQ queue definitions with frist-reminder queue and repeatable job registration
- `src/components/ui/sheet.tsx` - shadcn Sheet component using @radix-ui/react-dialog with slide animations
- `src/components/fristen/fristen-ampel.tsx` - Color-coded deadline indicator (emerald/amber/rose/slate-900)
- `src/components/fristen/fristenrechner-form.tsx` - Full form with direction toggle, presets, date picker, duration, Bundesland, Section 193, Notfrist, Sonderfaelle, Fristenzettel print
- `src/components/fristen/fristenrechner-ergebnis.tsx` - Result display with Ampel, shift reasons, Vorfristen, Halbfrist, save/history buttons, localStorage history
- `src/components/fristen/fristenrechner-sheet.tsx` - Sheet wrapper with useFristenRechnerShortcut hook (Cmd+Shift+F)
- `src/components/fristen/tagesuebersicht.tsx` - Dashboard widget with 3 sections, Erledigungsgrund dialog, quick actions, Fristenzettel button
- `src/components/layout/command-fristenrechner-wrapper.tsx` - Client bridge between CommandPalette and FristenRechnerSheet

**Modified:**
- `prisma/schema.prisma` - Added FristPrioritaet enum, FristPreset model, 20+ new KalenderEintrag fields, indexes, User relations
- `src/app/api/kalender/route.ts` - Enhanced POST/GET with all new Frist fields, auto-creates child Vorfrist entries
- `src/app/api/kalender/[id]/erledigt/route.ts` - Mandatory erledigungsgrund for FRIST entries, ueberschreitungsgrund for overdue
- `src/app/api/akten/route.ts` - Added Keine-Akte-ohne-Frist/WV warning in POST response
- `src/app/api/akten/[id]/route.ts` - Added same warning in PATCH response
- `src/app/api/akten/[id]/dokumente/route.ts` - Auto-Wiedervorlage creation on document upload (DRINGEND, next business day)
- `src/workers/processors/frist-reminder.ts` - Added halbfrist date check in reminder loop
- `src/components/kalender/kalender-eintrag-dialog.tsx` - Added FristenRechner tip when typ=FRIST selected
- `src/components/layout/command-palette.tsx` - Added "Frist berechnen" action, onFristenRechner callback, __fristenrechner__ href handling
- `src/app/(dashboard)/layout.tsx` - Replaced CommandPalette with CommandFristenRechnerWrapper
- `src/app/(dashboard)/dashboard/page.tsx` - Added Tagesuebersicht widget prominently before content grid

## Decisions Made
- **pdf-lib for PDF generation:** Lightweight, no native dependencies, supports A4 landscape with colored circles for Ampel visualization
- **Sheet-Command-Palette bridge pattern:** Created CommandFristenRechnerWrapper client component to connect server-rendered layout (CommandPalette) with client-side FristenRechnerSheet, avoiding prop drilling through server components
- **Sonderfaelle as nullable string:** Stored on KalenderEintrag as nullable string rather than separate enum, keeping schema simple while supporting Oeffentliche Zustellung and Auslandszustellung EU
- **FristHistorie as Json field:** Verlaengerung history stored as Json on KalenderEintrag for flexible audit trail without a separate table
- **Auto-Wiedervorlage with DRINGEND priority:** When documents are added to an Akte, automatic Wiedervorlage created with highest urgency to ensure attorney reviews the new document
- **Warn-Ampel color coding:** Consistent with design system risk colors (emerald/amber/rose) plus slate-900 for overdue (black/schwarz per user specification)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing pdf-lib dependency**
- **Found during:** Task 1 (Fristenzettel PDF endpoint)
- **Issue:** pdf-lib package not in package.json, import would fail
- **Fix:** Ran `npm install pdf-lib`
- **Files modified:** package.json, package-lock.json
- **Verification:** Import succeeds, TypeScript compiles
- **Committed in:** d70ba7f (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Uint8Array type incompatibility in Fristenzettel response**
- **Found during:** Task 1 (Fristenzettel PDF endpoint)
- **Issue:** `Uint8Array<ArrayBufferLike>` not assignable to `BodyInit | null | undefined` when passing pdf-lib output to NextResponse
- **Fix:** Wrapped with `Buffer.from(pdfBytes)` to convert to Node.js Buffer compatible with BodyInit
- **Files modified:** src/app/api/fristen/fristenzettel/route.ts
- **Verification:** TypeScript compiles, no type errors
- **Committed in:** d70ba7f (Task 1 commit)

**3. [Rule 3 - Blocking] Created missing shadcn Sheet component**
- **Found during:** Task 2 (FristenRechner Sheet)
- **Issue:** shadcn/ui Sheet component not available in project, needed for sidebar sheet
- **Fix:** Created src/components/ui/sheet.tsx manually using existing @radix-ui/react-dialog dependency with slide animations
- **Files modified:** src/components/ui/sheet.tsx (created)
- **Verification:** Component imports correctly, renders as expected
- **Committed in:** 6f4d707 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug fix, 2 blocking issues)
**Impact on plan:** All auto-fixes necessary for correctness and build success. No scope creep.

## Deferred Issues

- **Pre-existing build failure in ordner-schemata route:** `src/app/api/ordner-schemata/route.ts` exports a non-route function `getDefaultOrdnerForSachgebiet`, causing Next.js build to fail. Not caused by this plan's changes. Logged for future fix.

## Issues Encountered
- Prisma schema file was auto-formatted by linter between read and edit operations, causing "File has been modified since read" errors. Required re-reading the file before each edit attempt (happened 3 times).
- Git commit with heredoc syntax failed due to quoting issue. Resolved by using regular multi-line string with double quotes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- FristenRechner UI fully operational -- attorneys can calculate deadlines from anywhere (Cmd+K, Cmd+Shift+F)
- Tagesuebersicht provides morning overview of all due items
- All Fristen API endpoints ready for consumption by future phases (email integration, AI deadline recognition)
- BullMQ reminder worker registered and ready for production scheduling
- Fristenzettel PDF available for court preparation

## Self-Check: PASSED

All 23 key files verified present. Both task commits (d70ba7f, 6f4d707) confirmed in git log. SUMMARY.md created successfully.

---
*Phase: 02-deadline-calculation-document-templates*
*Completed: 2026-02-24*
