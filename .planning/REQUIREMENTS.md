# Requirements: AI-Lawyer

**Defined:** 2026-02-25
**Core Value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollständig im Browser verwalten, während eine proaktive KI-Agentin aktenübergreifend lernt, automatisch Entwürfe erstellt, Fristen erkennt und als digitale Rechtsanwaltsfachangestellte mitarbeitet.

## v1 Requirements

Requirements for v3.5 Production Ready. Each maps to roadmap phases.

### Docker / Build

- [ ] **BUILD-01**: Docker production build kompiliert fehlerfrei (kein webpack-Fehler in Financial Module)
- [ ] **BUILD-02**: Docker Compose `docker compose up` startet alle Services erfolgreich (app, worker, postgres, redis, minio, meilisearch, stirling-pdf, onlyoffice)

### Glass UI

- [ ] **UI-01**: Alle Dashboard-Seiten verwenden Glass-Komponenten (glass-card, glass-panel, glass-kpi-card)
- [ ] **UI-02**: Alle Formular-Seiten (Akte anlegen, Kontakt anlegen, Einstellungen) verwenden konsistentes Glass-Styling
- [ ] **UI-03**: Alle Listen-/Tabellen-Seiten (Akten, Kontakte, Dokumente, E-Mails) verwenden Glass-Panels

### Falldatenblätter

- [ ] **FD-01**: Admin kann Rechtsgebiet-spezifische Felder als Schema definieren (Name, Typ, Pflicht/Optional)
- [ ] **FD-02**: Beim Anlegen/Bearbeiten einer Akte werden die Felder des zugeordneten Rechtsgebiets angezeigt
- [ ] **FD-03**: Falldaten werden pro Akte gespeichert und auf der Akte-Detailseite angezeigt
- [ ] **FD-04**: Mindestens 3 Beispiel-Schemata vorkonfiguriert (z.B. Arbeitsrecht, Familienrecht, Verkehrsrecht)

### BI-Dashboard

- [ ] **BI-01**: KPI-Kachel: Neue Akten pro Monat (aktueller Monat + Trend)
- [ ] **BI-02**: KPI-Kachel: Offene Posten (Summe unbezahlter Rechnungen)
- [ ] **BI-03**: KPI-Kachel: Fällige Fristen (nächste 7 Tage)
- [ ] **BI-04**: KPI-Kachel: Umsatz pro Monat (aktueller Monat)
- [ ] **BI-05**: Dashboard-Seite mit allen KPI-Kacheln, RBAC-geschützt (nur ADMIN + ANWALT)

### Export

- [ ] **EXP-01**: Akten-Liste als CSV exportieren (mit Filtern)
- [ ] **EXP-02**: Kontakte-Liste als CSV exportieren
- [ ] **EXP-03**: Finanz-Daten (Rechnungen, Aktenkonto) als CSV exportieren
- [ ] **EXP-04**: XLSX-Export als Alternative zu CSV (alle 3 Bereiche)

## v2 Requirements

Deferred to future release. Not in current roadmap.

### Mandantenportal

- **MP-01**: Freigegebene Dokumente einsehen/herunterladen
- **MP-02**: Sichere Nachrichten an Anwalt senden
- **MP-03**: Aktuellen Sachstand einsehen
- **MP-04**: Eigene Unterlagen hochladen
- **MP-05**: Authentifizierung: Einladungslink + Passwort

### Internes Messaging

- **MSG-01**: Akten-bezogene Diskussionen (Case Threads)
- **MSG-02**: Allgemeine Kanäle (Kanzlei-weit)
- **MSG-03**: @Mentions + In-App-Benachrichtigungen

### Mahnwesen

- **MAHN-01**: Mahnstufen, Mahnlauf, Mahn-PDF

### KI-Erweiterung

- **KI-01**: Timeline + Key Facts pro Akte (KI-generiert)
- **KI-02**: Aktenübergreifende Suche und Fragen via RAG

### CalDAV

- **CAL-01**: Bidirektionaler Sync mit externen Kalendern

### PDF-Tools

- **PDF-01**: Merge, Split, Reorder/Rotate, Compress, Watermark, Redact

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native Mobile App | Web-first, responsive reicht; native kommt frühestens nach v2 |
| Desktop-Client | Widerspricht Browser-Only-Prinzip |
| Zwangsvollstreckung | Eigenes Modul, nach MVP als Erweiterung |
| Kanzlei-übergreifende Mandats-Teilung | Zu komplex |
| beA native Integration (ohne bea.expert) | OSCI/Java-Komplexität; €10/Monat vernachlässigbar |
| Eigenes Buchhaltungsmodul (FiBu) | DATEV-Export deckt Steuerberater-Schnittstelle ab |
| Bidirektionaler IMAP-Sync | One-Way-Import korrekt; Flags zurück = fragil |
| KI Auto-Versand | Absolute No-Go per BRAK 2025 + BRAO |
| Offline Mode | Real-time ist Core Value |
| VoIP/Sipgate | Nicht in v3.5 scope |
| Interaktive Charts/Trends | Nur Standard-KPI-Kacheln in v3.5, Charts kommen später |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUILD-01 | — | Pending |
| BUILD-02 | — | Pending |
| UI-01 | — | Pending |
| UI-02 | — | Pending |
| UI-03 | — | Pending |
| FD-01 | — | Pending |
| FD-02 | — | Pending |
| FD-03 | — | Pending |
| FD-04 | — | Pending |
| BI-01 | — | Pending |
| BI-02 | — | Pending |
| BI-03 | — | Pending |
| BI-04 | — | Pending |
| BI-05 | — | Pending |
| EXP-01 | — | Pending |
| EXP-02 | — | Pending |
| EXP-03 | — | Pending |
| EXP-04 | — | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 0
- Unmapped: 18 ⚠️

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after initial definition*
