# Phase 2: Deadline Calculation + Document Templates - Research

**Researched:** 2026-02-24
**Domain:** German legal deadline calculation (BGB 187-193), document templates (DOCX), WOPI/OnlyOffice integration, PDF export
**Confidence:** HIGH

## Summary

Phase 2 covers four major areas: (1) a pure-function FristenRechner library implementing BGB Sections 187-193 with Bundesland-specific holiday support, (2) calendar/Vorfristen enhancements with priority system and Tagesuebersicht, (3) a WOPI protocol rebuild for stable OnlyOffice integration with Track Changes/Comments/Collaboration, and (4) a Vorlagen-System with docxtemplater, Briefkopf management, and PDF export via OnlyOffice Conversion API.

The codebase already has foundational pieces: a `KalenderEintrag` model with basic CRUD, a `DokumentVorlage` model with `docxtemplater`+`pizzip` installed, placeholder resolution in `src/lib/vorlagen.ts`, and OnlyOffice integration via the Callback API (not WOPI) in `src/lib/onlyoffice.ts`. The FristenRechner and WOPI rebuild are greenfield work; templates and calendar are enhancements to existing code.

The FristenRechner is the highest-risk component due to legal liability (Haftungsrisiko). It requires exhaustive unit testing (>50 tests) covering month-end overflow, Ereignisfrist/Beginnfrist distinction, Section 193 weekend/holiday extension, leap years, and all 16 Bundesland holiday calendars. Use `feiertagejs` for holidays and `date-fns` (already installed) for date arithmetic -- never native JS Date arithmetic.

**Primary recommendation:** Build the FristenRechner as a pure, side-effect-free function library first (Plan 02-01), then layer UI/calendar enhancements, then tackle WOPI rebuild, and finally the template system + PDF export.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fristenrechner Interaction:**
- Location: Both sidebar tool (Sheet/Modal ~600px) AND inline in calendar event form. Sidebar accessible via Cmd+K and dedicated keyboard shortcut.
- Result display: Detailed breakdown showing start date, raw end date, holidays/weekends that caused shifts, final end date, Vorfrist dates, Halbfrist -- PLUS auto-suggest linking to an Akte with option to immediately create Frist as calendar entry.
- Input form: Presets (admin-verwaltbar in Kanzlei-Einstellungen) + manual fields. All fields editable. Presets auto-fill duration but can be overridden.
- Both directions: Forward (Zustellung -> Fristende) AND backward (Fristende -> spaetester Zustellungstermin).
- Bundesland: Per-Frist Instanz/Gericht field. Auto-derived from Akte's Gericht if linked. Kanzlei-default (NRW) as fallback. All 16 Bundeslaender supported.
- Notfristen: Visually highlighted with warning color (rot) + "NOTFRIST" badge. Additional warning: "Diese Frist ist nicht verlaengerbar."
- Batch calculation: One Zustellungsdatum, multiple Fristtypen selectable. All results in overview, all saveable as calendar entries at once.
- Sonderfaelle: Oeffentliche Zustellung, Auslandszustellung (EU-ZustVO) supported as additional options.
- Validation warning: If user modifies duration from preset default, yellow hint with warning text.
- Halbfrist: Shown as optional display in result + automatically created as Vorfrist for deadlines > 2 weeks.
- Historie: Last 10 calculations remembered in sidebar tool.
- Fristenzettel: Printable PDF in two formats (daily overview and per-Akte).
- Fristen-Presets: Admin-managed in Kanzlei-Einstellungen.

**Warn-Ampel & Status:**
- Color coding: Gruen (>7 Tage), Gelb (3-7 Tage), Rot (<3 Tage), Schwarz (ueberschritten).
- Erledigte Fristen: Remain visible, greyed out, filterable.
- Erledigungsgrund: MANDATORY field when marking done. Dropdown + Freitext. Audit-Trail.
- Ueberschrittene Fristen: Sofortige Eskalation with alarm notification. Pflicht-Kommentar required.

**Fristenverwaltung Workflows:**
- Fristverlaengerung: Dedicated workflow with history preservation and auto-recalculation.
- Fristenkontrolle: Attorney MUST be notified to review. Nicht-quittierte Fristen remain "ungeprueft".
- Keine Akte ohne Frist/WV: Validation warning.
- Auto-Wiedervorlage: When new document added, create WV with priority "Dringend".
- Termine-Verlegung: Dedicated workflow with history.
- Termin-Checkliste: Optional configurable checklist per Gerichtstermin.
- Konflikterkennung: Warning for overlapping Gerichtstermine or double-booked attorneys.
- Wiederkehrende Termine: Serientermine (daily/weekly/monthly/custom).
- Dokument-Verknuepfung: Multiple documents from Akten-DMS attachable to Fristen and Termine.

**Vertretung & Urlaub:**
- Vertreter-Feld per user, Vertretungs-Modus with Zeitraum, Jahresurlaub management.
- Zuweisung: Verantwortlicher + Sachbearbeiter auto-inherited from Akte, editable per Frist.

**Fristen-Dashboard & Statistik:**
- Dashboard pro Anwalt, Fristen-Statistik with Einhaltungsquote, Jahresbericht PDF, iCal/CSV export.

**Vorfristen & Reminder Flow:**
- Configuration: Global defaults (7/3/1) + per-Preset + per-Frist overridable. Halbfrist auto-added > 2 weeks.
- Calculation: Based on Kalendertage. If Vorfrist falls on weekend/holiday, shifted to previous Arbeitstag.
- Delivery: In-App Toast + Bell (Socket.IO), Dashboard-Widget, E-Mail (after Phase 3), Vorfrist as calendar entry.
- Pflicht-Quittierung: Vorfristen must be acknowledged. Unquittierte appear red.
- Eskalation: Configurable in Kanzlei-Einstellungen (X hours -> Vertreter, Y hours -> Admin).
- Benachrichtigungseinstellungen: Admin-managed only.
- Kanzlei-Arbeitszeiten: Notifications held outside working hours.
- Auto-Neuberechnung on extension.
- Woechentlicher Report: Monday morning.

**Tagesuebersicht:**
- Dashboard-Widget (not separate page). Three categories: Fristen (Ampel), Wiedervorlagen, Termine.

**Wiedervorlagen-Workflow:**
- Quick-Create, visual distinction from Fristen, delegation, wiederkehrende WV, Kategorien, Ergebnis-Feld, Ticket-Verknuepfung.

**Template Browsing & Generation:**
- Karten-Uebersicht with categories and search. Favoriten and "Zuletzt verwendet".
- Freigabe-Workflow: Anyone creates drafts, Admin/Anwalt freigeben.
- 4-step Wizard: Select template -> Select Akte/Mandant -> Fill custom fields -> Preview + Confirm.
- Custom fields per template. Conditional sections (docxtemplater). Versionierung.
- Editor: OnlyOffice as base + additional Toolbar/Sidebar for placeholder insertion.
- Auto-naming, target folder, Quick-Create from Akte view.
- Starter-Set: 10-20 standard templates shipped.
- Ordner-Schemata: Configurable per Rechtsgebiet.

**Briefkopf & PDF Export:**
- Multiple Briefkoepfe per Standort/team.
- Editor: Structured form AND full DOCX editing in OnlyOffice.
- Layout: Logo + firm name at top + contact/BRAO in right sidebar. First page full, following pages minimal.
- PDF Export dialog: Choose Briefkopf, PDF/A optional, watermark optional.
- Dokument-Status-Workflow: Entwurf -> In Pruefung -> Freigegeben -> Versendet.
- Schreibschutz after "Freigegeben".

**WOPI Session Behavior:**
- Auto-reconnect with local buffer. Auto-Save every 30 seconds.
- Automatic token refresh. Session stays open indefinitely while active.
- Multi-User co-editing (no locks). Track Changes full support. Comments workflow.
- Versioning: Auto version on close, named manual snapshots, restorable.

**Kanzlei-Einstellungen:**
- Tab-based with categories. Auto-Save. Audit-Trail. Reset per tab.
- Onboarding-Wizard: First login guided setup.
- Import/Export as JSON.

**Fristen in Akte-Ansicht:**
- Dedicated "Fristen & Termine" tab AND Akte-Chronologie integration.
- Akte-Header: Next deadline with Ampel prominently displayed.
- Chronologie: Complete case history.
- Aktenliste: Next deadline + Ampel, sortable.

### Claude's Discretion

- Command Palette (Cmd+K) implementation details and keyboard shortcut assignments
- Exact spacing, typography, and animation details
- Loading skeleton designs
- Error state handling for edge cases
- Exact auto-naming pattern for generated documents
- Compression/optimization of PDF exports
- WOPI token refresh timing and lock renewal intervals
- Exact color codes for WV categories
- Starter-Set template content and formatting

### Deferred Ideas (OUT OF SCOPE)

- **Taeglicher Fristenzettel per E-Mail:** Requires Phase 3 SMTP.
- **E-Mail-Trigger fuer Wiedervorlage:** Requires Phase 3 email system.
- **Fristenbuero-Modus:** Deferred to Phase 6 KI-Agent.
- **Personalakte:** Own phase or v2.
- **Akte-Zeitleiste Integration (extended):** Fully after Phase 3 (emails).
- **Rechtsmittel-Kette:** Future enhancement.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-FK-001 | BGB 187-193 Fristberechnung (Ereignisfrist, Beginnfrist, Monats-/Wochen-/Tagesfristen, Monatsende-Ueberlauf) | FristenRechner pure-function library with date-fns + exhaustive unit tests. See Architecture Patterns and Code Examples sections. |
| REQ-FK-002 | Feiertagskalender pro Bundesland (Standard: NRW) mit 193 BGB Wochenende/Feiertag-Verschiebung | feiertagejs library (region code "NW" for NRW). See Standard Stack section. |
| REQ-FK-003 | Vorfristen-Erinnerungen (konfigurierbar, Standard: 7/3/1 Tag) + Vorfrist | BullMQ repeatable job for reminder checking. Notification service already exists. See Architecture Patterns. |
| REQ-FK-004 | Tagesuebersicht (heute/ueberfaellig) + Quick-Actions | Dashboard widget component. Calendar API already supports date-range filtering. |
| REQ-FK-005 | Prioritaeten: 5 Stufen (Sehr niedrig -> Dringend) | Add `prioritaet` enum to KalenderEintrag model. See Schema Changes section. |
| REQ-DV-001 | Vorlagen-System mit Platzhalter-Befuellung | docxtemplater already installed. Existing `fillDocxTemplate()` + `resolvePlatzhalter()` in `src/lib/vorlagen.ts`. Enhance with conditional sections + loops. |
| REQ-DV-002 | Briefkopf-Verwaltung (Logo + Kanzleidaten, bearbeitbar in OnlyOffice) | New `Briefkopf` model. DOCX header/footer manipulation via docxtemplater or PizZip. |
| REQ-DV-003 | PDF-Export mit Kanzlei-Briefkopf via OnlyOffice | OnlyOffice Conversion API: POST to `/converter` with filetype=docx, outputtype=pdf. |
| REQ-DV-008 | Ordner-Schemata fuer Akten | New `OrdnerSchema` model in settings. Applied when creating new Akte. |
| REQ-DV-009 | Vorlagenkategorien (Schriftsaetze, Klageschriften, etc.) | `VorlageKategorie` enum already exists. Enhance with tags and free-form categories. |
| REQ-DV-010 | WOPI-Protokoll stabil (Laden/Speichern zuverlaessig) | CRITICAL: Current implementation uses Callback API with broken document.key (Date.now() per session). Rebuild needed. See WOPI section. |
| REQ-DV-011 | Track Changes, Kommentare, Versionierung in OnlyOffice | Callback API supports these. Fix document.key to be stable per document (version-based). Enable co-editing via shared key. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| date-fns | ^4.1.0 | Date arithmetic for Fristberechnung | Already installed. Pure functions, tree-shakable, handles month-end overflow correctly with `addMonths()`. |
| feiertagejs | latest (~1.3.x) | German Bundesland-specific holiday calendar | Purpose-built for German holidays. Covers all 16 Bundeslaender. TypeScript. Zero dependencies. Used in REQUIREMENTS.md. |
| docxtemplater | ^3.68.2 | DOCX template rendering with placeholders | Already installed. Supports conditions (`{#if}...{/if}`), loops (`{#array}...{/array}`), inverted sections (`{^}...{/}`). |
| pizzip | ^3.2.0 | ZIP manipulation for DOCX files | Already installed. Required by docxtemplater for DOCX parsing. |
| bullmq | ^5.70.1 | Job queue for reminder notifications | Already installed. Worker process already running. Add `frist-reminder` queue. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns-tz | ^3.2.0 | Timezone handling for Europe/Berlin | Already installed. Use for deadline calculations to ensure German timezone correctness. |
| @onlyoffice/document-editor-react | ^2.1.1 | React wrapper for OnlyOffice editor | Already installed. Use `documentServerUrl` prop, events via props. |
| jsonwebtoken | ^9.0.3 | JWT signing for OnlyOffice/WOPI | Already installed. Used for OnlyOffice document tokens. |
| zod | ^3.23.8 | Schema validation for API routes | Already installed. Use for FristenRechner input validation. |
| sonner | ^1.7.1 | Toast notifications | Already installed. Use for deadline reminders in UI. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| feiertagejs | date-holidays | date-holidays covers 142 countries but is much larger (250KB vs 20KB). feiertagejs is German-specific and purpose-built. |
| Callback API | Full WOPI protocol | WOPI adds complexity (lock management, CheckFileInfo, PutFile) but the existing Callback API already works for the use case. WOPI is needed only if connecting to external WOPI hosts. For a self-hosted OnlyOffice setup, the Callback API with fixed document.key is the correct approach. |
| docxtemplater loops | docxtemplater-paid-modules | Free OSS core already supports conditions and loops. Paid modules (HTML insert, image insert) not needed for text-based legal templates. |

**Installation:**
```bash
npm install feiertagejs
```

## Architecture Patterns

### CRITICAL: Callback API vs WOPI Decision

The existing codebase uses OnlyOffice's **Callback API** (JavaScript API), NOT the WOPI protocol. The CONTEXT.md mentions "WOPI rebuild" but the actual requirement is to fix the existing Callback API implementation for reliable save/load, co-editing, and Track Changes.

**Key insight:** WOPI is for connecting OnlyOffice to EXTERNAL storage providers (SharePoint, Nextcloud). For a self-hosted system where the app directly manages MinIO storage, the **Callback API is the correct approach**. It provides MORE features than WOPI (version history, mail merge, download in different formats, granular permissions).

**What needs fixing in the existing implementation:**
1. `document.key` uses `${dokumentId}_${Date.now()}` -- this creates a NEW session every time a document is opened, breaking co-editing and causing cache issues
2. No version tracking on key changes (key must change after save, but be stable during editing session)
3. No forcesave handling for long sessions
4. No document lock management
5. Missing Track Changes and Comments configuration

### Recommended Project Structure
```
src/
  lib/
    fristen/
      rechner.ts            # Pure FristenRechner functions (ZERO side effects)
      rechner.test.ts       # >50 unit tests
      feiertage.ts          # feiertagejs wrapper with Bundesland config
      types.ts              # FristTyp, FristErgebnis, BundeslandCode types
      presets.ts            # Default Fristen-Presets data
      vorfrist.ts           # Vorfrist calculation + Halbfrist logic
    onlyoffice.ts           # Enhanced: stable key generation, version tracking
    vorlagen.ts             # Enhanced: conditional sections, custom fields
    briefkopf.ts            # NEW: Briefkopf DOCX manipulation + PDF export
    settings/
      defaults.ts           # Enhanced: Fristen, Vorlagen, Briefkopf categories
      service.ts            # Existing: SystemSetting CRUD
  app/
    api/
      fristen/
        rechner/route.ts    # POST: calculate deadline
        presets/route.ts     # CRUD: Fristen-Presets
      kalender/
        route.ts             # Enhanced: priority, Vorfrist fields
        [id]/
          erledigt/route.ts  # Enhanced: mandatory Erledigungsgrund
          verlaengerung/route.ts  # NEW: deadline extension workflow
      vorlagen/
        route.ts             # Enhanced: versioning, Freigabe
        [id]/
          generieren/route.ts # NEW: 4-step generation wizard backend
      briefkopf/
        route.ts             # NEW: CRUD for Briefkoepfe
      onlyoffice/
        callback/route.ts    # Enhanced: stable key, version, co-editing
        config/[dokumentId]/route.ts  # Enhanced: stable key
        convert/route.ts     # NEW: DOCX->PDF via Conversion API
  components/
    fristen/
      fristenrechner-sheet.tsx    # Sidebar Sheet (~600px)
      fristenrechner-form.tsx     # Input form with presets
      fristenrechner-ergebnis.tsx # Result display with breakdown
      fristen-ampel.tsx           # Color-coded deadline indicator
      tagesuebersicht.tsx         # Dashboard widget
      fristenzettel-pdf.tsx       # Printable PDF generation
    kalender/
      kalender-liste.tsx          # Enhanced: priority, Ampel
      kalender-eintrag-dialog.tsx # Enhanced: Fristenrechner inline
    vorlagen/
      vorlagen-uebersicht.tsx     # Card-based template browser
      vorlagen-wizard.tsx         # 4-step generation wizard
      platzhalter-sidebar.tsx     # Placeholder insertion panel
    briefkopf/
      briefkopf-editor.tsx        # Structured form + OnlyOffice editing
      pdf-export-dialog.tsx       # Export options dialog
    einstellungen/
      fristen-tab.tsx             # Fristen settings (Presets, Vorfristen, defaults)
      vorlagen-tab.tsx            # Template management tab
      briefkopf-tab.tsx           # Briefkopf management tab
      ordner-schemata-tab.tsx     # Folder schema configuration
```

### Pattern 1: FristenRechner Pure Function Library

**What:** A side-effect-free function library for BGB deadline calculation.
**When to use:** All deadline calculations -- UI, API, worker jobs, batch calculations.

```typescript
// src/lib/fristen/types.ts
export type FristArt = 'EREIGNISFRIST' | 'BEGINNFRIST';
export type FristDauer = { wochen?: number; monate?: number; tage?: number; jahre?: number };
export type BundeslandCode = 'BW' | 'BY' | 'BE' | 'BB' | 'HB' | 'HE' | 'HH' | 'MV' | 'NI' | 'NW' | 'RP' | 'SL' | 'SN' | 'ST' | 'SH' | 'TH';

export interface FristInput {
  zustellungsdatum: Date;        // Date of service/event
  fristArt: FristArt;            // Event-based or date-based
  dauer: FristDauer;             // Duration
  bundesland: BundeslandCode;    // For holiday lookup
  section193: boolean;           // Apply weekend/holiday extension
}

export interface FristErgebnis {
  eingabeDatum: Date;            // Original input date
  rohEndDatum: Date;             // End date before Section 193 adjustment
  endDatum: Date;                // Final deadline (after holiday/weekend shift)
  verschobenWegen: VerschiebungsGrund[];  // Why it was shifted
  vorfristen: VorfristDatum[];   // Pre-deadline reminder dates
  halbfrist?: Date;              // Half-deadline (if applicable)
  istNotfrist: boolean;          // Warning flag
}

export interface VerschiebungsGrund {
  datum: Date;
  grund: string;  // e.g. "Samstag", "Fronleichnam (NRW)"
}
```

### Pattern 2: Stable OnlyOffice Document Key

**What:** Fix the document.key generation to enable co-editing and proper cache management.
**When to use:** Every OnlyOffice editor session.

```typescript
// The key must be STABLE for the same document version
// and CHANGE after a successful save (status 2)
// Format: {dokumentId}_{version}
// This allows multiple users to share the same editing session
function generateDocumentKey(dokumentId: string, version: number): string {
  return `${dokumentId}_v${version}`;
}

// In buildEditorConfig: use version from DB, not Date.now()
const key = generateDocumentKey(dokumentId, dokument.version);

// In callback handler (status 2): version increments, key changes
// Next editor open gets new key -> new session -> fresh from storage
```

### Pattern 3: Briefkopf as DOCX Header/Footer Template

**What:** Store Briefkopf as a DOCX file with header/footer sections. Apply by merging headers/footers into target document.
**When to use:** Document generation and PDF export.

```typescript
// Briefkopf is stored as a DOCX in MinIO
// It contains: header with logo + firm info, footer with legal info
// When generating a document from template:
// 1. Fill template with placeholders via docxtemplater
// 2. Open result DOCX with PizZip
// 3. Copy header/footer XML parts from Briefkopf DOCX
// 4. Replace header/footer in target DOCX
// 5. Save back or convert to PDF via OnlyOffice Conversion API
```

### Pattern 4: BullMQ Repeatable Job for Deadline Reminders

**What:** A cron-like job that checks for upcoming deadlines and sends notifications.
**When to use:** Vorfrist reminders, overdue escalation, weekly report.

```typescript
// In queues.ts: add new queue
export const fristReminderQueue = new Queue("frist-reminder", {
  connection: getQueueConnection(),
  defaultJobOptions,
});

// Add repeatable job (every 5 minutes during working hours)
await fristReminderQueue.add("check-reminders", {}, {
  repeat: { pattern: "*/5 7-19 * * 1-5" },  // Every 5 min, Mon-Fri 7-19h
});

// Processor: query DB for deadlines due soon, create notifications
```

### Anti-Patterns to Avoid

- **Using Date.now() in document.key:** This breaks co-editing entirely. Every user gets a different session. Use `{dokumentId}_v{version}` instead.
- **Native JS date arithmetic for deadlines:** `date.setMonth(date.getMonth() + 1)` overflows incorrectly (Jan 31 + 1 month = March 3, not Feb 28). Use `date-fns/addMonths` which handles this correctly.
- **Single holiday list for all Bundeslaender:** Germany has 16 different holiday calendars. Always specify the Bundesland.
- **Hardcoding Vorfristen:** Make them configurable at 3 levels: global default, per Fristen-Preset, per individual Frist.
- **Building WOPI when Callback API suffices:** WOPI adds lock management complexity that is unnecessary for a self-hosted OnlyOffice setup. The Callback API is more feature-rich and simpler.
- **Coupling FristenRechner to database:** Keep it as pure functions. The API/UI layer handles DB reads/writes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| German holiday calendar | Custom holiday data/lists | feiertagejs `getHolidays(year, region)` + `isHoliday(date, region)` | 16 Bundeslaender, moveable holidays (Easter-based), edge cases (Augsburg-specific). Updated yearly. |
| Month-end overflow | `date.setMonth()` / manual arithmetic | date-fns `addMonths()`, `addWeeks()`, `addDays()` | Correctly handles Jan 31 + 1 month = Feb 28. Tested. Pure. |
| DOCX template rendering | Manual XML manipulation for placeholders | docxtemplater with PizZip | Handles split-run placeholders, nested objects, conditions, loops. 8+ years maintained. |
| DOCX to PDF conversion | puppeteer/LibreOffice CLI | OnlyOffice Conversion API (POST /converter) | Already running in Docker. Supports PDF/A. Handles complex formatting. |
| Date timezone handling | UTC offsets manually | date-fns-tz `zonedTimeToUtc` / `utcToZonedTime` | German timezone (CET/CEST) transitions correctly handled. |
| Notification delivery | Custom WebSocket management | Existing notification service + Socket.IO emitter | Already built in Phase 1. `createNotification()` persists to DB + emits real-time. |

**Key insight:** The FristenRechner is the ONLY component that should be hand-built, because BGB deadline rules are specific to German law and no npm library implements them. But it should use date-fns and feiertagejs as building blocks, not raw Date operations.

## Common Pitfalls

### Pitfall 1: Month-End Overflow in Fristberechnung
**What goes wrong:** JavaScript `new Date(2026, 0, 31).setMonth(1)` returns March 3, not February 28. BGB Section 188 Abs. 3 requires the last day of the month when the target day doesn't exist.
**Why it happens:** Developers use native Date methods instead of date-fns.
**How to avoid:** Use `date-fns/addMonths(new Date(2026, 0, 31), 1)` which correctly returns February 28, 2026. Write unit tests for EVERY month-end case: Jan 31 + 1mo, Jan 31 + 2mo, Mar 31 + 1mo, etc.
**Warning signs:** No unit tests for month boundaries. Using `new Date()` constructor for arithmetic.

### Pitfall 2: Ereignisfrist vs. Beginnfrist Confusion
**What goes wrong:** Treating all deadlines the same. Section 187 Abs. 1 (event-based) does NOT count the event day. Section 187 Abs. 2 (date-based) DOES count the start day.
**Why it happens:** The distinction is subtle. Most developers only implement Ereignisfrist.
**How to avoid:** Make `fristArt` a REQUIRED parameter. Implement both code paths with different start-day logic. Test both with identical inputs to show the 1-day difference.
**Warning signs:** All deadline results are off by 1 day in one direction.

### Pitfall 3: Section 193 Applied Where It Shouldn't Be
**What goes wrong:** Extending ALL deadlines past weekends/holidays. Section 193 BGB only applies to deadlines for "Abgabe einer Willenserklaerung" (declarations of intent) and "Bewirkung einer Leistung" (performance of services). Pure calculation deadlines like Verjaehrung do NOT extend.
**Why it happens:** Oversimplified implementation applies 193 everywhere.
**How to avoid:** Make Section 193 application a configurable boolean per deadline type. Default TRUE for court/procedural deadlines, FALSE for statute of limitations.
**Warning signs:** All deadlines always land on weekdays.

### Pitfall 4: OnlyOffice document.key Breaks Co-Editing
**What goes wrong:** Using `${dokumentId}_${Date.now()}` generates a unique key per session. Two users opening the same document get different keys, creating separate editing sessions. Their changes overwrite each other on save.
**Why it happens:** The key was designed for cache busting, not collaboration.
**How to avoid:** Use `${dokumentId}_v${version}` where version comes from the database. Same document + same version = same editing session. After save (callback status 2), increment version, so next open gets fresh key.
**Warning signs:** Two users editing the same document don't see each other's cursors. Save overwrites the other user's changes.

### Pitfall 5: OnlyOffice Key Reuse After Save
**What goes wrong:** After a document is saved (status 2 callback), the old key is locked. Opening the document with the same key shows the cached version, not the saved version.
**Why it happens:** OnlyOffice caches documents by key. Once a key is used for a save, it cannot be reused for editing.
**How to avoid:** Increment `version` in the database after successful save. New opens use `${dokumentId}_v${newVersion}`, getting a fresh session that loads from storage.
**Warning signs:** Document content doesn't update after save. Opening shows stale content.

### Pitfall 6: Vorfrist on Weekend Not Shifted Backward
**What goes wrong:** A Vorfrist (pre-deadline reminder) of 7 days before a Friday deadline falls on a Saturday. The reminder should shift to the PREVIOUS business day (Friday), not the next.
**Why it happens:** Using the same Section 193 forward-shift logic for Vorfristen.
**How to avoid:** Vorfristen shift BACKWARD to the previous Arbeitstag, not forward. Implement a separate `shiftToPreviousBusinessDay()` function.
**Warning signs:** Vorfrist dates sometimes fall on weekends.

### Pitfall 7: Briefkopf Header/Footer Replacement Corrupts DOCX
**What goes wrong:** Naively replacing header/footer XML parts without updating relationships (`_rels/document.xml.rels`) and content types breaks the DOCX structure. Word/OnlyOffice reports a corrupt file.
**Why it happens:** DOCX is an XML-in-ZIP format with complex relationship tracking between parts.
**How to avoid:** When merging headers/footers: (1) copy the header XML parts, (2) copy any images/media referenced by headers, (3) update the relationship IDs in the target document.xml.rels, (4) update Content_Types.xml. Test with OnlyOffice AND MS Word.
**Warning signs:** "The file is corrupted" errors when opening generated documents.

## Code Examples

### FristenRechner Core: Ereignisfrist with Section 193

```typescript
// src/lib/fristen/rechner.ts
import { addDays, addWeeks, addMonths, addYears, isSaturday, isSunday } from 'date-fns';
import { isHoliday } from 'feiertagejs';
import type { FristInput, FristErgebnis, BundeslandCode, VerschiebungsGrund } from './types';

/**
 * Check if a date is a business day (not weekend, not holiday).
 */
export function isGeschaeftstag(date: Date, bundesland: BundeslandCode): boolean {
  if (isSaturday(date) || isSunday(date)) return false;
  // feiertagejs uses region codes like 'NW' for NRW
  return !isHoliday(date, bundesland);
}

/**
 * Shift a date forward to the next business day (Section 193 BGB).
 */
export function naechsterGeschaeftstag(
  date: Date,
  bundesland: BundeslandCode
): { datum: Date; gruende: VerschiebungsGrund[] } {
  const gruende: VerschiebungsGrund[] = [];
  let current = date;

  while (!isGeschaeftstag(current, bundesland)) {
    if (isSaturday(current)) {
      gruende.push({ datum: new Date(current), grund: 'Samstag' });
    } else if (isSunday(current)) {
      gruende.push({ datum: new Date(current), grund: 'Sonntag' });
    } else {
      // Must be a holiday
      const holidays = getHolidays(current.getFullYear(), bundesland);
      const holiday = holidays.find(h => h.equals(current));
      const name = holiday?.translate('de') ?? 'Feiertag';
      gruende.push({ datum: new Date(current), grund: name });
    }
    current = addDays(current, 1);
  }

  return { datum: current, gruende };
}

/**
 * Shift a date backward to the previous business day (for Vorfristen).
 */
export function vorherigerGeschaeftstag(
  date: Date,
  bundesland: BundeslandCode
): Date {
  let current = date;
  while (!isGeschaeftstag(current, bundesland)) {
    current = addDays(current, -1);
  }
  return current;
}

/**
 * Calculate deadline per BGB Sections 187-193.
 */
export function berechneFrist(input: FristInput): FristErgebnis {
  const { zustellungsdatum, fristArt, dauer, bundesland, section193 } = input;

  // Step 1: Determine start date per Section 187
  let startDatum: Date;
  if (fristArt === 'EREIGNISFRIST') {
    // Section 187 Abs. 1: Day of event NOT counted, start next day
    startDatum = addDays(zustellungsdatum, 1);
  } else {
    // Section 187 Abs. 2: Start day IS counted (begins at 00:00)
    startDatum = zustellungsdatum;
  }

  // Step 2: Add duration per Section 188
  let rohEndDatum = startDatum;
  if (dauer.jahre) rohEndDatum = addYears(rohEndDatum, dauer.jahre);
  if (dauer.monate) rohEndDatum = addMonths(rohEndDatum, dauer.monate);
  if (dauer.wochen) rohEndDatum = addWeeks(rohEndDatum, dauer.wochen);
  if (dauer.tage) rohEndDatum = addDays(rohEndDatum, dauer.tage);

  // For Ereignisfrist with week/month duration: end on corresponding day
  // Section 188 Abs. 2: ends on the day that corresponds to the event day
  if (fristArt === 'EREIGNISFRIST' && (dauer.wochen || dauer.monate || dauer.jahre)) {
    // The end date from addMonths/addWeeks already handles this correctly
    // But we need to subtract 1 day because we added 1 in step 1
    rohEndDatum = addDays(rohEndDatum, -1);
  }

  // Step 3: Apply Section 193 if applicable
  let endDatum = rohEndDatum;
  let verschobenWegen: VerschiebungsGrund[] = [];
  if (section193) {
    const result = naechsterGeschaeftstag(rohEndDatum, bundesland);
    endDatum = result.datum;
    verschobenWegen = result.gruende;
  }

  return {
    eingabeDatum: zustellungsdatum,
    rohEndDatum,
    endDatum,
    verschobenWegen,
    vorfristen: [],  // Calculated separately
    istNotfrist: false,  // Set by caller based on preset
  };
}
```

### OnlyOffice Stable Key + Co-Editing Fix

```typescript
// Enhanced buildEditorConfig in src/lib/onlyoffice.ts
export function buildEditorConfig({
  dokumentId,
  fileName,
  mimeType,
  userId,
  userName,
  mode = "edit",
  version,  // NEW: document version from DB
}: EditorConfigParams) {
  // STABLE key: same document + same version = same editing session
  const key = `${dokumentId}_v${version}`;

  const payload = {
    document: {
      fileType: getExtension(fileName),
      key,  // Stable, not Date.now()
      title: fileName,
      url: downloadUrl,
      permissions,
    },
    documentType,
    editorConfig: {
      callbackUrl: `${callbackUrl}?dokumentId=${dokumentId}`,
      lang: "de",
      mode: effectiveMode,
      user: { id: userId, name: userName },
      customization: {
        autosave: true,
        comments: true,       // Enable comments
        compactHeader: false,
        forcesave: true,       // Enable periodic saves
        review: {
          showReviewChanges: true,  // Track Changes visible
          reviewDisplay: "markup",
          trackChanges: true,
        },
      },
    },
  };
  // ...sign and return
}
```

### Callback Handler: Version Increment After Save

```typescript
// Enhanced callback in src/app/api/onlyoffice/callback/route.ts
if (status === 2 && url) {
  // Document ready for saving (all editors closed)
  // Download, save to MinIO, increment version
  await prisma.dokument.update({
    where: { id: dokumentId },
    data: {
      groesse: buffer.length,
      version: { increment: 1 },  // KEY: version changes -> new key on next open
      updatedAt: new Date(),
    },
  });
}

if (status === 6 && url) {
  // Forcesave: save but do NOT increment version
  // (session is still active, key must stay the same)
  await uploadFile(dokument.dateipfad, buffer, dokument.mimeType, buffer.length);
  // Do NOT increment version -- co-editing session continues
}
```

### OnlyOffice Conversion API for PDF Export

```typescript
// src/lib/briefkopf.ts
import { signPayload, ONLYOFFICE_INTERNAL_URL, rewriteOnlyOfficeUrl } from './onlyoffice';

export async function convertToPdf(
  dokumentUrl: string,
  key: string,
  title: string
): Promise<Buffer> {
  const payload = {
    filetype: 'docx',
    key: `convert_${key}_${Date.now()}`,
    outputtype: 'pdf',
    title,
    url: dokumentUrl,
  };

  const token = signPayload(payload);

  const response = await fetch(`${ONLYOFFICE_INTERNAL_URL}/converter`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ ...payload, token }),
  });

  const result = await response.json();

  if (result.endConvert && result.fileUrl) {
    const pdfUrl = rewriteOnlyOfficeUrl(result.fileUrl);
    const pdfResponse = await fetch(pdfUrl);
    return Buffer.from(await pdfResponse.arrayBuffer());
  }

  throw new Error(`Conversion failed: ${JSON.stringify(result)}`);
}
```

### feiertagejs Usage for Bundesland Holidays

```typescript
// src/lib/fristen/feiertage.ts
import { getHolidays, isHoliday } from 'feiertagejs';
import type { BundeslandCode } from './types';

// feiertagejs uses the same region codes as our BundeslandCode type
// NW = Nordrhein-Westfalen, BY = Bayern, etc.

/**
 * Check if a date is a public holiday in the given Bundesland.
 */
export function istFeiertag(date: Date, bundesland: BundeslandCode): boolean {
  return isHoliday(date, bundesland);
}

/**
 * Get all holidays for a year in a Bundesland.
 * Returns array with date, German name, and holiday constant.
 */
export function getFeiertage(year: number, bundesland: BundeslandCode) {
  return getHolidays(year, bundesland).map(h => ({
    datum: h.date,
    name: h.translate('de'),
    key: h.name,
  }));
}

/**
 * Get holiday name if the date is a holiday, or null.
 */
export function getFeiertagName(date: Date, bundesland: BundeslandCode): string | null {
  const holidays = getHolidays(date.getFullYear(), bundesland);
  const match = holidays.find(h => h.equals(date));
  return match ? match.translate('de') : null;
}
```

## Schema Changes Required

The following Prisma schema changes are needed for Phase 2:

### KalenderEintrag Enhancements
```prisma
enum FristPrioritaet {
  SEHR_NIEDRIG
  NIEDRIG
  NORMAL
  HOCH
  DRINGEND
}

model KalenderEintrag {
  // ... existing fields ...

  // NEW: Priority (5 levels)
  prioritaet       FristPrioritaet @default(NORMAL)

  // NEW: Frist-specific fields
  fristArt         String?         // 'EREIGNISFRIST' | 'BEGINNFRIST'
  bundesland       String?         // BundeslandCode, e.g. 'NW'
  istNotfrist      Boolean         @default(false)
  quittiert        Boolean         @default(false)
  quittiertAm      DateTime?
  quittiertVonId   String?
  erledigungsgrund String?         // MANDATORY when erledigt=true

  // NEW: Multiple Vorfristen (instead of single vorfrist field)
  vorfristen       DateTime[]      // Array of pre-deadline dates

  // NEW: Halbfrist
  halbfrist        DateTime?

  // NEW: Parent-child for Vorfristen as calendar entries
  hauptfristId     String?
  hauptfrist       KalenderEintrag?  @relation("VorfristZuHauptfrist", fields: [hauptfristId], references: [id])
  vorfristEintraege KalenderEintrag[] @relation("VorfristZuHauptfrist")

  // NEW: Sachbearbeiter (in addition to verantwortlich)
  sachbearbeiterId String?

  // NEW: Recurring events
  serienId         String?         // Links recurring events
  serienRegel      String?         // Recurrence rule (RRULE format)

  // NEW: Document links
  dokumentIds      String[]        // IDs of linked Dokument records
}
```

### New Models
```prisma
model Briefkopf {
  id          String   @id @default(cuid())
  name        String   // e.g. "Hauptstandort", "Zweigstelle"
  dateipfad   String   // MinIO path to DOCX with headers/footers
  logoUrl     String?  // MinIO path to logo image
  kanzleiName String
  adresse     String?
  telefon     String?
  fax         String?
  email       String?
  website     String?
  steuernr    String?
  ustIdNr     String?
  iban        String?
  bic         String?
  bankName    String?
  braoInfo    String?  // BRAO regulatory info
  istStandard Boolean  @default(false) // Default letterhead
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model FristPreset {
  id              String   @id @default(cuid())
  name            String   // e.g. "Berufungsfrist"
  fristArt        String   // 'EREIGNISFRIST' | 'BEGINNFRIST'
  dauerWochen     Int?
  dauerMonate     Int?
  dauerTage       Int?
  istNotfrist     Boolean  @default(false)
  defaultVorfristen Int[]  // Default Vorfrist days, e.g. [7, 3, 1]
  kategorie       String?  // e.g. "ZPO", "StPO"
  beschreibung    String?
  sortierung      Int      @default(0)
  aktiv           Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model OrdnerSchema {
  id          String   @id @default(cuid())
  name        String   // e.g. "Zivilrecht Standard"
  sachgebiet  Sachgebiet?
  ordner      String[] // e.g. ["Schriftsaetze", "Korrespondenz", "Vollmachten", "Rechnungen"]
  istStandard Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### DokumentVorlage Enhancements
```prisma
model DokumentVorlage {
  // ... existing fields ...

  // NEW: Versioning
  version      Int      @default(1)
  // NEW: Tags for search
  tags         String[]
  // NEW: Freigabe workflow
  freigegeben  Boolean  @default(false)
  freigegebenVonId String?
  freigegebenAm DateTime?
  // NEW: Custom fields definition
  customFelder Json?    // Array of { key, label, typ, optionen }
  // NEW: Favorites tracking
  favoritenVon String[] // User IDs who favorited this template
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WOPI protocol for all OnlyOffice integrations | Callback API for self-hosted, WOPI only for external storage | OnlyOffice 6.4+ (2021) | Simpler integration, more features, less lock complexity |
| date.setMonth() for month arithmetic | date-fns addMonths() | Always (date-fns) | Correct month-end overflow handling |
| Single vorfrist field per deadline | Multiple vorfristen as array + as linked calendar entries | This phase | Proper 7/3/1 day reminder chain |
| Manual DOCX XML for letterheads | docxtemplater + PizZip for header/footer merge | Standard pattern | Reliable DOCX manipulation |

**Deprecated/outdated:**
- `document.key` with `Date.now()`: Must be replaced with version-based key for co-editing support
- Single `vorfrist` DateTime field on KalenderEintrag: Being replaced with `vorfristen` array + separate calendar entries

## Open Questions

1. **Backward calculation (Fristende -> spaetester Zustellungstermin)**
   - What we know: The FristenRechner must support both directions.
   - What's unclear: Backward calculation with Section 193 is ambiguous -- if the reverse-calculated date lands on a holiday, do we go to the previous or next business day? Legal precedent suggests the PREVIOUS business day (since that's the latest possible date).
   - Recommendation: Implement backward as inverse of forward, shifting to PREVIOUS business day on holiday/weekend.

2. **Oeffentliche Zustellung / Auslandszustellung special cases**
   - What we know: These are listed as "additional options" in the CONTEXT.
   - What's unclear: Exact calculation rules for EU-ZustVO differ from BGB. The delay for oeffentliche Zustellung is 1 month from Aushang.
   - Recommendation: Implement as additional FristArt options with their own calculation rules. Research EU-ZustVO Article 8-9 for international deadlines. These can be simplified first and enhanced later.

3. **Briefkopf DOCX header/footer merge complexity**
   - What we know: Headers/footers with images require relationship management in DOCX XML.
   - What's unclear: How well docxtemplater handles header/footer sections with images.
   - Recommendation: Test the header/footer merge with a real Briefkopf DOCX early. If PizZip manipulation proves too brittle, fall back to a full-template approach where Briefkopf is a complete DOCX template (not a merge).

4. **OnlyOffice Track Changes display in read-only mode**
   - What we know: Track Changes and Comments are supported in the Callback API.
   - What's unclear: Exact `customization.review` config structure for displaying tracked changes to reviewers.
   - Recommendation: Test with OnlyOffice DocumentServer instance during implementation. The review config is documented at api.onlyoffice.com.

## Sources

### Primary (HIGH confidence)
- [feiertagejs GitHub](https://github.com/sfakir/feiertagejs) - API, Bundesland codes, TypeScript types
- [feiertagejs npm](https://www.npmjs.com/package/feiertagejs) - Version, download stats, usage
- [OnlyOffice Callback Handler](https://api.onlyoffice.com/docs/docs-api/usage-api/callback-handler/) - Status codes, body format, forcesave
- [OnlyOffice Co-editing](https://api.onlyoffice.com/docs/docs-api/get-started/how-it-works/co-editing/) - document.key requirements, session management
- [OnlyOffice API vs WOPI](https://api.onlyoffice.com/docs/docs-api/using-wopi/api-vs-wopi/) - Feature comparison, limitations
- [OnlyOffice Conversion API](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/request/) - DOCX to PDF endpoint
- [docxtemplater Tag Types](https://docxtemplater.com/docs/tag-types/) - Conditions, loops, inverted sections (free features)
- [BGB Section 187 dejure.org](https://dejure.org/gesetze/BGB/187.html) - Ereignisfrist vs Beginnfrist
- [BGB Section 188 dejure.org](https://dejure.org/gesetze/BGB/188.html) - Fristende, month-end overflow rule
- [BGB Section 193 gesetze-im-internet.de](https://www.gesetze-im-internet.de/bgb/__187.html) - Weekend/holiday extension
- [Constellatio Fristen article](https://www.constellatio.de/artikel/fristen-187-ff-bgb) - Practical examples
- [OnlyOffice WOPI DeepWiki](https://deepwiki.com/ONLYOFFICE/DocumentServer/7.4-wopi-protocol) - Full WOPI endpoint specification

### Secondary (MEDIUM confidence)
- [LTO Fristenrechner](https://www.lto.de/juristen/rechner/fristenrechner) - Reference implementation for validation
- [OnlyOffice WOPI stale locks community](https://community.onlyoffice.com/t/how-to-handle-stale-locks-with-wopi/15154) - Lock management gotchas
- [Lecturio Fristberechnung](https://www.lecturio.de/mkt/jura-magazin/fristberechnung-187-188-bgb/) - Educational reference for BGB rules

### Tertiary (LOW confidence)
- Backward calculation rules for EU-ZustVO (needs further legal research)
- PDF/A support in OnlyOffice Conversion API (not explicitly confirmed in current docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed or well-documented with TypeScript support
- Architecture: HIGH - Existing codebase patterns well understood, OnlyOffice Callback API thoroughly documented
- FristenRechner logic: HIGH - BGB rules are well-defined, edge cases documented in legal literature
- WOPI/OnlyOffice fix: HIGH - Root cause identified (document.key), solution clear from official docs
- Briefkopf/PDF: MEDIUM - DOCX header/footer merge needs hands-on testing, Conversion API straightforward
- Pitfalls: HIGH - Multiple corroborating sources from legal and technical domains

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable domain -- German law and library APIs don't change frequently)
