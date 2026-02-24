# AI-Lawyer — AI-First Kanzleisoftware

## What This Is

Eine vollständig browserbasierte Kanzleisoftware mit integrierter KI ("KI-Rechtsanwaltsfachangestellte") für die Kanzlei Baumfalk, Dortmund. Vereint Aktenverwaltung, Dokumentenmanagement mit integrierter Textverarbeitung (OnlyOffice), Kalender/Fristen, E-Mail-Client, Finanzen (RVG, Rechnungen, DATEV), beA-Integration und eine proaktive KI-Agentin (OpenClaw) in einer modernen, self-hosted Anwendung. Nach Server-Installation wird keine Zusatzsoftware benötigt — alles läuft im Browser.

## Core Value

Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollständig im Browser verwalten, während eine proaktive KI-Agentin aktenübergreifend lernt, automatisch Entwürfe erstellt, Fristen erkennt und als digitale Rechtsanwaltsfachangestellte mitarbeitet — ohne dass KI-generierte Inhalte jemals automatisch versendet werden.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing codebase. -->

- ✓ Authentifizierung mit NextAuth.js v5 (Credentials, JWT Sessions, RBAC) — existing
- ✓ Aktenverwaltung CRUD (Anlegen, Bearbeiten, Archivieren, Aktenzeichen-Generierung) — existing
- ✓ Conflict Check bei Aktenanlage (Namensabgleich über Beteiligte) — existing
- ✓ Kontaktverwaltung CRUD (Natürliche/Juristische Personen, KYC, CSV/vCard-Import) — existing
- ✓ Beteiligtenverwaltung (Mandant, Gegner, Gericht etc. einer Akte zuweisen) — existing
- ✓ Dokumentenverwaltung (Upload zu MinIO, Metadaten in DB, Ordnerstruktur) — existing
- ✓ OnlyOffice Editor-Integration (React-Wrapper, Config, Callback — Basis) — existing
- ✓ Kalender CRUD (Termine, Fristen, Wiedervorlagen anlegen/bearbeiten) — existing
- ✓ Ticket-System (CRUD, Filter nach Status/Fälligkeit/Tag/Akte, Sortierung, Quick-Actions, Detailseite) — existing
- ✓ KI-Entwürfe-Workspace (Liste, Detail, als Dokument/Aktennotiz speichern) — existing
- ✓ AI-Service Basis (Ollama-Client, Prompt-Templates, Task-Processing mit Locking) — existing
- ✓ Vorlagen-System Basis (docxtemplater, Platzhalter-Befüllung) — existing
- ✓ Volltextsuche via Meilisearch — existing
- ✓ Command Palette (Cmd+K) — existing
- ✓ Dashboard-Layout mit Sidebar, Header, Glass UI — existing
- ✓ MinIO/S3 Dateispeicher-Integration — existing
- ✓ Audit-Logging (logAuditEvent) — existing
- ✓ Docker Compose Deployment-Stack — existing
- ✓ Dokumentstatus-Workflow (ENTWURF → ZUR_PRUEFUNG → FREIGEGEBEN → VERSENDET) — existing
- ✓ KI-Kennzeichnung an Dokumenten ("KI" + "nicht freigegeben" Badges) — existing

### Active

<!-- Current scope. Building toward these. -->

**AI/OpenClaw — KI-Rechtsanwaltsfachangestellte:**
- [ ] OpenClaw als proaktive KI-Agentin in der Software (erkennt Handlungsbedarf, erstellt Auto-Entwürfe)
- [ ] Globaler KI-Chat (aktenübergreifende Suche und Fragen via RAG)
- [ ] Akten-spezifischer Document Chat (Fragen an Dokumente einer Akte)
- [ ] RAG-Pipeline: Embedding-Storage, Chunking (DOCX/PDF/Text), Embedding-Job, Retrieval-API
- [ ] Multi-Provider AI (Ollama/Mistral lokal + OpenAI + Anthropic als Cloud-Option)
- [ ] Automatische Fristenerkennung aus Schriftsätzen (legt Fristen als Entwurf im Kalender an)
- [ ] Automatische Beteiligte-Erkennung aus Dokumenten
- [ ] Fallzusammenfassung (Timeline + Key Facts pro Akte)
- [ ] AI-Runner: Idempotenz (pro Ticket+Tag max. 1 Ergebnis/Tag)
- [ ] AI-Runner: Retry (max 2) + Tag `ai:error` bei Fail
- [ ] AI-Runner: Endpoint `/api/openclaw/process` nur ADMIN + Rate-Limit
- [ ] Token-Usage-Tracking pro User/Akte + Kontingent-Management
- [ ] Chat-Verlauf speichern (AiConversation/ChatNachricht)

**OnlyOffice — Vollständige Textverarbeitung:**
- [ ] WOPI-Protokoll stabil implementieren (Laden/Speichern zuverlässig)
- [ ] Vorlagensystem mit Platzhalter-Befüllung ({{mandant.name}}, {{akte.aktenzeichen}} etc.)
- [ ] Echtzeit-Collaboration (mehrere Nutzer gleichzeitig)
- [ ] PDF-Export (mit Kanzlei-Briefkopf)
- [ ] Briefkopf-Bearbeitung direkt in OnlyOffice
- [ ] Track Changes, Kommentare, Versionierung

**Vorlagen & Briefkopf:**
- [ ] Freie Ordnerstruktur für Vorlagen (User kann Ordner selbst anlegen/verwalten)
- [ ] Briefkopf-Verwaltung (Logo + Kanzleidaten, bearbeitbar in OnlyOffice)
- [ ] Vorlagenkategorien: Schriftsätze, Klageschriften, Vollmachten, Mahnungen etc.

**Akten-Ordnerstruktur:**
- [ ] Ordner-Schemata in Einstellungen definierbar (Standard-Ordner pro Akte)
- [ ] Anwalt/Sachbearbeiter können weitere Ordner frei anlegen
- [ ] Verschachtelte Ordnerstruktur innerhalb einer Akte

**Falldatenblätter pro Rechtsgebiet:**
- [ ] Arbeitsrecht (Kündigungsschutz, Abfindung, Elternzeit, Vertragsprüfung)
- [ ] Familienrecht (Scheidung, Unterhalt, Sorgerecht, Zugewinn)
- [ ] Verkehrsrecht (Unfallschaden, Bußgeld, Fahrverbot, Schadensregulierung)
- [ ] Miet-/Immobilienrecht (Kündigung, Mietminderung, Räumung, Eigenbedarf)
- [ ] Strafrecht (Ermittlungsverfahren, Hauptverhandlung, Bewährung)

**E-Mail — Vollständiger Client:**
- [ ] IMAP-Sync mit Real-Time (IMAP IDLE) für eingehende E-Mails
- [ ] Shared Kanzlei-Postfach + per-User Mailboxen
- [ ] Inbox-Seite (Liste, Pagination, Filter: veraktet/unveraktet, Akte, Verantwortlicher)
- [ ] E-Mail-Detailansicht (Header, Body, Anhänge)
- [ ] E-Mail verakten (Akte zuordnen, Anhänge ins DMS)
- [ ] Ticket aus E-Mail erstellen (Prefill Titel/Beschreibung)
- [ ] Compose-View (An, CC, Betreff, Rich-Text, Akte-Verknüpfung)
- [ ] SMTP-Versand
- [ ] Akte: Tab "E-Mails" (veraktete Mails)

**Internes Messaging — Hybrid:**
- [ ] Akten-bezogene Diskussionen (Case Threads)
- [ ] Allgemeine Kanäle (Kanzlei-weit)
- [ ] Thread-Liste (Inbox) mit Filtern
- [ ] Chat-View mit Infinite-Scroll
- [ ] Composer (Markdown-lite, Attachments, @Mention-Picker)
- [ ] @Mentions (User, Role) + In-App-Benachrichtigungen
- [ ] Message-Actions (Antworten, Zitieren, Link kopieren, Task erzeugen)
- [ ] Dokument verlinken (Picker, Card/Preview)
- [ ] Berechtigungen (Sichtbarkeit pro Kanzlei/Akte)

**Kalender & Fristen:**
- [ ] Fristenberechnung nach §§ 187-193 BGB (Wochenende/Feiertag-Verschiebung)
- [ ] Feiertagskalender pro Bundesland (konfigurierbar, Standard: NRW)
- [ ] Prioritäten: 5 Stufen (Sehr niedrig, Niedrig, Normal, Hoch, Dringend)
- [ ] Frist-Erinnerungen (7, 3, 1 Tag vorher) + Vorfrist
- [ ] Tagesübersicht (heute/überfällig) + Quick-Actions
- [ ] Dashboard-Widget: Fällige Fristen heute/diese Woche
- [ ] CalDAV-Sync (bidirektional mit externen Kalendern)

**Dokument-Pipeline & PDF-Tools (Stirling-PDF):**
- [ ] Stirling-PDF Docker-Service integrieren
- [ ] Auto-OCR bei Upload (nur wenn PDF nicht bereits durchsuchbar)
- [ ] OCR-Queue/Worker (async, retries, backoff)
- [ ] OCR-Status speichern + anzeigen (Badge + manueller Retry)
- [ ] OCR-Ergebnis in Meilisearch indizieren
- [ ] Dokument-Detailseite (Metadaten, Versionen, Status, Tags, Historie)
- [ ] PDF-Preview im Browser (Viewer mit Navigation, Zoom, Download)
- [ ] Actions-Bar (Umbenennen, Verschieben, Tags, Statuswechsel, PDF-Export)
- [ ] PDF Merge, Split, Reorder/Rotate, Compress, Extract, Watermark, Redact, Convert to PDF

**Finanzen:**
- [ ] Rechnungen: DB-Model, Nummernkreis, atomare Vergabe, UI, PDF-Rendering, Statusflow
- [ ] RVG: Voll-automatische Berechnung (Streitwert → Gebührenvorschlag mit VV-Nummern)
- [ ] Mahnwesen: Mahnstufen, Mahnlauf, Mahn-PDF
- [ ] E-Rechnung: XRechnung + ZUGFeRD Export
- [ ] Aktenkonto: Buchungen (Einnahme/Ausgabe/Fremdgeld/Auslage), Saldo, Beleg-Verknüpfung
- [ ] Banking-Import: CSV + CAMT053
- [ ] Banking-Zuordnung (Rechnung/Akte) + Übernahme als Buchungen
- [ ] DATEV: CSV-Export (Buchungsstapel)
- [ ] SEPA: pain.001 (Überweisungen) + pain.008 (Lastschriften)
- [ ] Zeiterfassung: Timer + manuelle Einträge + Auswertung

**beA-Integration (Interface Only):**
- [ ] Posteingang: beA-Nachrichten empfangen + automatisch Akten zuordnen
- [ ] Postausgang: Nachrichten aus Akte senden (mit Dokumentenanhang)
- [ ] eEB (Elektronisches Empfangsbekenntnis)
- [ ] Prüfprotokoll anzeigen/archivieren
- [ ] Safe-ID-Verwaltung an Kontakten
- [ ] XJustiz-Parser + Viewer

**Mandantenportal:**
- [ ] Freigegebene Dokumente einsehen/herunterladen
- [ ] Sichere Nachrichten an Anwalt senden
- [ ] Aktuellen Sachstand einsehen
- [ ] Eigene Unterlagen hochladen
- [ ] Authentifizierung: Einladungslink + Passwort

**Rollen & Rechte:**
- [ ] Akten-Zugriff: Persönlich + Gruppen/Dezernate + Admin-Override
- [ ] SEKRETARIAT als eingeschränkter Sachbearbeiter (kein Freigeben)
- [ ] PRAKTIKANT: Nur Lesen + Entwürfe erstellen (zugewiesene Akten)
- [ ] Systemweiter Audit-Trail (Wer hat wann was geändert — Admin-Ansicht + pro Akte)

**Glass UI Migration (verbleibend):**
- [ ] Verbleibende Seiten auf Glass-Komponenten migrieren
- [ ] Lightmode-Farbkonfiguration in Einstellungen

**Sicherheit & Compliance:**
- [ ] Versand-Gate Tests (Dokumentstatus-Transitionen, RBAC)
- [ ] Rate-Limits für OpenClaw-Endpunkte
- [ ] DSGVO: Löschkonzept, Auskunftsrecht, Einwilligungsmanagement
- [ ] Observability: Health-Checks (App/Ollama/OpenClaw) + strukturierte Logs

**Sonstiges:**
- [ ] VoIP: Sipgate Anrufjournal + Zuordnung
- [ ] BI: Dashboard-Kacheln (Akten/Monat, offene Posten, Fristen)
- [ ] Export: CSV + XLSX

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Native Mobile App — Web-first, responsive reicht; native kommt frühestens nach MVP
- Desktop-Client — Widerspricht Browser-Only-Prinzip
- Zwangsvollstreckung — Eigenes Modul, nach MVP als Erweiterung
- Kanzlei-übergreifende Mandats-Teilung — Zu komplex, nicht in v1
- beA Live-Integration — Kein Testumgebung-Zugang; Interface/UI wird vorbereitet
- Eigenes Buchhaltungsmodul (FiBu) — DATEV-Export deckt Steuerberater-Schnittstelle ab
- Bidirektionaler IMAP-Sync (Flags/Löschen zurück zum Mailserver) — Erst nach stabilem Read-Sync

## Context

- **Kanzlei Baumfalk** (Dortmund) ist Auftraggeber und erster Nutzer
- Bestehende Kanzlei-Software (j-lawyer.org, RA-MICRO, Advoware) als Referenz für Feature-Parität
- Brownfield-Projekt: Signifikante bestehende Codebasis mit ~30 Prisma-Models, funktionierender Auth, Akten/Kontakte/Tickets/Dokumente UI
- Glass/Liquid-Glass UI-Design größtenteils implementiert
- OnlyOffice Docker läuft, aber WOPI, Templates, Collaboration, PDF-Export brauchen grundlegende Überarbeitung
- AI-Service Grundstruktur vorhanden (Ollama-Client, Prompt-Templates, Task-Locking), aber RAG und Multi-Provider fehlen
- Deutsche UI-Sprache, englische Code-Kommentare

## Constraints

- **Tech Stack**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, PostgreSQL 16 + Prisma, MinIO, Meilisearch, OnlyOffice Docs (Docker) — verbindlich
- **Self-Hosted First**: Alles muss on-premise mit Docker Compose betreibbar sein; Cloud optional
- **Browser-Only**: Kein Desktop-Client, kein Plugin, kein lokales Office
- **Deutsche Rechtskonformität**: DSGVO, BRAO § 31a (beA), § 130a ZPO (ERV), GoBD, RVG
- **KI-Sicherheitsregel**: KI-Inhalte IMMER nur als Entwurf; Freigabe ausschließlich durch Menschen
- **Testing**: Max. 20% Aufwand — nur kritische Business-Logik (Fristen, RVG, Conflict Check)
- **Prisma-Schema = Source of Truth**: Alle Datenmodell-Änderungen beginnen im Prisma-Schema

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Ollama + Mistral 7B als Standard-LLM | Self-hosted, keine Datenabflüsse, DSGVO-konform | — Pending |
| Multi-Provider von Anfang an | Flexibilität für Cloud-LLMs wenn gewünscht (OpenAI, Anthropic) | — Pending |
| OnlyOffice statt TipTap | Native DOCX-Unterstützung, Collaboration, Track Changes | ⚠️ Revisit (WOPI-Probleme) |
| IMAP IDLE statt Polling | Echtzeit-E-Mail-Empfang, professionelle UX | — Pending |
| Briefkopf-Bearbeitung in OnlyOffice | Kein eigener Designer nötig, nutzt bestehende Textverarbeitung | — Pending |
| Freie Vorlagen-Ordner (kein fixes Schema) | Maximale Flexibilität für verschiedene Kanzlei-Workflows | — Pending |
| Ordner-Schemata für Akten + frei erweiterbar | Konsistente Grundstruktur + Flexibilität pro Akte | — Pending |
| 5-stufige Prioritäten (Sehr niedrig → Dringend) | Feinere Steuerung bei Fristen/Wiedervorlagen | — Pending |
| Hybrid-Messaging (Akte + allgemein) | Beides gebraucht: case-spezifisch + Kanzlei-weit | — Pending |
| Mandantenportal mit Einladungslink + Passwort | Einfach, sicher, kein OAuth-Setup für Mandanten nötig | — Pending |
| DATEV CSV-Export | Am verbreitetsten, deckt die meisten Steuerberater ab | — Pending |
| XRechnung + ZUGFeRD beides | Pflicht seit 01.01.2025 B2B; Gerichte brauchen XRechnung, Firmen ZUGFeRD | — Pending |
| SEPA pain.001 + pain.008 | Überweisungen + Lastschriften abdecken | — Pending |
| CalDAV-Sync bidirektional | Integration mit bestehenden Kalender-Systemen (Google, Outlook) | — Pending |
| Shared + per-User Mailboxen | Kanzlei-Posteingang + individuelle Accounts | — Pending |

---
*Last updated: 2026-02-24 after initialization*
