---
phase: 05-financial-module
plan: 05
subsystem: finance
tags: [datev, sepa, pain001, pain008, bank-import, csv-parser, camt053, invoice-matching, time-tracking, timer, taetigkeitskategorien, skr03, skr04, deduplication]

# Dependency graph
requires:
  - phase: 05-02
    provides: "Prisma financial models (Rechnung, BankTransaktion, Zeiterfassung, Taetigkeitskategorie), invoice status machine"
  - phase: 05-03
    provides: "Aktenkonto booking library (createBooking), append-only ledger, auto-booking bridge"
  - phase: 01-infrastructure-foundation
    provides: "Prisma schema, auth, audit logging"
provides:
  - "DATEV EXTF_ Buchungsstapel CSV generation with SKR03/SKR04 Kontenrahmen mapping"
  - "SEPA pain.001 credit transfer and pain.008 direct debit XML via sepa npm"
  - "Bank CSV import with multi-format detection (Sparkasse, VR-Bank, Deutsche Bank, Commerzbank, generic)"
  - "CAMT.053 XML parser for structured bank statements"
  - "SHA-256 based transaction deduplication"
  - "Invoice matching algorithm with confidence scoring (0.95/0.7/0.5)"
  - "Match confirmation cascading: BankTransaktion -> invoice paid/Teilzahlung -> Aktenkonto booking"
  - "Timer auto-start on Akte page mount (one active, quick-switch)"
  - "Manual time entry CRUD with filters, summary stats, default Stundensatz"
  - "Taetigkeitskategorien CRUD with auto-seeded defaults"
  - "Stundenhonorar Pflichtangabe enforcement on timer stop"
affects: [05-06]

# Tech tracking
tech-stack:
  added: ["sepa@2.1.0 (SEPA pain.001/008 XML generation)"]
  patterns:
    - "DATEV EXTF_ header format (v700, category 21, Buchungsstapel)"
    - "German number formatting with thousand dot and comma decimal"
    - "Multi-format bank CSV detection by header pattern matching"
    - "SHA-256 transaction hashing for import deduplication"
    - "Confidence-scored invoice matching: Rechnungsnr 0.95, amount 0.7, Mandant name 0.5"
    - "Match confirmation cascade: one user action triggers three domain effects"
    - "Fire-and-forget timer auto-start via client component useEffect"

key-files:
  created:
    - src/lib/finance/export/types.ts
    - src/lib/finance/export/datev.ts
    - src/lib/finance/export/sepa.ts
    - src/lib/finance/export/__tests__/datev-sepa.test.ts
    - src/app/api/finanzen/export/datev/route.ts
    - src/app/api/finanzen/export/sepa/route.ts
    - src/lib/finance/banking/types.ts
    - src/lib/finance/banking/csv-parser.ts
    - src/lib/finance/banking/camt-parser.ts
    - src/lib/finance/banking/dedup.ts
    - src/lib/finance/banking/matcher.ts
    - src/app/api/finanzen/banking/import/route.ts
    - src/app/api/finanzen/banking/match/route.ts
    - src/lib/finance/time-tracking/types.ts
    - src/lib/finance/time-tracking/timer.ts
    - src/app/api/finanzen/zeiterfassung/route.ts
    - src/app/api/finanzen/zeiterfassung/timer/route.ts
    - src/app/api/finanzen/taetigkeitskategorien/route.ts
    - src/components/akten/akte-timer-bridge.tsx
  modified:
    - src/app/(dashboard)/akten/[id]/page.tsx

key-decisions:
  - "Kontakt display name from vorname/nachname/firma fields (no 'name' field on Kontakt model) for invoice matcher"
  - "Fire-and-forget timer start via useEffect in client component -- does not block server-rendered Akte page"
  - "SHA-256 hash of date+amount+purpose+sender for transaction deduplication (deterministic, collision-resistant)"
  - "Match confidence as max of individual scores (not sum) to prevent multi-criteria inflation"
  - "Taetigkeitskategorien auto-seeded on first GET if empty (lazy initialization per Kanzlei)"
  - "Timer returns existing if same Akte already active (idempotent start)"

patterns-established:
  - "DATEV EXTF_ CSV format: BOM + header + columns + rows with semicolons and CRLF"
  - "Multi-format CSV parser: header pattern detection -> format config -> column index resolution"
  - "Cascading domain action: single user confirmation triggers bank, invoice, and Aktenkonto updates in one transaction"
  - "Auto-start bridge component: invisible client component in server-rendered page for fire-and-forget API calls"

requirements-completed: [REQ-FI-008, REQ-FI-009, REQ-FI-010, REQ-FI-011]

# Metrics
duration: 10min
completed: 2026-02-24
---

# Phase 05 Plan 05: DATEV/SEPA Export, Bank Import with Invoice Matching, and Time Tracking Summary

**DATEV Buchungsstapel CSV with EXTF_ header and SKR03/SKR04 mapping, SEPA pain.001/008 XML via sepa npm, multi-format bank CSV import with SHA-256 dedup and confidence-scored invoice matching, and per-Akte auto-timer with Stundenhonorar enforcement**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-24T20:59:27Z
- **Completed:** 2026-02-24T21:09:27Z
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments
- Built DATEV Buchungsstapel CSV export with EXTF_ header (v700, category 21), SKR03/SKR04 Kontenrahmen mapping, German number format, and BOM for Excel
- Implemented SEPA XML generation for pain.001 (credit transfer) and pain.008 (direct debit) using sepa npm package
- Created multi-format bank CSV parser with auto-detection for Sparkasse, VR-Bank, Deutsche Bank, Commerzbank, and generic formats
- Built CAMT.053 XML parser extracting Ntry elements with amount, date, purpose, sender, and IBAN
- Implemented SHA-256 deduplication preventing double-import of transactions (both cross-batch and within-batch)
- Built invoice matching algorithm with three-tier confidence scoring: Rechnungsnummer (0.95), amount (0.7), Mandant name (0.5)
- Implemented match confirmation cascade: one POST triggers BankTransaktion zugeordnet + invoice Teilzahlung/BEZAHLT + Aktenkonto EINNAHME booking
- Built timer auto-start on Akte page mount with one-active-at-a-time enforcement and quick-switch
- Implemented Stundenhonorar Pflichtangabe: timer stop requires beschreibung for hourly-billed cases
- Created Taetigkeitskategorien CRUD with lazy auto-seeded defaults (Schriftsatz, Telefonat, Besprechung, Recherche, Gericht, Reise, Sonstiges)
- 37 passing tests covering DATEV format, SKR mapping, SEPA XML structure

## Task Commits

Each task was committed atomically:

1. **Task 1a: DATEV + SEPA Export Libraries + API Routes** - `d116224` (feat)
2. **Task 1b: Bank Statement Import + Invoice Matching** - `45f4164` (feat)
3. **Task 2: Time Tracking (Timer + Manual Entries + API + Akte Auto-Start)** - `b02b930` (feat)

## Files Created/Modified
- `src/lib/finance/export/types.ts` - TypeScript types for DATEV header, booking rows, SEPA payments, mandates, SKR03/SKR04 mapping constants
- `src/lib/finance/export/datev.ts` - DATEV Buchungsstapel CSV generation with EXTF_ header, German number format, BU-Schluessel mapping
- `src/lib/finance/export/sepa.ts` - SEPA pain.001 credit transfer and pain.008 direct debit XML generation via sepa npm
- `src/lib/finance/export/__tests__/datev-sepa.test.ts` - 37 tests for DATEV format, SKR mapping, booking rows, SEPA XML structure
- `src/app/api/finanzen/export/datev/route.ts` - DATEV CSV download endpoint (POST, ADMIN/ANWALT)
- `src/app/api/finanzen/export/sepa/route.ts` - SEPA XML download endpoint (POST, ADMIN/ANWALT, discriminated union for pain.001/008)
- `src/lib/finance/banking/types.ts` - Types for BankTransaction, BankFormat, MatchResult, predefined format configs
- `src/lib/finance/banking/csv-parser.ts` - Multi-format bank CSV parser with auto-detection, German number/date parsing
- `src/lib/finance/banking/camt-parser.ts` - CAMT.053 XML parser extracting Ntry elements into BankTransaction objects
- `src/lib/finance/banking/dedup.ts` - SHA-256 hash-based deduplication with DB lookup and intra-batch checking
- `src/lib/finance/banking/matcher.ts` - Invoice matching with confidence scoring from Rechnungsnr, amount, and Mandant name
- `src/app/api/finanzen/banking/import/route.ts` - Bank CSV/XML import endpoint (multipart/form-data, format detection, dedup, storage)
- `src/app/api/finanzen/banking/match/route.ts` - Match suggestions GET + confirm POST with cascading bank->invoice->Aktenkonto effects
- `src/lib/finance/time-tracking/types.ts` - TypeScript types for TimerState, TimeEntryInput, TimeEntrySummary
- `src/lib/finance/time-tracking/timer.ts` - Timer state management: start, stop, switch, getActive, isStundenhonorar check
- `src/app/api/finanzen/zeiterfassung/route.ts` - Time entry CRUD (GET list+summary, POST create, PATCH update if not abgerechnet)
- `src/app/api/finanzen/zeiterfassung/timer/route.ts` - Timer API (GET active, POST start, PATCH stop, PUT switch)
- `src/app/api/finanzen/taetigkeitskategorien/route.ts` - Category CRUD (GET with auto-seed, POST create, PATCH update) ADMIN-only
- `src/components/akten/akte-timer-bridge.tsx` - Client component for fire-and-forget timer auto-start on Akte page mount
- `src/app/(dashboard)/akten/[id]/page.tsx` - Added AkteTimerBridge component for auto-start timer wiring

## Decisions Made
- **Kontakt display name construction**: The Kontakt model uses vorname/nachname/firma, not a single name field. The matcher constructs display names from firma or vorname+nachname.
- **Fire-and-forget timer start**: The AkteTimerBridge client component calls POST in a useEffect without awaiting the response. This keeps the server-rendered page unblocked.
- **SHA-256 dedup hash**: Uses date+amount+purpose+sender as hash input. Deterministic and collision-resistant. Checks both existing DB records and within the current import batch.
- **Max confidence scoring**: Individual match scores (Rechnungsnr 0.95, amount 0.7, name 0.5) are combined via max() not sum(), preventing multi-criteria inflation beyond 1.0.
- **Lazy Taetigkeitskategorien initialization**: Default categories (Schriftsatz, Telefonat, etc.) are auto-seeded on first GET if the Kanzlei has none yet.
- **Timer idempotency**: Starting a timer for the same Akte that is already active returns the existing timer without creating a duplicate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Kontakt model field names in invoice matcher**
- **Found during:** Task 1b (TypeScript verification)
- **Issue:** Matcher queried `kontakt.name` but Kontakt model has `vorname`, `nachname`, `firma` fields instead of a single `name`
- **Fix:** Changed select to `{ vorname: true, nachname: true, firma: true }` and built display name from these fields
- **Files modified:** src/lib/finance/banking/matcher.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 45f4164

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** TypeScript type mismatch caught during compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 5 backend features are complete (Plans 01-05)
- DATEV export ready for Steuerberater communication
- SEPA ready for automated payment processing
- Bank import and matching pipeline ready for reconciliation UI
- Time tracking ready for sidebar timer widget (Plan 06 UI)
- Plan 06 (Financial Module UI) is the final plan in this phase

## Self-Check: PASSED

All 20 created/modified files verified present. All task commits (d116224, 45f4164, b02b930) verified in git log. 37 tests passing. TypeScript clean.

---
*Phase: 05-financial-module*
*Completed: 2026-02-24*
