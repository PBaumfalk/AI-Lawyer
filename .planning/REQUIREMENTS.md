# Requirements: AI-Lawyer — Mandantenportal

**Defined:** 2026-03-03
**Core Value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollstaendig im Browser verwalten, waehrend eine autonome KI-Agentin aktenuebergreifend lernt und als digitale Rechtsanwaltsfachangestellte mitarbeitet.

## v0.5 Requirements

Requirements for Mandantenportal milestone. Each maps to roadmap phases.

### Portal-Infrastruktur

- [ ] **PORTAL-01**: Mandant kann /portal/* Seiten mit eigenem Glass-Layout aufrufen
- [ ] **PORTAL-02**: Jeder Beteiligter mit Rolle MANDANT kann separat zum Portal eingeladen werden
- [ ] **PORTAL-03**: Mandant sieht nur eigene Akten (strikte Datentrennung, DSGVO)
- [ ] **PORTAL-04**: Mandant kann zwischen mehreren eigenen Akten wechseln

### Authentifizierung

- [ ] **AUTH-01**: Anwalt kann Einladungslink fuer Mandant-Beteiligten generieren
- [ ] **AUTH-02**: Mandant kann ueber Einladungslink Passwort setzen und Account aktivieren
- [ ] **AUTH-03**: Mandant kann sich mit E-Mail und Passwort im Portal einloggen
- [ ] **AUTH-04**: Mandant-Session bleibt ueber Browser-Refresh erhalten (JWT)
- [ ] **AUTH-05**: Mandant wird nach Inaktivitaet automatisch ausgeloggt
- [ ] **AUTH-06**: Mandant kann eigenes Passwort ueber E-Mail-Link zuruecksetzen

### Dokumente

- [ ] **DOC-01**: Anwalt kann pro Dokument "Mandant sichtbar" aktivieren/deaktivieren
- [ ] **DOC-02**: Mandant sieht Liste aller freigegebenen Dokumente seiner Akte
- [ ] **DOC-03**: Mandant kann freigegebene Dokumente herunterladen
- [ ] **DOC-04**: Mandant kann Dokumente in dedizierten "Mandant"-Ordner hochladen
- [ ] **DOC-05**: Anwalt wird bei Mandant-Upload benachrichtigt

### Nachrichten

- [ ] **MSG-01**: Mandant kann Nachrichten an den Anwalt senden
- [ ] **MSG-02**: Anwalt kann Nachrichten an den Mandant im Portal-Thread senden
- [ ] **MSG-03**: Mandant kann Dateien an Nachrichten anhaengen
- [ ] **MSG-04**: Mandant erhaelt E-Mail bei neuer Nachricht vom Anwalt
- [ ] **MSG-05**: Mandant erhaelt E-Mail bei neuem freigegebenen Dokument
- [ ] **MSG-06**: Mandant erhaelt E-Mail bei Sachstand-Update

### Sachstand

- [ ] **SACH-01**: Mandant sieht vereinfachte Timeline mit Key Events seiner Akte
- [ ] **SACH-02**: Anwalt kann "Naechste Schritte" Text fuer Mandant setzen
- [ ] **SACH-03**: Mandant sieht Akte-Uebersicht (Sachgebiet, Gegner, Gericht, Status)

## Future Requirements

Deferred to post-v0.5 milestones. Tracked but not in current roadmap.

### Portal-Erweiterungen

- **PORTAL-05**: Mandant kann Rechnungen und Zahlungsstatus einsehen
- **PORTAL-06**: Mandant kann sich per Magic-Link einloggen (passwordless)
- **PORTAL-07**: Mandant kann Benachrichtigungseinstellungen im Portal konfigurieren

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Rechnungen/Zahlungen im Portal | Zu viel Scope fuer v0.5, deferred to v0.6+ |
| Magic-Link Auth | Email+Passwort reicht fuer v0.5, Magic Link als Komfort-Erweiterung |
| Mandant-seitige Kalender/Fristen | Interne Fristen sind Anwaltssache, nicht Mandant-relevant |
| Portal-Chat mit Helena | Mandant soll mit Anwalt kommunizieren, nicht mit KI |
| Real-time Typing-Indicator im Portal | Nice-to-have, kein Table-Stakes fuer Portal-MVP |
| Mandant OnlyOffice Co-Editing | Zu komplex, Download+Upload reicht |
| Push-Notifications (Browser) | E-Mail-Benachrichtigungen decken Basisbedarf |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PORTAL-01 | — | Pending |
| PORTAL-02 | — | Pending |
| PORTAL-03 | — | Pending |
| PORTAL-04 | — | Pending |
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| AUTH-04 | — | Pending |
| AUTH-05 | — | Pending |
| AUTH-06 | — | Pending |
| DOC-01 | — | Pending |
| DOC-02 | — | Pending |
| DOC-03 | — | Pending |
| DOC-04 | — | Pending |
| DOC-05 | — | Pending |
| MSG-01 | — | Pending |
| MSG-02 | — | Pending |
| MSG-03 | — | Pending |
| MSG-04 | — | Pending |
| MSG-05 | — | Pending |
| MSG-06 | — | Pending |
| SACH-01 | — | Pending |
| SACH-02 | — | Pending |
| SACH-03 | — | Pending |

**Coverage:**
- v0.5 requirements: 25 total
- Mapped to phases: 0
- Unmapped: 25

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after initial definition*
