# Requirements — AI-Lawyer Milestone 2

**Created:** 2026-02-24
**Scoped by:** User confirmation
**Milestone:** 2 (v1 = this milestone, v2 = future milestone)

---

## v1 — Milestone 2 Scope

### Fristen & Kalender

| REQ-ID | Requirement | Priority | Legal | Notes |
|--------|-------------|----------|-------|-------|
| REQ-FK-001 | BGB §§187-193 Fristberechnung (Ereignisfrist, Beginnfrist, Monats-/Wochen-/Tagesfristen, Monatsende-Überlauf) | P0 | YES | Haftungsrisiko #1; >50 Unit-Tests; reine Funktionsbibliothek |
| REQ-FK-002 | Feiertagskalender pro Bundesland (Standard: NRW) mit §193 BGB Wochenende/Feiertag-Verschiebung | P0 | YES | feiertagejs; konfigurierbar pro Kanzlei |
| REQ-FK-003 | Vorfristen-Erinnerungen (konfigurierbar, Standard: 7/3/1 Tag vorher) + Vorfrist | P1 | Best Practice | Benachrichtigung an Verantwortlichen + Sachbearbeiter |
| REQ-FK-004 | Tagesübersicht (heute/überfällig) + Quick-Actions | P1 | — | Dashboard-Widget: fällige Fristen heute/diese Woche |
| REQ-FK-005 | Prioritäten: 5 Stufen (Sehr niedrig → Dringend) für Fristen/Wiedervorlagen | P1 | — | Bestehendes Kalender-CRUD erweitern |

### Dokumente & Vorlagen

| REQ-ID | Requirement | Priority | Legal | Notes |
|--------|-------------|----------|-------|-------|
| REQ-DV-001 | Vorlagen-System mit Platzhalter-Befüllung ({{mandant.name}}, {{akte.aktenzeichen}}, {{gegner.name}} etc.) | P1 | — | docxtemplater; freie Ordnerstruktur für Vorlagen |
| REQ-DV-002 | Briefkopf-Verwaltung (Logo + Kanzleidaten, bearbeitbar in OnlyOffice) | P1 | YES (BRAO) | Auto-Anwendung auf alle ausgehenden Dokumente |
| REQ-DV-003 | PDF-Export mit Kanzlei-Briefkopf via OnlyOffice | P1 | — | Standard-Output-Format |
| REQ-DV-004 | Auto-OCR bei PDF-Upload (Stirling-PDF Docker, Tesseract, deutsche Sprachdaten) | P1 | — | Async Queue mit Retries; nur wenn PDF nicht bereits durchsuchbar |
| REQ-DV-005 | OCR-Status speichern + anzeigen (Badge + manueller Retry) | P1 | — | OCR-Ergebnis in Meilisearch indizieren |
| REQ-DV-006 | PDF-Preview im Browser (Viewer mit Navigation, Zoom, Download) | P1 | — | pdf.js oder ähnlich |
| REQ-DV-007 | Dokument-Detailseite (Metadaten, Versionen, Status, Tags, Historie) | P1 | — | Actions-Bar (Umbenennen, Verschieben, Tags, Status) |
| REQ-DV-008 | Ordner-Schemata für Akten (Standard-Ordner pro Akte, frei erweiterbar) | P1 | — | In Einstellungen definierbar |
| REQ-DV-009 | Vorlagenkategorien (Schriftsätze, Klageschriften, Vollmachten, Mahnungen etc.) | P1 | — | Freie Ordnerstruktur, User-verwaltbar |
| REQ-DV-010 | WOPI-Protokoll stabil (Laden/Speichern zuverlässig) | P1 | — | Grundlegende Überarbeitung nötig |
| REQ-DV-011 | Track Changes, Kommentare, Versionierung in OnlyOffice | P1 | — | Echtzeit-Collaboration (mehrere Nutzer gleichzeitig) |

### E-Mail

| REQ-ID | Requirement | Priority | Legal | Notes |
|--------|-------------|----------|-------|-------|
| REQ-EM-001 | IMAP-Sync mit Real-Time (IMAP IDLE) für eingehende E-Mails | P1 | — | ImapFlow im Worker-Prozess; NICHT in Next.js API Routes |
| REQ-EM-002 | Shared Kanzlei-Postfach + per-User Mailboxen | P1 | — | Konfiguration pro Mailbox |
| REQ-EM-003 | Inbox-Seite (Liste, Pagination, Filter: veraktet/unveraktet, Akte, Verantwortlicher) | P1 | — | Primärer täglicher Workflow |
| REQ-EM-004 | E-Mail-Detailansicht (Header, Body, Anhänge) | P1 | — | HTML-Rendering mit sanitize-html (XSS-Schutz) |
| REQ-EM-005 | E-Mail verakten (Akte zuordnen, Anhänge ins DMS) | P1 | — | Auto-Suggest Akte aus Absender/Betreff; One-Click Assign |
| REQ-EM-006 | Compose-View (An, CC, BCC, Betreff, Rich-Text, Akte-Verknüpfung, Dateianhang aus DMS) | P1 | — | SMTP-Versand via BullMQ |
| REQ-EM-007 | Ticket aus E-Mail erstellen (Prefill Titel/Beschreibung) | P1 | — | Quick-Action in E-Mail-Liste |
| REQ-EM-008 | Akte: Tab "E-Mails" (veraktete Mails der Akte) | P1 | — | Filtered view |

### Finanzen

| REQ-ID | Requirement | Priority | Legal | Notes |
|--------|-------------|----------|-------|-------|
| REQ-FI-001 | RVG-Berechnung: Streitwert → Gebührenvorschlag mit VV-Nummern (3100, 3104, 1000/1003, 7002, 1008 etc.) | P1 | YES | KostBRäG 2025 Sätze (6% Erhöhung ab Juni 2025); Anrechnung VV Vorbem. 3 Abs. 4 |
| REQ-FI-002 | RVG-Gebührentabelle als versionierte Daten mit Gültigkeitszeiträumen | P1 | YES | Keine Hardcoded-Tabellen; aktualisierbar bei Gesetzesänderung |
| REQ-FI-003 | Rechnungen: DB-Model, Nummernkreis (atomare Vergabe), Status-Flow (Entwurf → Gestellt → Bezahlt → Storniert) | P1 | YES (§14 UStG) | Alle Pflichtfelder nach §14 UStG |
| REQ-FI-004 | Rechnungs-PDF mit Briefkopf | P1 | YES | Abhängigkeit: REQ-DV-002 |
| REQ-FI-005 | Aktenkonto: Buchungen (Einnahme/Ausgabe/Fremdgeld/Auslage), Saldo, Beleg-Verknüpfung | P1 | YES (§43a BRAO) | Fremdgeld GETRENNT darstellen; >€15k → Anderkonto-Warnung (§4 BORA) |
| REQ-FI-006 | Fremdgeld-Compliance: 5-Werktage-Weiterleitungswarnung, separate Anzeige | P1 | YES | Verstöße → Kammerdisziplinarverfahren |
| REQ-FI-007 | E-Rechnung: XRechnung (CII) + ZUGFeRD (PDF/A-3) Export | P1 | YES | Pflicht seit 01.01.2025 B2B; @e-invoice-eu/core |
| REQ-FI-008 | DATEV CSV-Export (Buchungsstapel) | P2 | De facto | Standard-Schnittstelle zum Steuerberater |
| REQ-FI-009 | SEPA pain.001 (Überweisungen) + pain.008 (Lastschriften) | P2 | — | sepa.js; XML für Bank-Upload |
| REQ-FI-010 | Banking-Import: CSV + CAMT053 | P2 | — | Semi-automatische Zuordnung (Vorschlag, Mensch bestätigt) |
| REQ-FI-011 | Zeiterfassung: Timer + manuelle Einträge + Auswertung pro Akte | P2 | — | Basis für Stundenabrechnung |

### beA-Integration

| REQ-ID | Requirement | Priority | Legal | Notes |
|--------|-------------|----------|-------|-------|
| REQ-BA-001 | beA-Posteingang: Nachrichten empfangen + automatisch Akte zuordnen | P2 | YES (§31a BRAO) | bea.expert REST API (~40 Funktionen, €10/Monat/Postfach) |
| REQ-BA-002 | beA-Postausgang: Nachrichten aus Akte senden (mit Dokumentenanhang) | P2 | YES | — |
| REQ-BA-003 | eEB (Elektronisches Empfangsbekenntnis) | P2 | YES | — |
| REQ-BA-004 | Prüfprotokoll anzeigen/archivieren | P2 | — | — |
| REQ-BA-005 | Safe-ID-Verwaltung an Kontakten | P2 | — | — |
| REQ-BA-006 | XJustiz-Parser + Viewer | P2 | — | XJustiz v3.4.1 Namespaces |

### KI / OpenClaw

| REQ-ID | Requirement | Priority | Legal | Notes |
|--------|-------------|----------|-------|-------|
| REQ-KI-001 | RAG-Pipeline: Embedding-Storage (pgvector), semantisches Chunking (Paragraph-basiert für deutsche Rechtstexte), Embedding-Job (Worker) | P2 | — | Multilinguales Embedding-Model; Model-Version pro Vektor speichern |
| REQ-KI-002 | Multi-Provider AI (Ollama/Mistral lokal + OpenAI + Anthropic Cloud) via Vercel AI SDK v4 | P2 | — | AI SDK v4 wegen zod 3.23.8 Lock |
| REQ-KI-003 | Akten-spezifischer Document Chat (Fragen an Dokumente einer Akte) | P2 | — | pgvector Cosine Similarity, Akte-scoped, Konfidenz-Schwelle |
| REQ-KI-004 | Proaktive KI-Agentin OpenClaw (scannt neue E-Mails/Dokumente, schlägt Aktionen vor) | P2 | — | Haupt-Differentiator; NUR Entwürfe, NIE Auto-Versand |
| REQ-KI-005 | Auto-Fristenerkennung aus Schriftsätzen → Kalender-ENTWURF | P2 | — | NLP/LLM-Parsing; Muster: "Frist von X Wochen", "bis zum DD.MM.YYYY" |
| REQ-KI-006 | Auto-Beteiligte-Erkennung aus Dokumenten → Vorschlag | P2 | — | Immer nur Vorschlag, nie automatisch angelegt |
| REQ-KI-007 | Chat-Verlauf speichern (AiConversation/ChatNachricht) | P2 | — | Pro User + pro Akte |
| REQ-KI-008 | Token-Usage-Tracking pro User/Akte + Kontingent-Management | P2 | — | Admin-Dashboard für Verbrauch |
| REQ-KI-009 | KI-Entwurf-Workflow: Jedes KI-Ergebnis = ENTWURF, explizite Freigabe durch Mensch | P0 | YES (BRAK) | BRAK AI-Leitfaden 2025; "KI" + "nicht freigegeben" Badges |
| REQ-KI-010 | Quellennachweise bei jeder KI-Antwort (Dokument + Seite/Absatz) | P1 | Best Practice | Gegen Halluzinationen; Konfidenz-Schwelle + "Ich weiß nicht" |
| REQ-KI-011 | AI-Runner: Idempotenz (pro Ticket+Tag max 1 Ergebnis/Tag), Retry (max 2), Tag ai:error bei Fail | P2 | — | Bestehende Basis erweitern |
| REQ-KI-012 | Rate-Limits für OpenClaw-Endpunkte (/api/openclaw/process nur ADMIN) | P1 | — | Sicherheit |

### Rollen & Sicherheit

| REQ-ID | Requirement | Priority | Legal | Notes |
|--------|-------------|----------|-------|-------|
| REQ-RS-001 | Akten-Zugriff: Persönlich + Gruppen/Dezernate + Admin-Override | P1 | — | Bestehende RBAC erweitern |
| REQ-RS-002 | SEKRETARIAT als eingeschränkter Sachbearbeiter (kein Freigeben) | P1 | — | Bereits im Schema angelegt |
| REQ-RS-003 | PRAKTIKANT: Nur Lesen + Entwürfe erstellen (zugewiesene Akten) | P1 | — | Bereits im Schema angelegt |
| REQ-RS-004 | Systemweiter Audit-Trail (Wer/Wann/Was — Admin-Ansicht + pro Akte) | P1 | — | logAuditEvent bereits vorhanden, UI fehlt |
| REQ-RS-005 | DSGVO: Löschkonzept, Auskunftsrecht, Einwilligungsmanagement | P1 | YES | Compliance-Pflicht |
| REQ-RS-006 | Observability: Health-Checks (App/Ollama/Worker/Redis) + strukturierte Logs | P1 | — | Betriebsbereitschaft |

### Infrastruktur (aus Research-Architektur)

| REQ-ID | Requirement | Priority | Legal | Notes |
|--------|-------------|----------|-------|-------|
| REQ-IF-001 | Redis 7 in Docker Compose (BullMQ Job-Queue + Socket.IO Pub/Sub) | P0 | — | Voraussetzung für E-Mail, OCR, RAG, Messaging |
| REQ-IF-002 | Worker-Prozess (worker.ts, BullMQ-Prozessoren, gleiche Codebasis wie App) | P0 | — | IMAP IDLE, Embedding, OCR, AI-Tasks, CalDAV |
| REQ-IF-003 | Custom server.ts (Next.js + Socket.IO WebSocket auf gleichem Port) | P1 | — | Echtzeit-Benachrichtigungen (neue E-Mail, Chat) |
| REQ-IF-004 | Stirling-PDF Docker-Sidecar (Fat-Image mit Tesseract + deutsche Sprachdaten) | P1 | — | REST API für OCR + PDF-Tools |
| REQ-IF-005 | Graceful Shutdown für Worker (laufende Jobs abschließen) | P1 | — | Datenverlust vermeiden |

---

## v2 — Future Milestone

| REQ-ID | Feature | Notes |
|--------|---------|-------|
| REQ-V2-001 | Mandantenportal (Dokumente, Nachrichten, Sachstand, Upload) | Separate Auth (Einladungslink + Passwort), eigene PortalUser-Tabelle |
| REQ-V2-002 | Internes Messaging (Akten-Threads + allgemeine Kanäle) | Socket.IO Rooms, @Mentions |
| REQ-V2-003 | Mahnwesen (Mahnstufen, Mahnlauf, Mahn-PDF) | Aufbauend auf Rechnungssystem |
| REQ-V2-004 | Fallzusammenfassung (Timeline + Key Facts pro Akte) | Advanced AI, nach Document Chat validiert |
| REQ-V2-005 | Globaler KI-Chat (aktenübergreifend) | Sehr komplex, Privacy-Boundaries pro Rolle |
| REQ-V2-006 | CalDAV-Sync (bidirektional) | Erst bei validiertem Bedarf |
| REQ-V2-007 | PDF-Tools (Merge, Split, Watermark, Redact, Compress) | Stirling-PDF REST API |
| REQ-V2-008 | Falldatenblätter pro Rechtsgebiet | Jedes Rechtsgebiet = eigener Aufwand |
| REQ-V2-009 | Glass UI Migration (verbleibende Seiten) | Kosmetisch |
| REQ-V2-010 | VoIP: Sipgate Anrufjournal + Zuordnung | Nur Journal-Import |
| REQ-V2-011 | BI: Dashboard-Kacheln (Akten/Monat, offene Posten, Fristen) | Reporting |
| REQ-V2-012 | Export: CSV + XLSX | Datenexport |

---

## Out of Scope (permanent)

| Feature | Grund |
|---------|-------|
| Native Mobile App | Web-first, responsive reicht |
| Desktop-Client | Widerspricht Browser-Only-Prinzip |
| Zwangsvollstreckung | Eigenes Modul, nach MVP |
| Eigene FiBu (Finanzbuchhaltung) | DATEV-Export deckt Steuerberater-Schnittstelle |
| Bidirektionaler IMAP-Sync | One-Way-Import korrekt; Flags zurück = fragil |
| beA native Integration (ohne bea.expert) | OSCI/Java-Komplexität; €10/Monat ist vernachlässigbar |
| KI Auto-Versand | Absolute No-Go per BRAK 2025 + BRAO |
| Kanzlei-übergreifende Mandats-Teilung | Zu komplex für v1 |

---

## Requirement Summary

| Scope | Count | P0 | P1 | P2 |
|-------|-------|----|----|-----|
| v1 | 64 | 5 | 40 | 19 |
| v2 | 12 | — | — | — |
| Out of Scope | 8 | — | — | — |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-IF-001 | Phase 1 | Complete |
| REQ-IF-002 | Phase 1 | Complete |
| REQ-IF-003 | Phase 1 | Complete |
| REQ-IF-005 | Phase 1 | Complete |
| REQ-FK-001 | Phase 2 | Complete |
| REQ-FK-002 | Phase 2 | Complete |
| REQ-FK-003 | Phase 2.1 | Complete |
| REQ-FK-004 | Phase 2 | Complete |
| REQ-FK-005 | Phase 2 | Complete |
| REQ-DV-001 | Phase 2 | Complete |
| REQ-DV-002 | Phase 2 | Complete |
| REQ-DV-003 | Phase 2 | Complete |
| REQ-DV-008 | Phase 2.2 | Complete |
| REQ-DV-009 | Phase 2.2 | Complete |
| REQ-DV-010 | Phase 2 | Complete |
| REQ-DV-011 | Phase 2 | Complete |
| REQ-EM-001 | Phase 3 | Pending |
| REQ-EM-002 | Phase 3 | Pending |
| REQ-EM-003 | Phase 3 | Pending |
| REQ-EM-004 | Phase 3 | Pending |
| REQ-EM-005 | Phase 3 | Pending |
| REQ-EM-006 | Phase 3 | Pending |
| REQ-EM-007 | Phase 3 | Pending |
| REQ-EM-008 | Phase 3 | Pending |
| REQ-DV-004 | Phase 4 | Pending |
| REQ-DV-005 | Phase 4 | Pending |
| REQ-DV-006 | Phase 4 | Pending |
| REQ-DV-007 | Phase 4 | Pending |
| REQ-IF-004 | Phase 4 | Pending |
| REQ-KI-001 | Phase 4 | Pending |
| REQ-FI-001 | Phase 5 | Pending |
| REQ-FI-002 | Phase 5 | Pending |
| REQ-FI-003 | Phase 5 | Pending |
| REQ-FI-004 | Phase 5 | Pending |
| REQ-FI-005 | Phase 5 | Pending |
| REQ-FI-006 | Phase 5 | Pending |
| REQ-FI-007 | Phase 5 | Pending |
| REQ-FI-008 | Phase 5 | Pending |
| REQ-FI-009 | Phase 5 | Pending |
| REQ-FI-010 | Phase 5 | Pending |
| REQ-FI-011 | Phase 5 | Pending |
| REQ-KI-002 | Phase 6 | Pending |
| REQ-KI-003 | Phase 6 | Pending |
| REQ-KI-004 | Phase 6 | Pending |
| REQ-KI-005 | Phase 6 | Pending |
| REQ-KI-006 | Phase 6 | Pending |
| REQ-KI-007 | Phase 6 | Pending |
| REQ-KI-008 | Phase 6 | Pending |
| REQ-KI-009 | Phase 6 | Pending |
| REQ-KI-010 | Phase 6 | Pending |
| REQ-KI-011 | Phase 6 | Pending |
| REQ-KI-012 | Phase 6 | Pending |
| REQ-BA-001 | Phase 6 | Pending |
| REQ-BA-002 | Phase 6 | Pending |
| REQ-BA-003 | Phase 6 | Pending |
| REQ-BA-004 | Phase 6 | Pending |
| REQ-BA-005 | Phase 6 | Pending |
| REQ-BA-006 | Phase 6 | Pending |
| REQ-RS-001 | Phase 7 | Pending |
| REQ-RS-002 | Phase 7 | Pending |
| REQ-RS-003 | Phase 7 | Pending |
| REQ-RS-004 | Phase 7 | Pending |
| REQ-RS-005 | Phase 7 | Pending |
| REQ-RS-006 | Phase 7 | Pending |

---
*Generated: 2026-02-24*
*Source: PROJECT.md + FEATURES.md + SUMMARY.md research + user scoping confirmation*
*Traceability added: 2026-02-24 by roadmap creation*
*Requirement count corrected: 2026-02-24 (was 52, actual 64 after detailed recount)*
