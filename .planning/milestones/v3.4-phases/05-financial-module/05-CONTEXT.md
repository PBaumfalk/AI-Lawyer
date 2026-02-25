# Phase 5: Financial Module - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Full financial management for a German law firm: RVG fee calculation (Prozesskostenrechner), legally compliant invoice system with E-Rechnung (ZUGFeRD/XRechnung), Aktenkonto with Fremdgeld compliance, DATEV/SEPA export, bank statement import with matching, and time tracking. All integrated with cascading data flows between modules.

</domain>

<decisions>
## Implementation Decisions

### RVG Calculator / Prozesskostenrechner

#### Interaction Pattern
- Builder pattern: start with Streitwert, add VV positions one by one, running total updates live
- Quick presets for common combinations (e.g., "Typisches Klageverfahren": 3100+3104+7002) + manual add for custom
- Searchable dropdown for VV positions by number or keyword within manual add

#### Fee Calculation Features
- Auto-detect Anrechnung (VV Vorbem. 3 Abs. 4): highlighted notice with deduction, auto-applied, user can override
- Erhöhungsgebühr: user enters number of Auftraggeber, system calculates (0.3 per additional, max 2.0)
- Rahmengebühren: default to Mittelgebühr, user can adjust factor via slider/input within allowed range
- Auto-detect Wertgebühren vs Betragsrahmengebühren by VV number, UI adapts accordingly
- Auto-add VV 7002 (Auslagenpauschale 20%) and VV 7008 (19% USt) with toggle to disable
- Single Gegenstandswert/Streitwert input with per-position override for multi-issue cases
- Streitwertbeschluss: update mechanism — court-set Streitwert recalculates all fees, history tracks changes
- Include basic Honorarvereinbarung: "Freie Vergütung" line item with manual amount alongside RVG positions
- Include basic PKH/VKH: support PKH fee calculation with reduced tables (Betragsrahmengebühren)
- Reisekosten (VV 7003-7006): expandable section with km-Pauschale, Tage-/Abwesenheitsgeld
- Streitgenossenzuschlag (Nr. 1008) AND Mehrvergleich — bei Mehrvergleich wird Terminsgebühr (VV 3104) auf erhöhten Gegenstandswert (Streitwert + Mehrvergleich) berechnet
- Vergleichswertberechnung: User inputs Vergleichssumme, system calculates Mehrvergleich + Einigungsgebühr + angepasste Terminsgebühr automatisch
- Streitwert-Staffelung: collapsible chart showing fee changes at different Streitwert ranges
- Streitwert-Vorschläge: presets for common case types (Kündigungsschutz = 3x Monatsgehalt, Mietstreit = 12x Monatsmiete, etc.)
- Mahnverfahren: support Mahnverfahren fees (halbe Gebühr VV 3305/3307) + Übergang ins streitige Verfahren
- Verkehrsanwalt: split view showing own fees vs VA fees side by side

#### Full Prozesskostenrechner Scope
- Include GKG Gerichtskosten alongside RVG attorney fees for complete litigation cost overview
- Multi-Instanz support: 1. Instanz, Berufung, Revision — each with own VV positions, accumulated total
- Kostenvorschuss: collapsible section showing GKG Gerichtskostenvorschuss
- Quotelung: input Quotelung (e.g., 60%/40%), calculates cost allocation for court costs + attorney fees
- Erstattungsfähige Kosten: toggle view between "Eigene Kosten" and opponent perspective
- Kostenrisiko-Summary: client-facing export "Bei Obsiegen X, bei Unterliegen Y, bei Vergleich Z" as PDF

#### Calculator Result & Export
- Itemized table: VV position, description, Gebührensatz, amount, Anrechnung, subtotal + MwSt + Gesamtbetrag
- Copy as formatted text for Schriftsätze AND export as separate RVG-Berechnung PDF
- Festsetzungsantrag: generate formatted Kostenfestsetzungsantrag text from calculation
- Kostengrundentscheidung: generate text templates (volle Kostentragung, Quotelung, Vergleichskosten)
- Show comparison hint: link to DAV Prozesskostenrechner with pre-filled values for verification

#### Calculator Scope & Navigation
- Usable standalone (sidebar under 'Finanzen'/'Werkzeuge') AND from within Akte context
- In Akte context: Streitwert and Mandant auto-populate, result can be directly converted to invoice
- Calculations saved per Akte: history of calculations, re-open and modify
- Rate versioning: auto-select correct fee table by Auftragseingang date. Historical calculations stay on original rates (KostBRaeG 2025)

### Invoice System

#### Creation Flow
- Primary path: RVG calculation → 'Übernehmen als Rechnung' → pre-filled invoice with all positions
- One-click transfer: Mandant, Akte, all VV positions pre-filled, user adds Zahlungsziel and reviews
- Support free-text positions alongside RVG positions (Auslagen, Honorar, Kopierkosten)
- Rechnungsempfänger can differ from Mandant (RSV, Arbeitgeber, third-party payers)
- Sammelrechnungen: one invoice covering multiple Akten of same Mandant, grouped by Akte

#### Nummernkreis
- Configurable pattern: e.g., 'RE-{YEAR}-{SEQ:4}' → RE-2025-0001
- Atomic (no duplicates), auto-incrementing
- Optional reset per year
- Configurable in Kanzlei-Einstellungen

#### PDF & E-Rechnung
- Firm letterhead (Phase 2 Briefkopf) + clean itemized table with VV numbers, descriptions, amounts
- Footer: § 14 UStG info, Zahlungsziel, Bankverbindung
- Preview on demand (button to generate and view)
- Every invoice PDF is automatically ZUGFeRD PDF/A-3 with embedded XML
- XRechnung CII as separate download option
- No Begleitschreiben in invoice PDF (separate documents)

#### Status Flow
- Linear: Entwurf → Gestellt (with confirmation + Rechnungsdatum lock) → Bezahlt → Storniert
- Each transition logged
- Stornierung creates formal Stornorechnung/Gutschrift with own number (GS-YEAR-SEQ)
- Korrekturrechnungen for minor fixes (references original, shows delta) — only for Entwurf/Gestellt
- Teilzahlung: track multiple partial payments, show Restbetrag, auto-transition to Bezahlt when full
- Vorschussrechnungen: mark as Vorschuss, track payments, final invoice shows Vorschuss as Abzugsposition

#### USt & Compliance
- Per-position USt-Satz (0%, 7%, 19%) — handles mixed scenarios
- USt summary at invoice bottom shows breakdown by rate
- UStVA-relevant data tracking: Bemessungsgrundlage and USt per Satz per invoice, period-exportable
- Aufbewahrungsfrist tracker: after 10 years flag as 'Löschbar' (advisory, no auto-delete)

#### Mahnwesen
- Track Zahlungsziel, show alert on overdue
- Generate Mahnung (1., 2., 3.) from templates, track Mahnstatus per invoice
- Überfällig-Eskalation: green (within term), yellow (1-14d), orange (15-30d), red (30+d)
- Zahlungserinnerung: 3 days before Zahlungsziel → friendly reminder

#### Invoice List & Operations
- Full filters: Status, date range, Mandant, Akte, amount range, überfällig
- Search by Rechnungsnummer or Mandant name, sortable columns
- Summary cards at top: Gesamtumsatz (period), offene Forderungen, überfällige Beträge, Stornoquote
- Batch operations: select multiple → 'Alle stellen', 'PDFs herunterladen', 'Mahnungen senden'
- Track delivery preference per Mandant (Email, Post, Portal) — shown on invoice, manual send

#### Recurring Invoices
- Define recurring invoice template with interval (monthly, quarterly)
- Auto-generate draft invoices on schedule, user reviews and sends

#### BGH-Compliance: Stundenhonorar
- **Monatliche Abrechnung ist Pflicht bei Honorarvereinbarung mit Stundensatzhonorar (BGH)**
- System enforces/warns monthly billing for Stundenhonorar-Akten
- Month-end: automatic reminder "Stundenhonorar-Akten abrechnen"
- Show list of Stundenhonorar-Akten not yet billed for current month

### Aktenkonto & Fremdgeld

#### Layout
- Top: summary cards (Saldo, Fremdgeld, Offene Forderungen, Auslagen)
- Below: chronological ledger table with all bookings (Einnahme/Ausgabe/Fremdgeld/Auslage) and running balance
- Dedicated Fremdgeld section/tab, color-coded (e.g., blue/purple)

#### Booking Model
- Append-only with Storno: entries cannot be edited, corrections via Stornobuchung + new booking
- Manual booking entries supported: select Buchungsart, enter amount, description, date, optional Beleg reference
- Configurable Kostenstellen/Kategorien (admin-defined, e.g., 'Büromiete', 'Gerichtskosten')
- Every booking links to source document (clickable: Invoice, bank transaction, Beleg)

#### Fremdgeld Compliance
- 5-Werktage Weiterleitungsfrist: red banner on Aktenkonto + global 'Fristen & Warnungen' widget, countdown
- 15k EUR Anderkonto threshold: prominent warning when total Fremdgeld approaches limit, explanation linked
- Warn + require reason to override for non-compliant actions (logged for audit)
- Fremdgeld-Weiterleitung workflow: click 'Weiterleiten' → pre-filled SEPA transfer → auto-books Fremdgeld-Ausgabe
- Track Geschäftskonto vs Anderkonto per booking, reconciliation view between accounts
- Automatic Fremdgeld detection in bank imports via keywords in Verwendungszweck

#### Financial Tracking
- Vorschuss-Saldo tracking: pre-payments vs invoiced amounts
- Auslage-Tracking with Beleg upload (receipts in MinIO)
- Profitability view: Honorareinnahmen vs Zeitaufwand (Stundensatz × Stunden) + Auslagen → effektiver Stundensatz
- Cross-Akte Kostenausgleich: transfer between Akten of same Mandant as linked Umbuchung
- Abrechnung-Wizard: 'Akte abrechnen' → shows unbilled items → generates draft invoice

#### Periods & Compliance
- Buchungsperioden with period locking: ADMIN can close months, no backdating into closed periods
- Jahresabschluss: per-Akte + firm-wide annual report with carry-over Saldo, PDF exportable
- Kontoauszug export per case as formatted PDF
- Full audit trail: every booking, Storno, period lock, override logged with user, timestamp, reason

#### Access Control
- ANWALT + SACHBEARBEITER: all bookings
- SEKRETARIAT: Einnahme/Ausgabe but not Fremdgeld
- PRAKTIKANT: read-only
- ADMIN: full access + period locking

### Banking & SEPA

#### Bank Statement Import
- File upload (CSV + CAMT053) with format auto-detection (Sparkasse, VR, Deutsche Bank etc.)
- FinTS/HBCI integration for automatic daily sync (premium option)
- Duplicate detection: hash-based, flag potential duplicates for confirmation
- Multiple bank accounts supported (Geschäftskonto, Anderkonto, weitere)

#### Invoice Matching
- Suggestion cards: per transaction, show matching invoice(s) with confidence score
- Match by: Rechnungsnummer in Verwendungszweck, exact amount, Mandant name
- Pattern learning: system learns from confirmed matches (recurring senders, patterns, amounts)
- Unmatched → 'Zuzuordnen' queue with badge: assign to Akte, mark as Privatentnahme/Nicht relevant

#### Cascading Data Flow
- Bank match confirmed → auto-mark invoice as paid → auto-book Einnahme in Aktenkonto (one confirmation)
- Zahlungsavis: in-app notification to Sachbearbeiter when payment matched to invoice

#### SEPA
- pain.001 (credit transfer): generated from payment queue (Fremdgeld-Weiterleitung, Erstattung, etc.), batch or single
- pain.008 (direct debit): SEPA-Lastschriftmandate per Mandant, generate collection files, track mandate status

#### DATEV Export
- Period-based Buchungsstapel CSV with EXTF_ header
- Configurable Kontenrahmen mapping (SKR03/SKR04 presets), admin maps categories to Sachkonten
- Include Belegbilder (Rechnungs-PDFs, Quittungen) — DATEV Unternehmen Online format
- Scheduled monthly auto-export: generate, notify ADMIN for review, auto-send to Steuerberater after approval

#### Bank Reconciliation
- Kontostand comparison: system balance vs bank balance with diff view
- Highlight discrepancies, drill down to missing/duplicate transactions

#### Kassenbuch
- Digital Kassenbuch for Barein-/auszahlungen
- GoBD-compliant numbering, PDF export, integrates with DATEV export

### Zeiterfassung (Time Tracking)

#### Auto-Tracking
- Timer starts automatically when opening ANY Akte — always, regardless of billing type (RVG or Stundenhonorar)
- One active timer at a time, quick switch: 'Switch to Akte X' pauses current, starts new
- Sidebar widget shows active timer

#### Akte-Specific Behavior
- **Stundenhonorar-Akten**: when leaving the Akte, user MUST describe what they did (Pflichtangabe)
- **Termine**: when marking a Termin as erledigt, user must enter Start- and Endzeit
- Optional: Reisezeiten can be entered additionally

#### Manual Entry
- Also supports manual time entry: date, Akte, hours, description
- Configurable Tätigkeitskategorien (Schriftsatz, Telefonat, Besprechung, Recherche, Gericht, etc.)
- Billable/non-billable flag per entry, default set per category
- Per-user Stundensatz with per-Akte override (Honorarvereinbarung rate)

#### Time → Invoice Flow
- For Stundenhonorar-Akten: 'Abrechnen' pulls all unbilled time entries, calculates total (hours × rate)
- Pre-fills invoice with line items per Tätigkeit or aggregated
- **BGH-Pflicht**: monthly billing enforced for Stundenhonorar — reminder at month-end

### Reporting & Analytics

#### Reports Available
- Umsatzstatistik: revenue by period, Sachbearbeiter, Rechtsgebiet, Mandant, year-over-year comparison
- Forderungs-Aging: open invoices by age (0-30, 30-60, 60-90, 90+ Tage), per Mandant and total
- Zeitauswertung: hours per Sachbearbeiter/Akte/Kategorie, billable vs non-billable ratio
- Profitabilitätsanalyse: effektiver Stundensatz per Akte/Sachbearbeiter/Rechtsgebiet
- Rechtsgebiet-Performance: Umsatz, Ø Streitwert, Ø Honorar, Ø Zeitaufwand, Profitabilität comparison
- Sachbearbeiter-Ranking: Umsatz, Stunden, Auslastung per person (ADMIN/Partner only)

#### Export & Delivery
- All reports exportable as PDF (branded header) + Excel/CSV
- Configurable scheduled reports: monthly, weekly — auto-generate PDF, optional email notification

#### Dashboard
- Kanzlei-Dashboard with configurable widgets: Umsatz MTD/YTD, offene Forderungen, überfällige Rechnungen, Fremdgeld-Warnungen, Zeiterfassung today
- Widgets rearrangeable per user

#### Access Control
- ADMIN: all reports
- ANWALT: own + team reports
- SACHBEARBEITER: own Zeitauswertung + assigned Akten
- SEKRETARIAT/PRAKTIKANT: no financial reports

### Kanzlei-Settings & Configuration

- Dedicated 'Finanzen' section in Kanzlei-Einstellungen with sub-pages
- Sub-pages: Nummernkreis, Kontenrahmen/DATEV, Bankverbindungen, Stundensätze, Kostenstellen, Tätigkeitskategorien, Zahlungsziele, Mahnwesen
- Setup-Wizard for initial configuration: Bankverbindung → Nummernkreis → SKR03/04 → Standard-Stundensätze → USt-Einstellung
- All settings changes audit-logged (who, when, old value, new value)
- Default Zahlungsziel: global default + per-Mandant override
- Feiertag/Arbeitstage-Kalender: Bundesland-aware + custom freie Tage

### Workflow Automation

- Predefined rules only (no custom rule builder), all configurable/toggleable
- Available automations:
  - Mahnwesen-Eskalation: auto-generate 1./2./3. Mahnung nach Fristen, review before sending
  - Fremdgeld-Fristwarnung: 5-Werktage countdown, day 3 warning, day 5 urgent + SEPA suggestion
  - DATEV-Monatsexport: auto-generate at month-end, notify ADMIN, auto-send after approval
  - Zahlungserinnerung: 3 days before term → reminder, on due date → fällig, after → Mahnwesen
  - Stundenhonorar-Monatsabrechnung: BGH-Pflicht reminder at month-end
- Approval model: internal actions auto-execute, external actions (Mahnung senden, SEPA, StB export) require human confirmation

### Integration & Data Flow

- RVG Calculator → Invoice: one-click 'Übernehmen als Rechnung', all positions pre-filled
- Invoice → Aktenkonto: auto-book on status change (Gestellt → Forderung, Bezahlt → Einnahme, Storno → Stornobuchung)
- Banking Import → Invoice → Aktenkonto: cascading auto-booking on match confirmation
- Zeiterfassung → Invoice: for Stundenhonorar-Akten, pull unbilled time entries into invoice

### Claude's Discretion
- Exact UI component choices and spacing/typography
- Loading states and skeleton designs
- Error state handling and fallback UX
- Technical implementation of pattern learning for bank matching
- Internal RVG table data structure and lookup optimization
- Compression algorithm for exports
- Exact progress indicator implementations

</decisions>

<specifics>
## Specific Ideas

- "Wie der DAV Prozesskostenrechner, aber besser integriert" — link for verification, but calculations inline
- Bei Mehrvergleich MUSS die Terminsgebühr auf den erhöhten Gegenstandswert angepasst werden (explizite Anforderung)
- BGH-Rechtsprechung: Monatliche Abrechnung bei Honorarvereinbarung mit Stundensatzhonorar ist Pflicht — System muss dies durchsetzen
- Zeiterfassung startet automatisch beim Öffnen jeder Akte (immer, unabhängig von Abrechnungsart)
- Bei Stundenhonorar-Akten: Pflichtangabe der Tätigkeit beim Verlassen der Akte
- Bei Termin-Erledigung: Start- und Endzeit sind Pflichtfelder
- Reisezeiten optional zusätzlich erfassbar
- Append-only Buchungsmodell (wie echte Buchhaltung) — keine nachträgliche Bearbeitung, nur Stornobuchungen
- Rechnungs-PDF immer automatisch als ZUGFeRD PDF/A-3

</specifics>

<deferred>
## Deferred Ideas

- Custom automation rule builder (IF/THEN engine) — future phase
- Begleitschreiben als erste Seite im Rechnungs-PDF — out of scope (separate Dokumente)
- Full FinTS/HBCI bank API integration could be complex — file upload is MVP, FinTS as enhancement

</deferred>

---

*Phase: 05-financial-module*
*Context gathered: 2026-02-24*
