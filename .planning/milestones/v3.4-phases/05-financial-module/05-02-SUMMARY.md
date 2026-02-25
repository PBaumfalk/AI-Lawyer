---
phase: 05-financial-module
plan: 02
subsystem: finance
tags: [invoice, nummernkreis, status-machine, pdf-lib, rvg, prisma, api, ustg, storno, mahnung]

# Dependency graph
requires:
  - phase: 05-01
    provides: "RVG/GKG fee calculator library with builder pattern"
  - phase: 02-04
    provides: "Briefkopf model, template engine, PDF conversion"
  - phase: 01-infrastructure-foundation
    provides: "Prisma schema, MinIO storage, auth, audit logging"
provides:
  - "11 new Prisma financial models (Nummernkreis, Teilzahlung, Mahnung, BankKonto, BankTransaktion, RvgBerechnung, Buchungsperiode, Kostenstelle, Taetigkeitskategorie, RecurringInvoiceTemplate, FinanzEinstellung)"
  - "Expanded Rechnung model with SS 14 UStG fields, empfaenger, Storno/Korrektur refs"
  - "Expanded AktenKontoBuchung with Storno chain, Kostenstelle, Fremdgeld tracking"
  - "Expanded Zeiterfassung with timer fields and billing link"
  - "Atomic Nummernkreis via PostgreSQL UPSERT (gap-free, concurrent-safe)"
  - "Invoice status machine: ENTWURF->GESTELLT->BEZAHLT/STORNIERT/MAHNUNG with side effects"
  - "Invoice PDF generator with firm Briefkopf, position table, USt breakdown, SS 14 UStG footer"
  - "Invoice CRUD API (GET list/detail, POST create, PATCH edit/transition, DELETE)"
  - "Invoice PDF download endpoint with MinIO storage"
  - "RVG calculation API with optional save and one-click invoice transfer"
  - "RVG per-Akte API (list saved, save new) with uebernehmenAlsRechnung helper"
affects: [05-03, 05-04, 05-05, 05-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic sequence generation via PostgreSQL UPSERT with RETURNING"
    - "Status machine with side-effect execution per transition"
    - "Invoice PDF generation with pdf-lib (A4, DIN 5008, three-column footer)"
    - "Dual PATCH mode: edit (ENTWURF only) vs status transition (action field)"
    - "Per-rate USt breakdown calculation from positionen"
    - "One-click RVG-to-invoice transfer via uebernehmenAlsRechnung response field"

key-files:
  created:
    - src/lib/finance/invoice/types.ts
    - src/lib/finance/invoice/nummernkreis.ts
    - src/lib/finance/invoice/status-machine.ts
    - src/lib/finance/invoice/pdf-generator.ts
    - src/lib/finance/invoice/__tests__/invoice.test.ts
    - src/app/api/finanzen/rechnungen/route.ts
    - src/app/api/finanzen/rechnungen/[id]/route.ts
    - src/app/api/finanzen/rechnungen/[id]/pdf/route.ts
    - src/app/api/finanzen/rvg/route.ts
    - src/app/api/finanzen/rvg/[akteId]/route.ts
  modified:
    - prisma/schema.prisma
    - src/lib/audit.ts

key-decisions:
  - "Atomic Nummernkreis via PostgreSQL UPSERT: INSERT ON CONFLICT DO UPDATE SET sequence=sequence+1 RETURNING sequence - gap-free and concurrent-safe in a single statement"
  - "Status machine side effects per transition: GESTELLT locks date and calculates faelligAm, STORNIERT creates separate Stornorechnung with GS-number, MAHNUNG creates Mahnung record and advances MahnStufe"
  - "Dual PATCH mode on invoice detail: action field triggers status transition, otherwise edit mode (ENTWURF only)"
  - "Per-rate USt breakdown calculated from positionen at creation and recalculated on edit - supports mixed rates"
  - "RVG uebernehmenAlsRechnung: response includes pre-filled invoice data ready for POST to /rechnungen"
  - "Buffer to Uint8Array conversion for NextResponse compatibility with pdf-lib output"

patterns-established:
  - "Atomic sequence via UPSERT: reusable pattern for any gap-free numbered series"
  - "Status machine with side effects: transition validation + side effect execution + audit log in one transaction"
  - "Invoice PDF layout: A4, DIN 5008 window, three-column footer (Kanzlei/Tax/Bank)"
  - "Dual PATCH endpoint: action-based mode switching for status transitions vs field edits"

requirements-completed: [REQ-FI-003, REQ-FI-004]

# Metrics
duration: 9min
completed: 2026-02-24
---

# Phase 05 Plan 02: Invoice System Backend + RVG API Summary

**Atomic Nummernkreis via PostgreSQL UPSERT, invoice status machine with Storno/Mahnung side effects, pdf-lib PDF generator with SS 14 UStG compliance, and RVG-to-invoice one-click transfer API**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-24T20:35:25Z
- **Completed:** 2026-02-24T20:44:25Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Expanded Prisma schema with 11 new financial models plus significant expansions to Rechnung, AktenKontoBuchung, Zeiterfassung, and Kanzlei
- Built atomic gap-free Nummernkreis using PostgreSQL UPSERT with configurable format patterns
- Implemented invoice status machine enforcing ENTWURF->GESTELLT->BEZAHLT/STORNIERT/MAHNUNG flow with audit-logged side effects
- Built PDF generator producing professional invoices with firm Briefkopf, itemized position table, per-rate USt breakdown, and SS 14 UStG footer
- Created full invoice CRUD API with pagination, filters, summary stats, and dual-mode PATCH (edit vs status transition)
- Built RVG calculation API with per-Akte save and one-click transfer to invoice creation
- 29 passing tests covering Nummernkreis formatting, status transition validation, and PDF generation

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma Schema + Invoice Backend Library + Tests** - `01f93f4` (feat)
2. **Task 2: Invoice + RVG API Routes** - `cbbd1a3` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - 11 new models (Nummernkreis, Teilzahlung, Mahnung, BankKonto, BankTransaktion, RvgBerechnung, Buchungsperiode, Kostenstelle, Taetigkeitskategorie, RecurringInvoiceTemplate, FinanzEinstellung), 3 enums, expanded Rechnung/AktenKontoBuchung/Zeiterfassung/Kanzlei
- `src/lib/audit.ts` - Added financial audit action types (RECHNUNG_ERSTELLT, RECHNUNG_BEARBEITET, RECHNUNG_STATUS_GEAENDERT, RECHNUNG_GELOESCHT, RVG_BERECHNUNG_GESPEICHERT)
- `src/lib/finance/invoice/types.ts` - TypeScript types for invoice positions, USt summary, status transitions, PDF data
- `src/lib/finance/invoice/nummernkreis.ts` - Atomic invoice number generator via PostgreSQL UPSERT with configurable patterns
- `src/lib/finance/invoice/status-machine.ts` - Status flow engine with transition validation, side effects, and audit logging
- `src/lib/finance/invoice/pdf-generator.ts` - pdf-lib PDF generation with A4 layout, DIN 5008 window, position table, totals, and three-column footer
- `src/lib/finance/invoice/__tests__/invoice.test.ts` - 29 tests for Nummernkreis, status machine, and PDF generator
- `src/app/api/finanzen/rechnungen/route.ts` - Invoice list GET (filters, pagination, stats) + create POST (atomic number, Zod validation)
- `src/app/api/finanzen/rechnungen/[id]/route.ts` - Invoice detail GET + dual-mode PATCH (edit/transition) + DELETE (ENTWURF only)
- `src/app/api/finanzen/rechnungen/[id]/pdf/route.ts` - PDF download GET with MinIO upload
- `src/app/api/finanzen/rvg/route.ts` - RVG calculation POST with optional save
- `src/app/api/finanzen/rvg/[akteId]/route.ts` - Per-Akte RVG list GET + save POST with uebernehmenAlsRechnung

## Decisions Made
- **Atomic Nummernkreis via PostgreSQL UPSERT**: Single SQL statement (INSERT ON CONFLICT DO UPDATE RETURNING) guarantees no duplicate numbers under concurrent access. Each prefix+year combination has its own sequence counter.
- **Status machine side effects in transaction**: Each transition executes side effects within the same Prisma transaction - GESTELLT locks the date and calculates faelligAm, STORNIERT creates a separate Stornorechnung with its own GS-number, MAHNUNG creates a Mahnung record and advances the MahnStufe.
- **Dual PATCH mode**: The `action` field presence triggers status transition mode, otherwise the endpoint operates in edit mode (restricted to ENTWURF status). This avoids needing separate endpoints for edit vs transition.
- **Per-rate USt breakdown**: Positionen with different USt rates are grouped and summarized independently, supporting mixed-rate invoices per SS 14 UStG requirements.
- **RVG one-click transfer**: The `uebernehmenAlsRechnung` response field provides pre-filled invoice data that can be directly POSTed to /api/finanzen/rechnungen, enabling seamless RVG-to-invoice workflow.
- **Buffer to Uint8Array for NextResponse**: pdf-lib returns Buffer but NextResponse requires Uint8Array-compatible BodyInit - explicit conversion with `new Uint8Array(buffer)` resolves the type mismatch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error in nummernkreis.ts $queryRawUnsafe type parameter**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** `(tx as any).$queryRawUnsafe<Array<...>>()` - generic type parameter on `any`-typed call is not allowed by TypeScript
- **Fix:** Changed to explicit return type annotation: `const result: Array<{ sequence: number }> = await (tx as any).$queryRawUnsafe(...)`
- **Files modified:** src/lib/finance/invoice/nummernkreis.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 01f93f4

**2. [Rule 1 - Bug] Fixed missing logAuditEvent import in invoice detail route**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** `logAuditEvent` used in PATCH and DELETE handlers but not imported
- **Fix:** Added `import { logAuditEvent } from '@/lib/audit'` to the imports
- **Files modified:** src/app/api/finanzen/rechnungen/[id]/route.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** cbbd1a3

**3. [Rule 1 - Bug] Fixed Buffer type incompatibility in PDF route NextResponse**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** `new NextResponse(pdfBuffer)` fails because Node.js Buffer is not a valid BodyInit type
- **Fix:** Wrapped with `new Uint8Array(pdfBuffer)` for NextResponse compatibility
- **Files modified:** src/app/api/finanzen/rechnungen/[id]/pdf/route.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** cbbd1a3

---

**Total deviations:** 3 auto-fixed (3 bug fixes)
**Impact on plan:** All fixes were TypeScript compilation errors caught during verification. No scope creep.

## Issues Encountered
- Prisma `$queryRawUnsafe` when called via transaction proxy (`tx as any`) does not support TypeScript generic type parameters - resolved with explicit return type annotation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Invoice system backend is complete and ready for UI integration (Plan 03)
- All API routes are typed and documented with Zod validation
- PDF generation tested and ready for production use
- RVG-to-invoice transfer pipeline ready for frontend workflow
- Schema expansion provides foundation for Plans 03-06 (Aktenkonto, E-Rechnung, DATEV/SEPA, time tracking)

## Self-Check: PASSED

All 12 created/modified files verified present. Both task commits (01f93f4, cbbd1a3) verified in git log. 29 tests passing. TypeScript clean.

---
*Phase: 05-financial-module*
*Completed: 2026-02-24*
