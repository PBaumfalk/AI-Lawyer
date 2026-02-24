---
phase: 05-financial-module
plan: 06
subsystem: ui
tags: [financial-ui, rvg-calculator, invoice-management, aktenkonto, timer-widget, react, typescript]

requires:
  - phase: 05-01
    provides: "RVG fee calculation engine and VV catalog"
  - phase: 05-02
    provides: "Invoice creation and management API"
  - phase: 05-03
    provides: "Aktenkonto ledger and booking API"
  - phase: 05-04
    provides: "PDF and XRechnung export API"
  - phase: 05-05
    provides: "Time tracking, banking import, and DATEV/SEPA export"

provides:
  - "Complete financial module UI with RVG calculator (builder pattern, presets, VV search, running totals)"
  - "Invoice list page with filters, summary cards, batch operations, and sortable columns"
  - "Invoice detail page with action buttons (Stellen, PDF, E-Rechnung, Stornieren), Teilzahlungen, and Mahnungen"
  - "Aktenkonto ledger page with summary cards, chronological bookings, Fremdgeld compliance alerts, and Storno actions"
  - "Timer sidebar widget showing active timer with elapsed time, stop control, and Stundenhonorar Pflichtangabe enforcement"
  - "Three new tabs in Akte detail view (Aktenkonto, Rechnungen, Zeiterfassung) with auto-wiring"
  - "Complete user-facing financial workflow from RVG calculation through invoice payment tracking"

affects: [phase-06, phase-07]

tech-stack:
  added:
    - "react-hook-form for RVG calculator form management"
    - "date-fns for date formatting in ledger and invoice pages"
    - "react-select for searchable dropdowns (VV positions, Mandant, Akte)"
  patterns:
    - "Builder pattern for RVG calculator with preset buttons and manual add"
    - "Summary cards pattern for KPI metrics across all financial pages"
    - "Chronological ledger with running balance calculations"
    - "Modal/dialog patterns for manual booking, confirmation dialogs, and status transitions"
    - "Sidebar widget pattern for real-time timer display with polling fallback"
    - "Action buttons with conditional rendering based on entity status"

key-files:
  created:
    - "src/app/(dashboard)/finanzen/layout.tsx - Financial module layout with sub-navigation"
    - "src/app/(dashboard)/finanzen/page.tsx - Financial overview dashboard"
    - "src/app/(dashboard)/finanzen/rechner/page.tsx - RVG calculator page"
    - "src/components/finanzen/rvg-calculator.tsx - RVG calculator component with builder pattern"
    - "src/app/(dashboard)/finanzen/rechnungen/page.tsx - Invoice list page"
    - "src/components/finanzen/invoice-list.tsx - Invoice list component with filters and summary cards"
    - "src/app/(dashboard)/finanzen/rechnungen/[id]/page.tsx - Invoice detail page"
    - "src/components/finanzen/invoice-detail.tsx - Invoice detail component with action buttons"
    - "src/app/(dashboard)/finanzen/aktenkonto/page.tsx - Aktenkonto ledger page"
    - "src/components/finanzen/aktenkonto-ledger.tsx - Aktenkonto ledger component with Fremdgeld compliance"
    - "src/components/finanzen/timer-sidebar-widget.tsx - Timer widget for dashboard sidebar"
    - "src/components/finanzen/akte-zeiterfassung-tab.tsx - Time tracking tab for Akte detail"
  modified:
    - "src/components/akten/akte-detail-tabs.tsx - Added Aktenkonto, Rechnungen, Zeiterfassung tabs"
    - "src/components/akten/akte-timer-bridge.tsx - Auto-stop timer on Akte detail unmount"
    - "src/app/(dashboard)/layout.tsx - Integrated timer sidebar widget"

key-decisions:
  - "Builder pattern for RVG calculator provides intuitive preset-based workflow while allowing manual customization"
  - "Summary cards on every page (dashboard, invoice list, Aktenkonto) provide at-a-glance KPI visibility"
  - "Running balance in chronological ledger calculated client-side during render for real-time visibility"
  - "Fremdgeld compliance alerts with 5-Werktage countdown and 15k Anderkonto threshold provide proactive risk management"
  - "Timer sidebar widget with 30-second polling ensures cross-tab synchronization without creating redundant timers"
  - "Stundenhonorar Pflichtangabe enforced as mandatory field on timer stop, not optional"
  - "Auto-timer on Akte navigation via fire-and-forget useEffect prevents blocking server-rendered page load"
  - "Tabs in Akte detail (Aktenkonto, Rechnungen, Zeiterfassung) keep financial context within case view"

requirements-completed:
  - "REQ-FI-001"
  - "REQ-FI-003"
  - "REQ-FI-005"
  - "REQ-FI-006"
  - "REQ-FI-011"

duration: 22min
completed: 2026-02-24
---

# Phase 5 Plan 6: Financial Module UI Summary

**Complete financial module UI with RVG calculator (builder pattern, presets, VV search, running totals), invoice list (filters, summary cards, batch ops), invoice detail (positions, actions, PDF/XRechnung), Aktenkonto ledger (compliance alerts, Storno), and timer sidebar widget integrated into Akte detail view.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-02-24T11:30:00Z (approximately, from last session)
- **Completed:** 2026-02-24T12:00:00Z (approximately)
- **Tasks:** 2 completed + 1 checkpoint approved
- **Files created:** 12
- **Files modified:** 3

## Accomplishments

- **RVG Calculator UI:** Full builder pattern implementation with Streitwert input, preset buttons (Typisches Klageverfahren, Aussergerichtliche Vertretung, etc.), searchable VV position dropdown, position table with Anrechnung notices, and running totals sidebar (Zwischensumme, Auslagenpauschale 7002, USt 7008, Gesamtbetrag)
- **Invoice Management:** Complete invoice list with filters (status, date, Mandant, Akte, amount, ueberfaellig), summary cards (Gesamtumsatz, offene Forderungen, ueberfaellige Betraege, Stornoquote), sortable columns with ueberfaellig color-coding (green/yellow/orange/red), and detail page with action buttons (Stellen, PDF, E-Rechnung, Stornieren), Teilzahlungen, and Mahnungen timeline
- **Aktenkonto Ledger:** Summary cards (Saldo, Fremdgeld, Offene Forderungen, Auslagen), chronological ledger with running balance, Fremdgeld section with purple/blue color-coding, 5-Werktage countdown alerts, 15k Anderkonto threshold warning, and Storno actions
- **Timer Sidebar Widget:** Real-time elapsed time display (HH:MM:SS), pulsing green indicator, stop/switch controls, mandatory Taetigkeitsbeschreibung for Stundenhonorar-Akten, 30-second polling for cross-tab sync, and "Kein Timer aktiv" idle state
- **Akte Detail Integration:** Three new financial tabs (Aktenkonto, Rechnungen, Zeiterfassung) wired into existing Akte detail view, auto-timer start on Akte navigation, auto-stop on detail unmount

## Task Commits

All tasks completed and committed atomically:

1. **Task 1: Finanzen Layout + RVG Calculator Page + Invoice Pages** - `0a1ef2d` (feat)
   - Finanzen layout with sub-navigation tabs
   - RVG calculator page and component with builder pattern
   - Invoice list page and component with filters/summary cards
   - Invoice detail page and component with action buttons

2. **Task 2: Aktenkonto Page + Timer Sidebar Widget** - `64ac25a` (feat)
   - Aktenkonto ledger page and component with Fremdgeld compliance
   - Timer sidebar widget with elapsed time and stop control
   - Manual booking form and Storno actions
   - Filters and pagination for large ledgers

3. **Task 3 Follow-up: Akte Detail Tab Integration** - `fcb9605` (feat)
   - Three new tabs added to Akte detail view
   - Auto-timer on Akte navigation
   - Auto-stop on detail unmount

**Checkpoint approval:** `fcb9605` - User verified all financial module UI pages and interactions work as specified.

## Files Created/Modified

**Created (12 files):**
- `src/app/(dashboard)/finanzen/layout.tsx` - Financial module layout with sub-navigation
- `src/app/(dashboard)/finanzen/page.tsx` - Financial overview dashboard with KPI cards and quick actions
- `src/app/(dashboard)/finanzen/rechner/page.tsx` - RVG calculator page
- `src/components/finanzen/rvg-calculator.tsx` - RVG calculator component (builder pattern, presets, running totals)
- `src/app/(dashboard)/finanzen/rechnungen/page.tsx` - Invoice list page
- `src/components/finanzen/invoice-list.tsx` - Invoice list component (filters, summary cards, batch ops)
- `src/app/(dashboard)/finanzen/rechnungen/[id]/page.tsx` - Invoice detail page
- `src/components/finanzen/invoice-detail.tsx` - Invoice detail component (actions, Teilzahlungen, Mahnungen)
- `src/app/(dashboard)/finanzen/aktenkonto/page.tsx` - Aktenkonto ledger page
- `src/components/finanzen/aktenkonto-ledger.tsx` - Aktenkonto ledger component (compliance alerts, Storno)
- `src/components/finanzen/timer-sidebar-widget.tsx` - Timer widget (elapsed time, stop, sync)
- `src/components/finanzen/akte-zeiterfassung-tab.tsx` - Time tracking tab for Akte detail

**Modified (3 files):**
- `src/components/akten/akte-detail-tabs.tsx` - Added Aktenkonto, Rechnungen, Zeiterfassung tabs
- `src/components/akten/akte-timer-bridge.tsx` - Auto-stop timer on Akte detail unmount
- `src/app/(dashboard)/layout.tsx` - Integrated timer sidebar widget into sidebar

## Decisions Made

- **Builder pattern for RVG calculator:** Provides intuitive preset workflow (click preset button to add multiple VV positions at once) combined with manual customization (add individual positions via searchable dropdown). Makes common workflows fast while preserving flexibility for complex cases.
- **Summary cards on every page:** KPI cards (Gesamtumsatz, offene Forderungen, ueberfaellige Betraege, Saldo, Fremdgeld) appear on financial overview, invoice list, and Aktenkonto pages. Provides at-a-glance visibility without drilling into tables.
- **Running balance in ledger:** Calculated client-side during render from chronological bookings. Provides immediate feedback on balance changes without server round-trip.
- **Fremdgeld compliance with 5-Werktage countdown:** Alerts show dringlichkeit color-coding (blue → amber → orange → red) and countdown to 5-Werktag deadline. Proactive risk management for attorney's fiduciary duty.
- **15k Anderkonto threshold banner:** Prominent warning when total Fremdgeld exceeds 15k EUR (disclosure requirement threshold). Prevents accidental non-compliance.
- **Timer sidebar widget with polling:** Shows active timer for current Akte with elapsed time updating every second. 30-second polling ensures cross-tab sync if timer started/stopped from another tab without creating redundant timers.
- **Stundenhonorar Pflichtangabe enforcement:** Mandatory Taetigkeitsbeschreibung field on timer stop (not optional) for Stundenhonorar-Akten. Enforces legal documentation requirements at UI level.
- **Fire-and-forget auto-timer:** Timer start on Akte navigation happens via fire-and-forget useEffect in client component. Does not block server-rendered page load. Timer auto-stops on Akte detail unmount.
- **Tabs in Akte detail:** Aktenkonto, Rechnungen, Zeiterfassung tabs keep financial context within case view instead of requiring navigation to separate /finanzen page. Improves context switching efficiency.

## Deviations from Plan

None - plan executed exactly as written. All requirements met:
- RVG calculator with builder pattern, presets, VV search, running totals
- Invoice list with filters, summary cards, sortable columns
- Invoice detail with action buttons and Teilzahlungen
- Aktenkonto ledger with Fremdgeld compliance alerts
- Timer sidebar widget with elapsed time display
- Akte detail tab integration with auto-timer

## Issues Encountered

None - all planned features implemented without blocking issues or errors.

## User Setup Required

None - no external service configuration required for financial module UI. All financial pages connect to existing backend APIs built in Plans 01-05 (RVG calculation, invoice management, Aktenkonto ledger, time tracking).

## Next Phase Readiness

- **Phase 6 Ready:** All financial UI pages complete and connected to backend APIs
- **Testing:** Financial workflow ready for end-to-end testing (calculate RVG → create invoice → track payment → view Aktenkonto ledger → track time)
- **Launch:** Financial module UI complete, ready for Phase 6 (Rollen/Sicherheit) security hardening and role-based access control

---

*Phase: 05-financial-module*
*Plan: 06*
*Completed: 2026-02-24*
