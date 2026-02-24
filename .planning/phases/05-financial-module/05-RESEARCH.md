# Phase 5: Financial Module - Research

**Researched:** 2026-02-24
**Domain:** German legal fee calculation (RVG/GKG), invoicing (UStG/E-Rechnung), Aktenkonto/Fremdgeld compliance, DATEV/SEPA export, bank import, time tracking
**Confidence:** MEDIUM-HIGH

## Summary

The financial module is the most complex phase yet, spanning six major subdomains: RVG fee calculation with GKG court costs, a legally compliant invoice system with E-Rechnung (ZUGFeRD/XRechnung), an append-only Aktenkonto with Fremdgeld compliance, DATEV export, SEPA XML generation, and time tracking. The RVG calculator is the centerpiece -- it requires precise implementation of the KostBRaeG 2025 fee table (Anlage 2 zu SS 13 RVG), the VV Vergutungsverzeichnis fee rate catalog, and the Anrechnung algorithm (Vorbem. 3 Abs. 4). For E-Rechnung, two viable Node.js libraries exist: `@e-invoice-eu/core` (v2.3.1, mature, full EN16931 support) and `node-zugferd` (v0.1.0, WIP but clean API). DATEV export follows the well-documented EXTF_ CSV format (version 700), and SEPA XML generation is handled by the mature `sepa` npm package (v2.1.0). The existing Prisma schema already has skeleton models for Rechnung, AktenKontoBuchung, and Zeiterfassung that need significant expansion.

**Primary recommendation:** Build the RVG fee table as versioned JSON data with an algorithmic calculator (not hardcoded lookup), use `@e-invoice-eu/core` for E-Rechnung generation (most mature), `sepa` for SEPA XML, and a custom DATEV EXTF_ CSV writer following the official specification. Expand the existing Prisma models substantially.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### RVG Calculator / Prozesskostenrechner
- Builder pattern: start with Streitwert, add VV positions one by one, running total updates live
- Quick presets for common combinations (e.g., "Typisches Klageverfahren": 3100+3104+7002) + manual add for custom
- Searchable dropdown for VV positions by number or keyword within manual add
- Auto-detect Anrechnung (VV Vorbem. 3 Abs. 4): highlighted notice with deduction, auto-applied, user can override
- Erhoehungsgebuehr: user enters number of Auftraggeber, system calculates (0.3 per additional, max 2.0)
- Rahmengebuehren: default to Mittelgebuehr, user can adjust factor via slider/input within allowed range
- Auto-detect Wertgebuehren vs Betragsrahmengebuehren by VV number, UI adapts accordingly
- Auto-add VV 7002 (Auslagenpauschale 20%) and VV 7008 (19% USt) with toggle to disable
- Single Gegenstandswert/Streitwert input with per-position override for multi-issue cases
- Streitwertbeschluss: update mechanism -- court-set Streitwert recalculates all fees, history tracks changes
- Include basic Honorarvereinbarung: "Freie Verguetung" line item with manual amount alongside RVG positions
- Include basic PKH/VKH: support PKH fee calculation with reduced tables (Betragsrahmengebuehren)
- Reisekosten (VV 7003-7006): expandable section with km-Pauschale, Tage-/Abwesenheitsgeld
- Streitgenossenzuschlag (Nr. 1008) AND Mehrvergleich -- bei Mehrvergleich wird Terminsgebuehr (VV 3104) auf erhoehten Gegenstandswert (Streitwert + Mehrvergleich) berechnet
- Vergleichswertberechnung: User inputs Vergleichssumme, system calculates Mehrvergleich + Einigungsgebuehr + angepasste Terminsgebuehr automatisch
- Streitwert-Staffelung: collapsible chart showing fee changes at different Streitwert ranges
- Streitwert-Vorschlaege: presets for common case types (Kuendigungsschutz = 3x Monatsgehalt, Mietstreit = 12x Monatsmiete, etc.)
- Mahnverfahren: support Mahnverfahren fees (halbe Gebuehr VV 3305/3307) + Uebergang ins streitige Verfahren
- Verkehrsanwalt: split view showing own fees vs VA fees side by side
- Full Prozesskostenrechner: GKG Gerichtskosten alongside RVG, Multi-Instanz (1. Instanz, Berufung, Revision), Kostenvorschuss, Quotelung, Erstattungsfaehige Kosten, Kostenrisiko-Summary PDF
- Calculator Result: itemized table, copy as formatted text, export as PDF, Festsetzungsantrag, Kostengrundentscheidung, DAV Prozesskostenrechner comparison link
- Calculator Scope: standalone under Finanzen AND from within Akte context, calculations saved per Akte, rate versioning by Auftragseingang date

#### Invoice System
- Primary path: RVG calculation -> 'Uebernehmen als Rechnung' -> pre-filled invoice
- Support free-text positions, different Rechnungsempfaenger, Sammelrechnungen
- Configurable Nummernkreis pattern (e.g., 'RE-{YEAR}-{SEQ:4}'), atomic, auto-incrementing
- PDF with firm letterhead (Phase 2 Briefkopf) + clean itemized table
- Every invoice PDF automatically ZUGFeRD PDF/A-3 with embedded XML
- XRechnung CII as separate download option
- Status: Entwurf -> Gestellt -> Bezahlt -> Storniert, each transition logged
- Stornierung creates Stornorechnung/Gutschrift, Korrekturrechnungen for minor fixes
- Teilzahlung tracking, Vorschussrechnungen
- Per-position USt-Satz (0%, 7%, 19%), USt summary, UStVA-relevant data
- Aufbewahrungsfrist tracker (10 years)
- Mahnwesen (1./2./3. Mahnung), Ueberfaellig-Eskalation, Zahlungserinnerung
- Invoice list with filters, summary cards, batch operations
- Track delivery preference per Mandant
- Recurring invoices with auto-generated drafts
- BGH-Compliance: monthly billing enforcement for Stundenhonorar-Akten

#### Aktenkonto & Fremdgeld
- Summary cards + chronological ledger with running balance
- Dedicated Fremdgeld section/tab, color-coded
- Append-only with Storno: no edits, only Stornobuchung + new booking
- Manual booking entries, configurable Kostenstellen/Kategorien
- Every booking links to source document
- 5-Werktage Weiterleitungsfrist: red banner + global widget + countdown
- 15k EUR Anderkonto threshold warning
- Fremdgeld-Weiterleitung workflow with pre-filled SEPA
- Track Geschaeftskonto vs Anderkonto, reconciliation view
- Automatic Fremdgeld detection in bank imports
- Vorschuss-Saldo, Auslage-Tracking with Beleg upload
- Profitability view, Cross-Akte Kostenausgleich, Abrechnung-Wizard
- Buchungsperioden with period locking, Jahresabschluss, Kontoauszug export
- Full audit trail
- Access control: ANWALT+SACHBEARBEITER all, SEKRETARIAT no Fremdgeld, PRAKTIKANT read-only, ADMIN full+period lock

#### Banking & SEPA
- Bank statement import (CSV + CAMT053) with format auto-detection
- Duplicate detection (hash-based)
- Multiple bank accounts (Geschaeftskonto, Anderkonto)
- Invoice matching with confidence scores (Rechnungsnummer, amount, Mandant name)
- Pattern learning from confirmed matches
- Cascading data flow: bank match -> auto-mark paid -> auto-book Aktenkonto
- SEPA pain.001 (credit transfer) and pain.008 (direct debit)
- DATEV period-based Buchungsstapel CSV with EXTF_ header
- Configurable Kontenrahmen mapping (SKR03/SKR04)
- Bank reconciliation view
- Digital Kassenbuch

#### Zeiterfassung
- Timer starts automatically when opening ANY Akte
- One active timer at a time, quick switch
- Stundenhonorar-Akten: MUST describe activity when leaving
- Termine: must enter Start-/Endzeit when marking erledigt
- Manual time entry with configurable Taetigkeitskategorien
- Billable/non-billable flag, per-user Stundensatz with per-Akte override
- Time -> Invoice flow for Stundenhonorar-Akten
- BGH-Pflicht: monthly billing reminder

#### Reporting & Analytics
- Umsatzstatistik, Forderungs-Aging, Zeitauswertung, Profitabilitaetsanalyse, Rechtsgebiet-Performance, Sachbearbeiter-Ranking
- Export as PDF + Excel/CSV, scheduled reports
- Kanzlei-Dashboard with configurable widgets
- Access control per role

#### Kanzlei-Settings & Configuration
- Dedicated Finanzen section with sub-pages
- Setup-Wizard for initial configuration
- All settings audit-logged
- Feiertag/Arbeitstage-Kalender: Bundesland-aware

#### Workflow Automation
- Predefined rules only (no custom rule builder)
- Mahnwesen-Eskalation, Fremdgeld-Fristwarnung, DATEV-Monatsexport, Zahlungserinnerung, Stundenhonorar-Monatsabrechnung
- Approval model: internal auto, external requires human confirmation

### Claude's Discretion
- Exact UI component choices and spacing/typography
- Loading states and skeleton designs
- Error state handling and fallback UX
- Technical implementation of pattern learning for bank matching
- Internal RVG table data structure and lookup optimization
- Compression algorithm for exports
- Exact progress indicator implementations

### Deferred Ideas (OUT OF SCOPE)
- Custom automation rule builder (IF/THEN engine) -- future phase
- Begleitschreiben als erste Seite im Rechnungs-PDF -- out of scope (separate Dokumente)
- Full FinTS/HBCI bank API integration -- file upload is MVP, FinTS as enhancement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-FI-001 | RVG-Berechnung: Streitwert -> Gebuehrenvorschlag mit VV-Nummern (3100, 3104, 1000/1003, 7002, 1008 etc.), KostBRaeG 2025 Saetze, Anrechnung VV Vorbem. 3 Abs. 4 | SS 13 RVG algorithmic step table fully documented; VV catalog with fee rates extracted; Anrechnung half-credit + 0.75 cap algorithm verified; GKG Anlage 2 table complete |
| REQ-FI-002 | RVG-Gebuehrentabelle als versionierte Daten mit Gueltigkeitszeitraeumen | SS 13 RVG step algorithm enables computation from parameters; JSON data structure recommended with validity dates; KostBRaeG 2025 rates effective 2025-06-01 |
| REQ-FI-003 | Rechnungen: DB-Model, Nummernkreis (atomare Vergabe), Status-Flow (Entwurf -> Gestellt -> Bezahlt -> Storniert), SS 14 UStG Pflichtfelder | PostgreSQL advisory locks or serialized counter table for gap-free Nummernkreis; SS 14 UStG field requirements documented; existing Rechnung model needs expansion |
| REQ-FI-004 | Rechnungs-PDF mit Briefkopf | Existing Phase 2 Briefkopf system (docxtemplater + OnlyOffice); pdf-lib already in project for PDF generation |
| REQ-FI-005 | Aktenkonto: Buchungen (Einnahme/Ausgabe/Fremdgeld/Auslage), Saldo, Beleg-Verknuepfung | Existing AktenKontoBuchung model needs expansion; append-only pattern with Storno bookings |
| REQ-FI-006 | Fremdgeld-Compliance: 5-Werktage-Weiterleitungswarnung, separate Anzeige | BullMQ cron job for daily Fremdgeld deadline checks; existing feiertagejs for business day calculation |
| REQ-FI-007 | E-Rechnung: XRechnung (CII) + ZUGFeRD (PDF/A-3) Export | @e-invoice-eu/core v2.3.1 for EN16931 CII/UBL generation; node-zugferd v0.1.0 as alternative for PDF/A-3 embedding |
| REQ-FI-008 | DATEV CSV-Export (Buchungsstapel) | EXTF_ header format v700 documented; 86+ column Buchungsstapel specification; SKR03/04 mapping needed |
| REQ-FI-009 | SEPA pain.001 (Ueberweisungen) + pain.008 (Lastschriften) | sepa npm v2.1.0 supports pain.001.001.09 + pain.008.001.08; IBAN/CreditorID validation built-in |
| REQ-FI-010 | Banking-Import: CSV + CAMT053 | camtjs v0.0.7 for CAMT parsing (WIP but usable); CSV parsing via existing csv-parse or custom parser; hash-based dedup |
| REQ-FI-011 | Zeiterfassung: Timer + manuelle Eintraege + Auswertung pro Akte | Existing Zeiterfassung model needs extension (timer state, categories); real-time via existing Socket.IO |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdf-lib | ^1.17.1 | PDF generation for invoices and reports | Already in project; pure JS, no native deps |
| @e-invoice-eu/core | ^2.3.1 | ZUGFeRD (PDF/A-3) + XRechnung (CII/UBL) generation | Most mature Node.js EN16931 implementation; v2.3.1 (Feb 2026); 154 GitHub stars; supports all Factur-X/ZUGFeRD profiles |
| sepa | ^2.1.0 | SEPA pain.001 (credit transfer) + pain.008 (direct debit) XML | Actively maintained (Sep 2025); supports latest pain formats; built-in IBAN/CreditorID validation |
| date-fns | ^4.1.0 | Date arithmetic for Fristen, business days, periods | Already in project |
| feiertagejs | ^1.5.0 | German holiday calculation for business day arithmetic | Already in project |
| zod | ^3.23.8 | Schema validation for RVG data, invoice forms, settings | Already in project |
| docxtemplater | ^3.68.2 | Invoice PDF generation via Briefkopf templates | Already in project (Phase 2) |
| react-hook-form | ^7.54.1 | Complex form handling (calculator, invoice, settings) | Already in project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-zugferd | ^0.1.0 | Alternative ZUGFeRD PDF/A-3 embedding | If @e-invoice-eu/core has issues with PDF/A-3 embedding; simpler API for just ZUGFeRD |
| camtjs | ^0.0.7 | CAMT053 bank statement XML parsing | For CAMT053 import; humanized field names; Next.js compatible |
| Decimal.js or built-in Prisma Decimal | - | Precise financial arithmetic | All monetary calculations MUST use Decimal, never floating point |
| recharts or similar | latest | Financial charts and reports | Dashboard widgets, Streitwert-Staffelung chart |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @e-invoice-eu/core | node-zugferd | node-zugferd has cleaner API but is v0.1.0 WIP; @e-invoice-eu is mature v2.3.1 with battle-tested PDF/A support |
| Custom DATEV writer | No npm package exists | DATEV EXTF format is well-documented but no Node.js library; custom CSV writer is the standard approach |
| camtjs | Custom XML parser (fast-xml-parser) | camtjs is WIP (v0.0.7) with only CAMT052 stable; may need custom CAMT053 parser if camtjs proves insufficient |
| sepa | sepa-xml | sepa-xml is older (pain.001.001.03); sepa.js supports newer formats |

**Installation:**
```bash
npm install @e-invoice-eu/core sepa camtjs
```

Note: pdf-lib, date-fns, feiertagejs, zod, docxtemplater, react-hook-form already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── finance/
│   │   ├── rvg/
│   │   │   ├── fee-table.ts           # RVG Anlage 2 fee table data (versioned)
│   │   │   ├── gkg-table.ts           # GKG Anlage 2 court fee table data
│   │   │   ├── vv-catalog.ts          # VV Vergütungsverzeichnis positions catalog
│   │   │   ├── calculator.ts          # Core RVG calculator engine
│   │   │   ├── anrechnung.ts          # Anrechnung algorithm (Vorbem. 3 Abs. 4)
│   │   │   ├── pkh.ts                 # PKH/VKH reduced fee tables (§49 RVG)
│   │   │   ├── presets.ts             # Quick presets (Klageverfahren, etc.)
│   │   │   └── types.ts              # TypeScript types for RVG domain
│   │   ├── invoice/
│   │   │   ├── nummernkreis.ts        # Atomic invoice number generation
│   │   │   ├── pdf-generator.ts       # Invoice PDF with Briefkopf
│   │   │   ├── e-rechnung.ts          # ZUGFeRD + XRechnung generation
│   │   │   ├── status-machine.ts      # Invoice status flow
│   │   │   └── types.ts
│   │   ├── aktenkonto/
│   │   │   ├── booking.ts             # Append-only booking logic
│   │   │   ├── fremdgeld.ts           # Fremdgeld compliance checks
│   │   │   ├── saldo.ts              # Balance calculation
│   │   │   └── types.ts
│   │   ├── banking/
│   │   │   ├── csv-parser.ts          # Bank CSV import (multi-format)
│   │   │   ├── camt-parser.ts         # CAMT053 XML import
│   │   │   ├── matcher.ts            # Invoice matching algorithm
│   │   │   ├── dedup.ts              # Hash-based duplicate detection
│   │   │   └── types.ts
│   │   ├── export/
│   │   │   ├── datev.ts              # DATEV EXTF_ Buchungsstapel CSV
│   │   │   ├── sepa.ts              # SEPA pain.001/pain.008 wrapper
│   │   │   └── types.ts
│   │   └── time-tracking/
│   │       ├── timer.ts              # Timer state management
│   │       └── types.ts
│   └── ...
├── app/
│   ├── (dashboard)/
│   │   └── finanzen/
│   │       ├── page.tsx                # Dashboard overview
│   │       ├── rechner/page.tsx        # Standalone RVG calculator
│   │       ├── rechnungen/
│   │       │   ├── page.tsx            # Invoice list
│   │       │   ├── [id]/page.tsx       # Invoice detail
│   │       │   └── neu/page.tsx        # New invoice
│   │       ├── aktenkonto/page.tsx     # Cross-case Aktenkonto view
│   │       ├── banking/page.tsx        # Bank import & matching
│   │       ├── zeiterfassung/page.tsx  # Time tracking overview
│   │       ├── berichte/page.tsx       # Reports & analytics
│   │       └── einstellungen/page.tsx  # Financial settings
│   └── api/
│       └── finanzen/
│           ├── rvg/route.ts            # RVG calculation API
│           ├── rechnungen/
│           │   ├── route.ts            # Invoice CRUD
│           │   ├── [id]/
│           │   │   ├── route.ts        # Single invoice
│           │   │   ├── pdf/route.ts    # PDF generation
│           │   │   └── e-rechnung/route.ts  # E-Rechnung export
│           │   └── nummernkreis/route.ts
│           ├── aktenkonto/
│           │   ├── route.ts            # Bookings CRUD
│           │   └── [akteId]/route.ts   # Per-Akte bookings
│           ├── banking/
│           │   ├── import/route.ts     # Bank statement upload
│           │   ├── match/route.ts      # Invoice matching
│           │   └── reconcile/route.ts  # Reconciliation
│           ├── export/
│           │   ├── datev/route.ts      # DATEV export
│           │   └── sepa/route.ts       # SEPA generation
│           ├── zeiterfassung/route.ts  # Time entries
│           └── berichte/route.ts       # Reports
├── components/
│   └── finanzen/
│       ├── rvg-calculator.tsx          # Builder UI
│       ├── rvg-position-picker.tsx     # Searchable VV dropdown
│       ├── rvg-presets.tsx             # Quick preset buttons
│       ├── rvg-result-table.tsx        # Itemized result
│       ├── invoice-form.tsx            # Invoice editor
│       ├── invoice-list.tsx            # Invoice list with filters
│       ├── aktenkonto-ledger.tsx       # Chronological booking table
│       ├── fremdgeld-banner.tsx        # Compliance warnings
│       ├── bank-import-dialog.tsx      # Upload + matching UI
│       ├── timer-widget.tsx            # Sidebar timer
│       ├── dashboard-widgets.tsx       # KPI cards
│       └── ...
```

### Pattern 1: RVG Fee Table as Algorithmic Data

**What:** Instead of hardcoding a lookup table with every Streitwert-to-fee mapping, store the algorithmic parameters from SS 13 RVG and compute fees dynamically.
**When to use:** Always -- the table has a mathematical structure that is more maintainable as parameters.

```typescript
// src/lib/finance/rvg/fee-table.ts

interface FeeTableVersion {
  id: string;
  name: string;                    // e.g., "KostBRaeG 2025"
  validFrom: Date;                 // 2025-06-01
  validUntil: Date | null;         // null = current
  baseFee: number;                 // 51.50 (fee for values up to first step)
  steps: FeeTableStep[];
  minimumFee: number;              // 15.00
}

interface FeeTableStep {
  upTo: number;       // Streitwert upper bound for this bracket
  increment: number;  // Streitwert step size within bracket
  feePerStep: number; // Fee increase per step
}

// KostBRaeG 2025 (effective 2025-06-01)
const RVG_2025: FeeTableVersion = {
  id: "rvg-2025",
  name: "KostBRaeG 2025",
  validFrom: new Date("2025-06-01"),
  validUntil: null,
  baseFee: 51.50,       // up to 500 EUR
  steps: [
    { upTo: 2_000,    increment: 500,    feePerStep: 41.50 },
    { upTo: 10_000,   increment: 1_000,  feePerStep: 59.50 },
    { upTo: 25_000,   increment: 3_000,  feePerStep: 55.00 },
    { upTo: 50_000,   increment: 5_000,  feePerStep: 86.00 },
    { upTo: 200_000,  increment: 15_000, feePerStep: 99.50 },
    { upTo: 500_000,  increment: 30_000, feePerStep: 140.00 },
    { upTo: Infinity, increment: 50_000, feePerStep: 175.00 },
  ],
  minimumFee: 15.00,
};

/**
 * Compute the simple fee (1.0) for a given Gegenstandswert.
 * Multiply by Gebuehrensatz (e.g., 1.3) for actual fee.
 */
function computeBaseFee(streitwert: number, table: FeeTableVersion): number {
  if (streitwert <= 0) return table.minimumFee;
  if (streitwert <= 500) return table.baseFee;

  let fee = table.baseFee;
  let remaining = streitwert - 500;

  for (const step of table.steps) {
    const bracketSize = step.upTo - (streitwert - remaining);
    const stepsInBracket = Math.min(
      Math.ceil(remaining / step.increment),
      Math.ceil(bracketSize / step.increment)
    );
    fee += stepsInBracket * step.feePerStep;
    remaining -= stepsInBracket * step.increment;
    if (remaining <= 0) break;
  }

  return Math.max(fee, table.minimumFee);
}
```

### Pattern 2: VV Position Catalog with Metadata

**What:** The Verguetungsverzeichnis (VV) positions as a typed catalog with all metadata needed for calculation.

```typescript
// src/lib/finance/rvg/vv-catalog.ts

type FeeType = "wertgebuehr" | "betragsrahmen" | "festgebuehr" | "auslagen";

interface VVPosition {
  nr: string;           // "3100", "7002", etc.
  name: string;         // German name
  description: string;  // Detailed description
  feeType: FeeType;
  // For Wertgebuehren:
  defaultRate?: number;       // e.g., 1.3
  minRate?: number;           // e.g., 0.5 (for Rahmengebuehren)
  maxRate?: number;           // e.g., 2.5
  // For Betragsrahmengebuehren:
  minAmount?: number;
  maxAmount?: number;
  // For Auslagen:
  flatAmount?: number;        // e.g., max 20 EUR for 7002
  percentOfFees?: number;     // e.g., 0.20 for 7002
  perUnit?: number;           // e.g., 0.42 per km for 7003
  // Metadata:
  part: number;               // VV part (1-7)
  triggersAnrechnung?: boolean;
  anrechnungTarget?: string;  // VV nr this gets credited against
  isAutoAddable?: boolean;    // like 7002, 7008
  category: string;           // "verfahren", "termin", "einigung", etc.
}

// Example entries
const VV_CATALOG: VVPosition[] = [
  // Part 1 - Allgemeine Gebuehren
  { nr: "1000", name: "Einigungsgebuehr", feeType: "wertgebuehr",
    defaultRate: 1.5, part: 1, category: "einigung" },
  { nr: "1003", name: "Einigungsgebuehr (gerichtl.)", feeType: "wertgebuehr",
    defaultRate: 1.0, part: 1, category: "einigung" },
  { nr: "1008", name: "Erhoehungsgebuehr (Streitgenossen)", feeType: "wertgebuehr",
    defaultRate: 0.3, maxRate: 2.0, part: 1, category: "zuschlag" },

  // Part 2 - Aussergerichtliche Taetigkeit
  { nr: "2300", name: "Geschaeftsgebuehr", feeType: "wertgebuehr",
    defaultRate: 1.3, minRate: 0.5, maxRate: 2.5, part: 2,
    triggersAnrechnung: true, anrechnungTarget: "3100", category: "geschaeft" },

  // Part 3 - Zivilsachen
  { nr: "3100", name: "Verfahrensgebuehr (1. Instanz)", feeType: "wertgebuehr",
    defaultRate: 1.3, part: 3, category: "verfahren" },
  { nr: "3104", name: "Terminsgebuehr", feeType: "wertgebuehr",
    defaultRate: 1.2, part: 3, category: "termin" },
  { nr: "3200", name: "Verfahrensgebuehr (Berufung)", feeType: "wertgebuehr",
    defaultRate: 1.6, part: 3, category: "verfahren" },
  { nr: "3305", name: "Verfahrensgebuehr (Mahnverfahren)", feeType: "wertgebuehr",
    defaultRate: 1.0, part: 3, category: "mahnverfahren" },
  { nr: "3307", name: "Verfahrensgebuehr (Mahnverfahren Antragsgegner)", feeType: "wertgebuehr",
    defaultRate: 0.5, part: 3, category: "mahnverfahren" },

  // Part 7 - Auslagen
  { nr: "7002", name: "Auslagenpauschale Post/Telekommunikation", feeType: "auslagen",
    flatAmount: 20.00, percentOfFees: 0.20, part: 7, isAutoAddable: true, category: "auslagen" },
  { nr: "7003", name: "Fahrtkosten (eigenes Kfz)", feeType: "auslagen",
    perUnit: 0.42, part: 7, category: "reisekosten" },
  { nr: "7005", name: "Abwesenheitsgeld", feeType: "auslagen",
    minAmount: 30.00, maxAmount: 80.00, part: 7, category: "reisekosten" },
  { nr: "7008", name: "Umsatzsteuer", feeType: "auslagen",
    percentOfFees: 0.19, part: 7, isAutoAddable: true, category: "steuer" },
];
```

### Pattern 3: Anrechnung Algorithm

**What:** The half-credit rule from Vorbem. 3 Abs. 4 VV RVG.

```typescript
// src/lib/finance/rvg/anrechnung.ts

interface AnrechnungResult {
  geschaeftsgebuehrRate: number;  // e.g., 1.3
  halfRate: number;               // e.g., 0.65
  cappedRate: number;             // min(halfRate, 0.75) = 0.65
  creditAmount: number;           // cappedRate * baseFee
  verfahrensgebuehrReduced: number;
  notice: string;                 // Human-readable explanation
}

function calculateAnrechnung(
  geschaeftsgebuehrRate: number,
  verfahrensgebuehrRate: number,
  baseFee: number, // 1.0 fee for given Streitwert
): AnrechnungResult {
  const halfRate = geschaeftsgebuehrRate / 2;
  const cappedRate = Math.min(halfRate, 0.75);
  const creditAmount = cappedRate * baseFee;
  const originalVerfahren = verfahrensgebuehrRate * baseFee;
  const verfahrensgebuehrReduced = originalVerfahren - creditAmount;

  return {
    geschaeftsgebuehrRate,
    halfRate,
    cappedRate,
    creditAmount,
    verfahrensgebuehrReduced,
    notice: `Anrechnung gem. Vorbem. 3 Abs. 4 VV RVG: ` +
      `${geschaeftsgebuehrRate}-Geschaeftsgebuehr wird zur Haelfte ` +
      `(${halfRate}), hoechstens mit 0,75, auf die Verfahrensgebuehr angerechnet. ` +
      `Anrechnungsbetrag: ${creditAmount.toFixed(2)} EUR`,
  };
}
```

### Pattern 4: Atomic Nummernkreis with PostgreSQL

**What:** Gap-free invoice number generation using a dedicated counter table with serialized transactions.

```typescript
// src/lib/finance/invoice/nummernkreis.ts

// Prisma model needed:
// model Nummernkreis {
//   id        String @id @default(cuid())
//   prefix    String // e.g., "RE", "GS"
//   year      Int
//   sequence  Int    @default(0)
//   @@unique([prefix, year])
// }

async function getNextInvoiceNumber(
  tx: PrismaTransaction,
  prefix: string,
  year: number
): Promise<string> {
  // Use raw SQL with FOR UPDATE to lock the row
  const result = await tx.$queryRaw<[{ sequence: number }]>`
    INSERT INTO nummernkreise (id, prefix, year, sequence)
    VALUES (gen_random_uuid(), ${prefix}, ${year}, 1)
    ON CONFLICT (prefix, year)
    DO UPDATE SET sequence = nummernkreise.sequence + 1
    RETURNING sequence
  `;
  const seq = result[0].sequence;
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}
```

### Pattern 5: Append-Only Aktenkonto with Storno

**What:** Immutable booking ledger where corrections happen via Storno + new booking.

```typescript
// Bookings are NEVER updated or deleted
// To correct: create Storno booking (negates original) + new booking

async function stornoBooking(
  originalId: string,
  reason: string,
  userId: string,
): Promise<{ storno: AktenKontoBuchung; }> {
  const original = await prisma.aktenKontoBuchung.findUniqueOrThrow({
    where: { id: originalId },
  });

  // Create negating Storno entry
  const storno = await prisma.aktenKontoBuchung.create({
    data: {
      akteId: original.akteId,
      buchungstyp: original.buchungstyp,
      betrag: original.betrag.negated(), // Decimal negation
      verwendungszweck: `STORNO: ${original.verwendungszweck}`,
      stornoVon: original.id,
      stornoGrund: reason,
      gebuchtVon: userId,
    },
  });

  return { storno };
}
```

### Pattern 6: E-Rechnung Generation

**What:** Using @e-invoice-eu/core to generate ZUGFeRD PDF/A-3 and XRechnung CII.

```typescript
// src/lib/finance/invoice/e-rechnung.ts
// Conceptual -- exact API depends on @e-invoice-eu/core v2.3.1

import { EInvoice } from '@e-invoice-eu/core';

async function generateZugferd(
  invoiceData: InvoiceData,
  pdfBuffer: Buffer,
): Promise<Buffer> {
  const einvoice = new EInvoice();
  // Set invoice data conforming to EN16931
  einvoice.setFormat('factur-x-en16931');
  einvoice.setInvoiceData({
    id: invoiceData.rechnungsnummer,
    issueDate: invoiceData.rechnungsdatum,
    dueDate: invoiceData.faelligAm,
    seller: { /* Kanzlei data */ },
    buyer: { /* Mandant/Empfaenger data */ },
    lines: invoiceData.positionen.map(pos => ({
      description: pos.beschreibung,
      quantity: 1,
      unitPrice: pos.betrag,
      vatRate: pos.ustSatz,
    })),
    // ... more EN16931 fields
  });

  // Embed CII XML into PDF, converting to PDF/A-3
  return einvoice.generatePdfA3(pdfBuffer);
}

async function generateXRechnung(
  invoiceData: InvoiceData,
): Promise<string> {
  const einvoice = new EInvoice();
  einvoice.setFormat('xrechnung-cii');
  einvoice.setInvoiceData({ /* same data */ });
  return einvoice.generateXml(); // Returns CII XML string
}
```

### Anti-Patterns to Avoid

- **Floating-point arithmetic for money:** NEVER use JavaScript `number` for financial calculations. Always use Prisma Decimal (backed by PostgreSQL numeric) or a Decimal library. Even rounding 19% USt on 0.1 EUR gives wrong results with floats.
- **Mutable ledger entries:** The Aktenkonto MUST be append-only. Editing bookings violates GoBD and audit requirements. Always use Storno + re-book.
- **Hardcoded fee tables:** Store RVG/GKG tables as versioned data, not in code. KostBRaeG changes happen periodically and must be hot-swappable.
- **Non-atomic invoice numbers:** Using `MAX(sequence) + 1` in application code has race conditions. Always use PostgreSQL-level locking (UPSERT with RETURNING or advisory locks).
- **Generating E-Rechnung from scratch:** The EN16931/CII/ZUGFeRD standards are extremely complex with hundreds of fields and validation rules. Use a library, never hand-roll XML generation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZUGFeRD PDF/A-3 generation | Custom PDF metadata + XML embedding | @e-invoice-eu/core | PDF/A-3 requires ICC color profiles, XMP metadata extensions, specific attachment relationships -- dozens of edge cases |
| XRechnung CII XML | Custom XML builder | @e-invoice-eu/core | EN16931 has 200+ business rules, validation requirements, namespace handling |
| SEPA XML | Custom pain.001/008 XML | sepa (npm) | ISO 20022 XML schemas are complex, bank-specific validation varies |
| CAMT053 parsing | Custom XML-to-JSON | camtjs or fast-xml-parser with ISO 20022 types | ISO 20022 namespace handling, versioning, character encoding |
| RVG Anrechnung | Ad-hoc calculation | Dedicated algorithm module | Edge cases (multiple Gegenstandswerte, Rahmengebuehren, SS 15a ordering) are legally nuanced |
| Invoice number generation | Application-level MAX+1 | PostgreSQL UPSERT with RETURNING | Race conditions in concurrent invoice creation |
| Financial arithmetic | JavaScript number type | Prisma Decimal / Decimal.js | Floating point errors in money calculations |

**Key insight:** German legal finance has extremely precise requirements where small implementation errors have legal consequences (wrong fee = fee dispute, wrong Fremdgeld handling = Kammerdisziplinarverfahren). Use established libraries for standard formats and focus custom development on the business logic unique to this application.

## Common Pitfalls

### Pitfall 1: Floating-Point Money Calculations
**What goes wrong:** `0.1 + 0.2 !== 0.3` in JavaScript. USt calculations, fee multiplications, and saldo computations silently produce wrong results.
**Why it happens:** JavaScript `number` is IEEE 754 double-precision floating point.
**How to avoid:** Use Prisma's `Decimal` type (mapped to PostgreSQL `NUMERIC`) for all monetary fields. Use `Decimal.js` for client-side calculations. Round consistently using banker's rounding.
**Warning signs:** Penny discrepancies in totals, USt amounts not matching manual calculation.

### Pitfall 2: RVG Anrechnung Miscalculation
**What goes wrong:** Geschaeftsgebuehr not properly credited, or credited when it shouldn't be (different Gegenstandswert).
**Why it happens:** The half-credit rule with 0.75 cap only applies when the same Gegenstand goes from out-of-court to court. Multiple Gegenstandswerte require partial Anrechnung.
**How to avoid:** Always check: (1) Is it the SAME Gegenstand? (2) Apply half-credit. (3) Apply 0.75 cap. (4) Let user override. Validate against DAV Prozesskostenrechner for test cases.
**Warning signs:** Fee totals differ from DAV calculator; Anrechnung applied when Gegenstandswert differs.

### Pitfall 3: PDF/A-3 Compliance Failures
**What goes wrong:** ZUGFeRD PDFs fail validation (missing XMP metadata, wrong ICC profile, attachment relationship type).
**Why it happens:** pdf-lib alone cannot produce PDF/A-3 compliant documents. ZUGFeRD requires specific XMP extension schemas, sRGB ICC color profile embedding, and AFRelationship entries.
**How to avoid:** Use @e-invoice-eu/core which handles PDF/A-3 transformation. Validate output with official tools (KoSIT Validator, Mustang Validator).
**Warning signs:** ZUGFeRD PDFs rejected by Finanzamt or business partners, validation tool errors.

### Pitfall 4: DATEV Header Version Mismatch
**What goes wrong:** DATEV import fails silently or rejects the entire Buchungsstapel.
**Why it happens:** DATEV format is version-specific (currently v700). Wrong version number, missing semicolons, incorrect quoting, or wrong date format in header.
**How to avoid:** Use exact header format from DATEV Developer Portal. Version 700, Buchungsstapel category 21. Test import in DATEV Unternehmen Online sandbox.
**Warning signs:** Steuerberater reports import errors; bookings appear duplicated or missing.

### Pitfall 5: Fremdgeld Deadline Race Conditions
**What goes wrong:** 5-Werktage deadline not calculated correctly (weekends, holidays, partial business days).
**Why it happens:** Business day calculation must account for German federal holidays (Bundesland-specific) and weekends.
**How to avoid:** Use existing feiertagejs + date-fns for business day arithmetic. Run BullMQ cron job daily to check all open Fremdgeld entries. Store the calculated deadline date at booking time.
**Warning signs:** Warnings appear too late or not at all; false positives on holidays.

### Pitfall 6: Invoice Number Gaps Under Concurrent Access
**What goes wrong:** Two users creating invoices simultaneously get the same number, or a failed transaction creates a gap.
**Why it happens:** Application-level sequence generation without database-level locking.
**How to avoid:** Use PostgreSQL `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` in a single atomic query. The UPSERT pattern guarantees atomicity. Note: gaps from rolled-back transactions are legally acceptable in Germany.
**Warning signs:** Duplicate Rechnungsnummer errors; constraint violations in production.

## Code Examples

### DATEV EXTF Buchungsstapel CSV Generation

```typescript
// src/lib/finance/export/datev.ts

interface DatevHeader {
  formatVersion: number;     // 700
  dataCategory: number;      // 21 = Buchungsstapel
  formatName: string;        // "Buchungsstapel"
  formatVersion2: number;    // 13
  created: Date;
  advisor: string;           // Beraternummer
  client: string;            // Mandantennummer
  fiscalYearStart: Date;
  accountLength: number;     // 4
  periodStart: Date;
  periodEnd: Date;
  label: string;
  currency: string;          // "EUR"
  skr: string;               // "03" or "04"
}

function generateDatevHeader(h: DatevHeader): string {
  const ts = formatDatevTimestamp(h.created); // YYYYMMDDHHmmssSSS
  return [
    '"EXTF"', h.formatVersion, h.dataCategory,
    `"${h.formatName}"`, h.formatVersion2, ts,
    '', `"${h.advisor}"`, '""', '""',
    h.advisor, h.client,
    formatDatevDate(h.fiscalYearStart), h.accountLength,
    formatDatevDate(h.periodStart), formatDatevDate(h.periodEnd),
    `"${h.label}"`, '""', 1, 0, 0,
    `"${h.currency}"`, '', '""', '', '', `"${h.skr}"`, '', '', '""',
  ].join(';');
}

// Column header (line 2)
const DATEV_COLUMNS = [
  'Umsatz (ohne Soll/Haben-Kz)', 'Soll/Haben-Kennzeichen',
  'WKZ Umsatz', 'Kurs', 'Basis-Umsatz', 'WKZ Basis-Umsatz',
  'Konto', 'Gegenkonto (ohne BU-Schlüssel)', 'BU-Schlüssel',
  'Belegdatum', 'Belegfeld 1', 'Belegfeld 2', 'Skonto',
  'Buchungstext', /* ... 86+ columns total */
];

interface DatevBooking {
  amount: string;          // "24,95" (German decimal format)
  debitCredit: 'S' | 'H'; // Soll / Haben
  account: string;         // Sachkonto
  contraAccount: string;   // Gegenkonto
  buKey?: string;          // BU-Schluessel (tax code)
  date: Date;              // Belegdatum
  reference1?: string;     // Belegfeld 1 (Rechnungsnummer)
  text: string;            // Buchungstext (max 60 chars)
  costCenter1?: string;    // KOST1
}
```

### SEPA Credit Transfer (pain.001) Generation

```typescript
// src/lib/finance/export/sepa.ts
import SEPA from 'sepa';

function generateCreditTransfer(
  debtor: { name: string; iban: string; bic: string },
  payments: Array<{
    creditorName: string;
    creditorIban: string;
    creditorBic?: string;
    amount: number;
    reference: string;
    purpose: string;
  }>,
  executionDate: Date,
): string {
  const doc = new SEPA.Document('pain.001.001.09');
  doc.grpHdr.id = `SEPA-${Date.now()}`;
  doc.grpHdr.created = new Date();

  const info = doc.createPaymentInfo();
  info.requestedExecutionDate = executionDate;
  info.debtorName = debtor.name;
  info.debtorIBAN = debtor.iban;
  info.debtorBIC = debtor.bic;
  doc.addPaymentInfo(info);

  for (const payment of payments) {
    const tx = info.createTransaction();
    tx.creditorName = payment.creditorName;
    tx.creditorIBAN = payment.creditorIban;
    if (payment.creditorBic) tx.creditorBIC = payment.creditorBic;
    tx.amount = payment.amount;
    tx.remittanceInfo = payment.reference;
    tx.end2endId = payment.purpose;
    info.addTransaction(tx);
  }

  return doc.toString();
}
```

### GKG Court Fee Table

```typescript
// src/lib/finance/rvg/gkg-table.ts

interface GKGTableVersion {
  id: string;
  name: string;
  validFrom: Date;
  validUntil: Date | null;
  entries: Array<{ upTo: number; fee: number }>;
  aboveMaxFormula: { per: number; fee: number }; // above 500k: per 50k, 180 EUR
}

const GKG_2025: GKGTableVersion = {
  id: "gkg-2025",
  name: "KostBRaeG 2025",
  validFrom: new Date("2025-06-01"),
  validUntil: null,
  entries: [
    { upTo: 500, fee: 40.00 },
    { upTo: 1_000, fee: 61.00 },
    { upTo: 1_500, fee: 82.00 },
    { upTo: 2_000, fee: 103.00 },
    { upTo: 3_000, fee: 125.50 },
    { upTo: 4_000, fee: 148.00 },
    { upTo: 5_000, fee: 170.50 },
    { upTo: 6_000, fee: 193.00 },
    { upTo: 7_000, fee: 215.50 },
    { upTo: 8_000, fee: 238.00 },
    { upTo: 9_000, fee: 260.50 },
    { upTo: 10_000, fee: 283.00 },
    { upTo: 13_000, fee: 313.50 },
    { upTo: 16_000, fee: 344.00 },
    { upTo: 19_000, fee: 374.50 },
    { upTo: 22_000, fee: 405.00 },
    { upTo: 25_000, fee: 435.50 },
    { upTo: 30_000, fee: 476.00 },
    { upTo: 35_000, fee: 516.50 },
    { upTo: 40_000, fee: 557.00 },
    { upTo: 45_000, fee: 597.50 },
    { upTo: 50_000, fee: 638.00 },
    { upTo: 65_000, fee: 778.00 },
    { upTo: 80_000, fee: 918.00 },
    { upTo: 95_000, fee: 1_058.00 },
    { upTo: 110_000, fee: 1_198.00 },
    { upTo: 125_000, fee: 1_338.00 },
    { upTo: 140_000, fee: 1_478.00 },
    { upTo: 155_000, fee: 1_618.00 },
    { upTo: 170_000, fee: 1_758.00 },
    { upTo: 185_000, fee: 1_898.00 },
    { upTo: 200_000, fee: 2_038.00 },
    { upTo: 230_000, fee: 2_248.00 },
    { upTo: 260_000, fee: 2_458.00 },
    { upTo: 290_000, fee: 2_668.00 },
    { upTo: 320_000, fee: 2_878.00 },
    { upTo: 350_000, fee: 3_088.00 },
    { upTo: 380_000, fee: 3_298.00 },
    { upTo: 410_000, fee: 3_508.00 },
    { upTo: 440_000, fee: 3_718.00 },
    { upTo: 470_000, fee: 3_928.00 },
    { upTo: 500_000, fee: 4_138.00 },
  ],
  aboveMaxFormula: { per: 50_000, fee: 180.00 },
};

function computeGKGFee(streitwert: number, table: GKGTableVersion): number {
  // Direct lookup for values in the table
  const entry = table.entries.find(e => streitwert <= e.upTo);
  if (entry) return entry.fee;

  // Above 500k: formula-based
  const maxEntry = table.entries[table.entries.length - 1];
  const excess = streitwert - maxEntry.upTo;
  const extraSteps = Math.ceil(excess / table.aboveMaxFormula.per);
  return maxEntry.fee + extraSteps * table.aboveMaxFormula.fee;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RVG 2021 fee tables | KostBRaeG 2025 (+6% uniform increase) | 2025-06-01 | All fee amounts updated; must store both versions for historical calculations |
| Paper invoices or simple PDF | E-Rechnung mandatory B2B (EN16931) | 2025-01-01 | ZUGFeRD/XRechnung REQUIRED for B2B; receiving mandatory since 2025-01-01, sending by 2027/2028 |
| Custom ZUGFeRD XML | @e-invoice-eu/core v2.x | 2025 | Mature library handles EN16931 validation + PDF/A-3 + CII/UBL |
| SEPA pain.001.001.03 | SEPA pain.001.001.09 | 2024+ | Newer schema version; sepa npm v2.1.0 supports it |
| GKG max 500k table | GKG extended + formula above 500k | KostBRaeG 2025 | Fee table amounts updated by ~6% |
| SS 49 RVG PKH cap at 50k | PKH cap extended to 80k | KostBRaeG 2025 | More values now covered by reduced PKH table |

**Deprecated/outdated:**
- RVG 2021 table values: Replaced by KostBRaeG 2025 values. KEEP the old table for historical calculations where Auftragseingang was before 2025-06-01.
- SEPA pain.001.001.03: Still accepted by most banks but older. Use pain.001.001.09 from sepa v2.1.0.
- Manual E-Rechnung: From 2025-01-01, all businesses must be able to RECEIVE e-invoices. From 2027/2028, must also SEND. Building ZUGFeRD now is forward-looking.

## Open Questions

1. **@e-invoice-eu/core exact API for programmatic use**
   - What we know: v2.3.1 exists, supports all formats, has TypeScript types, uses pdf-lib internally
   - What's unclear: Exact programmatic API for generating invoices from JSON (not spreadsheet). Documentation is still WIP.
   - Recommendation: Install and test the library's `@e-invoice-eu/core` package directly. The internal JSON Invoice schema is exported. If the API is too spreadsheet-oriented, fall back to `node-zugferd` for PDF/A-3 + custom CII XML generation.

2. **CAMT053 parser maturity**
   - What we know: camtjs v0.0.7 exists, supports CAMT052 (WIP), claims CAMT053 support
   - What's unclear: Whether CAMT053 parsing is actually functional, what CAMT versions German banks use
   - Recommendation: Try camtjs first. If inadequate, use fast-xml-parser (already available via node-zugferd dep) with hand-defined CAMT053 type mappings. German banks typically use camt.053.001.02 or camt.053.001.08.

3. **DATEV EXTF complete column specification**
   - What we know: Header format v700, 86+ columns, basic structure clear from examples
   - What's unclear: Complete specification of all 86+ data columns (officially behind DATEV paywall)
   - Recommendation: Use the publicly available example CSV + community documentation. For MVP, implement the ~15 most commonly used columns (Umsatz, S/H, Konto, Gegenkonto, BU-Schluessel, Belegdatum, Belegfeld1, Buchungstext, KOST1). Steuerberater feedback will guide which additional columns are needed.

4. **PKH/VKH fee table (SS 49 RVG) exact values after KostBRaeG 2025**
   - What we know: Cap extended from 50k to 80k, 90% reimbursable for 4k-5k range (up from 85%), uniform ~6% increase
   - What's unclear: Exact table values for all brackets after KostBRaeG 2025
   - Recommendation: Fetch from official source (rvg-rechner.de/tabelle-nach-ss-49-rvg-2025/) during implementation. Store as versioned data like the main table.

## Existing Codebase Impact

### Prisma Schema Changes Needed

The existing schema has skeleton models that need SIGNIFICANT expansion:

**Rechnung model -- needs:**
- `empfaengerId` (can differ from Mandant)
- `positionen` JSON needs typed structure (VV-Nr, description, rate, amount, USt)
- `ustSummary` JSON for per-rate breakdown
- `zahlungsziel` (days, separate from faelligAm)
- `stornoVon` / `korrekturVon` references
- `teilzahlungen` relation
- `dokumentId` reference to generated PDF in DMS
- `mahnStatus` / `mahnStufe`
- `zustellart` (Email, Post, Portal)
- `isRecurring` / `recurringTemplateId`
- `isPkh` boolean

**AktenKontoBuchung model -- needs:**
- `gebuchtVon` (userId)
- `stornoVon` / `stornoGrund` (for Storno chain)
- `rechnungId` (link to invoice)
- `bankTransaktionId` (link to bank transaction)
- `dokumentId` (link to Beleg)
- `kostenstelle`
- `konto` (Geschaeftskonto vs Anderkonto)
- `periodeGesperrt` check
- `fremdgeldFrist` (deadline date)

**Zeiterfassung model -- needs:**
- `startzeit` / `endzeit` (for running timer)
- `isRunning` boolean
- `kategorie` (Schriftsatz, Telefonat, etc.)
- `abrechenbar` already exists
- `abgerechnet` boolean (linked to invoice)
- `rechnungId` reference

**New models needed:**
- `Nummernkreis` (prefix, year, sequence)
- `BankKonto` (name, IBAN, BIC, typ: GESCHAEFT/ANDERKONTO)
- `BankTransaktion` (imported transactions)
- `RvgBerechnung` (saved calculations per Akte)
- `Teilzahlung` (partial payments on invoices)
- `Mahnung` (dunning records)
- `Buchungsperiode` (period locking)
- `Kostenstelle` (configurable categories)
- `Taetigkeitskategorie` (time tracking categories)
- `RecurringInvoiceTemplate` (recurring invoice definitions)
- `FinanzEinstellung` (Nummernkreis config, Kontenrahmen, defaults)

### Kanzlei model -- needs:
- Additional bank accounts (relation to BankKonto)
- Default Zahlungsziel
- SKR selection (03 or 04)
- Default Stundensaetze

### Existing Infrastructure to Leverage
- **BullMQ**: Use for Fremdgeld deadline checks (daily cron), DATEV auto-export (monthly), Mahnwesen escalation, Stundenhonorar reminders
- **Socket.IO**: Real-time timer widget updates, payment notifications, Fremdgeld alerts
- **MinIO**: Beleg uploads, generated invoice PDFs, DATEV Belegbilder
- **Meilisearch**: Invoice search, bank transaction search
- **feiertagejs + date-fns**: Business day calculation for Fremdgeld 5-Werktage rule
- **docxtemplater + Phase 2 Briefkopf**: Invoice PDF generation with letterhead
- **AuditLog**: Already exists -- extend for financial audit trail

## Sources

### Primary (HIGH confidence)
- [gesetze-im-internet.de/rvg/__13.html](https://www.gesetze-im-internet.de/rvg/__13.html) - SS 13 RVG fee computation algorithm (official law text)
- [gesetze-im-internet.de/rvg/anlage_1.html](https://www.gesetze-im-internet.de/rvg/anlage_1.html) - Complete VV Vergutungsverzeichnis with all fee rates (official law text)
- [buzer.de/Anlage_2_GKG.htm](https://www.buzer.de/Anlage_2_GKG.htm) - Complete GKG court fee table (official law reference)
- [github.com/gflohr/e-invoice-eu](https://github.com/gflohr/e-invoice-eu) - @e-invoice-eu/core v2.3.1 (154 stars, active development)
- [github.com/kewisch/sepa.js](https://github.com/kewisch/sepa.js) - sepa v2.1.0 (99 stars, latest release Sep 2025)
- [github.com/jslno/node-zugferd](https://github.com/jslno/node-zugferd) - node-zugferd v0.1.0 (WIP, clean API)

### Secondary (MEDIUM confidence)
- [rvg-rechner.de/anrechnung-der-geschaeftsgebuehr](https://www.rvg-rechner.de/anrechnung-der-geschaeftsgebuehr/) - Anrechnung algorithm explanation with examples
- [rvg-rechner.de/tabelle-nach-ss-13-rvg-2025](https://www.rvg-rechner.de/tabelle-nach-%C2%A7-13-rvg-2025-2/) - KostBRaeG 2025 fee table with multiplier columns
- [developer.datev.de](https://developer.datev.de/datev/platform/en/dtvf) - DATEV EXTF format documentation
- [github.com/ledermann/datev](https://github.com/ledermann/datev/blob/master/examples/EXTF_Buchungsstapel.csv) - DATEV CSV example
- [anwaltsblatt.anwaltverein.de/de/apps/prozesskostenrechner](https://anwaltsblatt.anwaltverein.de/de/apps/prozesskostenrechner) - DAV Prozesskostenrechner (verification target)
- [stripe.com/resources/more/14-ustg](https://stripe.com/resources/more/14-ustg) - SS 14 UStG invoice requirements
- [cybertec-postgresql.com](https://www.cybertec-postgresql.com/en/postgresql-sequences-vs-invoice-numbers/) - PostgreSQL gap-free sequences

### Tertiary (LOW confidence)
- [github.com/proohit/camtjs](https://github.com/proohit/camtjs/) - camtjs v0.0.7 (WIP, CAMT053 support unclear)
- [rechnungswesenforum.de](https://www.rechnungswesenforum.de/forum/sonstiges/off-topic/datev-format-buchungsstapel-zum-uebergeben-von-buchungen-header-extf.556651/) - Community DATEV format discussion

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - core libraries verified via GitHub/npm, versions confirmed
- RVG/GKG tables: HIGH - extracted from official law sources (gesetze-im-internet.de)
- Anrechnung algorithm: MEDIUM-HIGH - verified through legal reference site, needs DAV calculator validation
- E-Rechnung toolchain: MEDIUM - @e-invoice-eu/core is mature but exact programmatic API needs testing
- DATEV format: MEDIUM - header structure verified, complete column spec partially behind paywall
- SEPA: HIGH - sepa npm is well-documented with clear API
- Architecture: HIGH - patterns follow established Prisma + Next.js patterns from prior phases
- Pitfalls: HIGH - drawn from domain expertise and verified gotchas

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (30 days -- stable domain, law changes are infrequent)
