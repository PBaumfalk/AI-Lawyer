# Requirements: AI-Lawyer v0.8

**Defined:** 2026-03-06
**Core Value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollständig im Browser verwalten, während eine autonome KI-Agentin aktenübergreifend lernt und als digitale Rechtsanwaltsfachangestellte mitarbeitet.

## v0.8 Requirements

### BI-Dashboard

- [ ] **BI-01**: User kann BI-Dashboard mit KPI-Kacheln (Akten, Finanzen, Fristen, Helena) aufrufen
- [ ] **BI-02**: User sieht Trend-Charts (Akten-Neuzugang, Umsatz pro Monat, Fristen-Compliance) als Line/Area Charts
- [ ] **BI-03**: User kann KPIs nach Zeitraum filtern (Monat, Quartal, Jahr, Custom DateRange)
- [ ] **BI-04**: User kann KPIs nach Verantwortlichem (Anwalt) filtern
- [ ] **BI-05**: User kann KPIs nach Sachgebiet filtern
- [ ] **BI-06**: User sieht Month-over-Month Deltas (Pfeil + Prozent) auf jeder KPI-Kachel
- [ ] **BI-07**: User sieht Frist-Compliance-Rate (% fristgerecht erledigt vs. ueberfaellig)
- [ ] **BI-08**: User sieht Helena Adoption Metrics (Gespraeche, Entwuerfe, Akzeptanzrate, Token-Verbrauch)
- [ ] **BI-09**: BI-Aggregationsqueries nutzen Redis-Cache (5min TTL) zur DB-Entlastung

### Export

- [ ] **EXP-01**: User kann Akten-Liste als CSV exportieren (Aktenzeichen, Sachgebiet, Status, Beteiligte, Daten)
- [ ] **EXP-02**: User kann Akten-Liste als XLSX exportieren (formatiert, Auto-Filter, Spaltenbreiten)
- [ ] **EXP-03**: User kann Kontakte als CSV/XLSX exportieren (Name, Firma, Adresse, Telefon, E-Mail, Typ)
- [ ] **EXP-04**: User kann Finanzdaten als CSV/XLSX exportieren (Rechnungen, Aktenkonto-Buchungen, Zeiterfassung)
- [ ] **EXP-05**: User kann BI-Dashboard als PDF-Report exportieren (KPIs + Charts mit Briefkopf)
- [ ] **EXP-06**: User kann BI-Dashboard als XLSX-Report exportieren (alle KPI-Daten tabellarisch)
- [ ] **EXP-07**: XLSX-Export nutzt ExcelJS Streaming (WorkbookWriter) in BullMQ Worker fuer grosse Datasets

### Helena Intelligence

- [ ] **HEL-01**: Helena kann Falldatenblatt-Felder automatisch aus Akte-Dokumenten extrahieren (generateObject)
- [ ] **HEL-02**: Auto-Fill zeigt pro Feld Konfidenz (HOCH/MITTEL/NIEDRIG) und Quell-Excerpt
- [ ] **HEL-03**: Auto-Fill Ergebnisse sind VORSCHLAG — User akzeptiert oder verwirft pro Feld, nie auto-save
- [ ] **HEL-04**: User sieht Fallzusammenfassung als Timeline + Key Facts Panel in Akte-Detail
- [ ] **HEL-05**: User kann globalen KI-Chat aufrufen (/ki) fuer aktenuebergreifende Fragen via RAG
- [ ] **HEL-06**: Globaler KI-Chat nutzt search_alle_akten Tool mit Multi-Akte Kontext
- [ ] **HEL-07**: Bei Akte-Anlage schlaegt Helena passende Falldatenblatt-Templates vor (Sachgebiet-Matching)

### PDF-Tools

- [ ] **PDF-01**: User kann mehrere PDFs zu einem Dokument zusammenfuehren (Merge)
- [ ] **PDF-02**: User kann ein PDF in einzelne Seiten oder Seitenbereiche aufteilen (Split)
- [ ] **PDF-03**: User kann PDF-Seiten drehen (90/180/270 Grad)
- [ ] **PDF-04**: User kann PDF-Seiten per Drag-and-Drop umsortieren (Reorder mit Thumbnails)
- [ ] **PDF-05**: User kann PDF-Dateigroesse reduzieren (Compress mit Qualitaetsstufen)
- [ ] **PDF-06**: User kann Wasserzeichen auf PDFs anwenden (ENTWURF-Stempel, Kanzlei-Logo)
- [ ] **PDF-07**: User kann PII in PDFs automatisch schwaerzen (Redact fuer DSGVO)
- [ ] **PDF-08**: Alle PDF-Operationen nutzen Stirling-PDF REST API (kein neuer Docker-Service)

### CalDAV-Sync

- [ ] **CAL-01**: User kann Google Calendar via OAuth2 verbinden
- [ ] **CAL-02**: User kann Apple iCloud Kalender via App-Passwort verbinden
- [ ] **CAL-03**: Fristen werden als read-only Events in externen Kalender exportiert (kein Rueckschreiben)
- [ ] **CAL-04**: Termine werden bidirektional synchronisiert (Erstellen, Aendern, Loeschen)
- [ ] **CAL-05**: Sync laeuft als BullMQ Cron-Job (alle 15min) mit manuellem Sync-Button
- [ ] **CAL-06**: CalDAV-Credentials werden verschluesselt gespeichert (analog EmailKonto-Pattern)
- [ ] **CAL-07**: Sync nutzt ETag/CTag Tracking fuer inkrementelle Updates (kein Full-Sync)
- [ ] **CAL-08**: Externe Kalender-Events sind in der Kanzlei-Tagesuebersicht sichtbar

## v2 Requirements

### CalDAV Erweiterungen

- **CAL-E01**: Outlook/Microsoft 365 CalDAV oder Graph API Support
- **CAL-E02**: Recurring Events (RRULE) bidirektional synchronisieren
- **CAL-E03**: Wiedervorlagen in externen Kalender synchronisieren

### BI Erweiterungen

- **BI-E01**: Scheduled Report-Versand per E-Mail
- **BI-E02**: Custom KPI-Builder (eigene Metriken definieren)

### Helena Erweiterungen

- **HEL-E01**: Helena generiert neue Falddatenblatt-Templates basierend auf Fallmustern
- **HEL-E02**: Fallzusammenfassung als druckbares PDF (One-Click)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time collaborative PDF editing | OnlyOffice handles DOCX collaboration; PDF editing = scope explosion |
| Custom BI query builder | Export raw data covers custom analysis needs |
| XLSX import | Validation complexity for legal data, CSV import for Kontakte exists |
| Auto-sync jede Minute | Rate limits, Battery drain; 15min Cron + manual button reicht |
| Helena auto-save Falddaten | BRAK 2025 / BRAO 43: AI output must be VORSCHLAG, explicit acceptance |
| Two-way Frist-Sync | Externally deleted Frist = malpractice risk; read-only only |
| Outlook CalDAV | Microsoft support inconsistent; defer to v2 with Graph API |
| Recurring CalDAV events | RRULE complexity too high for v0.8; single events only |
| PDF annotation/sticky notes | OnlyOffice provides commenting on DOCX |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BI-01 | — | Pending |
| BI-02 | — | Pending |
| BI-03 | — | Pending |
| BI-04 | — | Pending |
| BI-05 | — | Pending |
| BI-06 | — | Pending |
| BI-07 | — | Pending |
| BI-08 | — | Pending |
| BI-09 | — | Pending |
| EXP-01 | — | Pending |
| EXP-02 | — | Pending |
| EXP-03 | — | Pending |
| EXP-04 | — | Pending |
| EXP-05 | — | Pending |
| EXP-06 | — | Pending |
| EXP-07 | — | Pending |
| HEL-01 | — | Pending |
| HEL-02 | — | Pending |
| HEL-03 | — | Pending |
| HEL-04 | — | Pending |
| HEL-05 | — | Pending |
| HEL-06 | — | Pending |
| HEL-07 | — | Pending |
| PDF-01 | — | Pending |
| PDF-02 | — | Pending |
| PDF-03 | — | Pending |
| PDF-04 | — | Pending |
| PDF-05 | — | Pending |
| PDF-06 | — | Pending |
| PDF-07 | — | Pending |
| PDF-08 | — | Pending |
| CAL-01 | — | Pending |
| CAL-02 | — | Pending |
| CAL-03 | — | Pending |
| CAL-04 | — | Pending |
| CAL-05 | — | Pending |
| CAL-06 | — | Pending |
| CAL-07 | — | Pending |
| CAL-08 | — | Pending |

**Coverage:**
- v0.8 requirements: 39 total
- Mapped to phases: 0
- Unmapped: 39

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after initial definition*
