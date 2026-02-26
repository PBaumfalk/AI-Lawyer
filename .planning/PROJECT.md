# AI-Lawyer — AI-First Kanzleisoftware

## What This Is

Eine vollständig browserbasierte Kanzleisoftware mit integrierter KI-Agentin ("Helena") für die Kanzlei Baumfalk, Dortmund. Vereint Aktenverwaltung, Dokumentenmanagement mit OnlyOffice (Co-Editing, Track Changes, Vorlagen, Briefkopf), BGB-konforme Fristenberechnung, vollständigen E-Mail-Client (IMAP IDLE + SMTP), OCR-Pipeline mit RAG-Ingestion, Finanzen (RVG, Rechnungen, E-Rechnung, DATEV, SEPA, Zeiterfassung), beA-Integration, proaktive KI mit Document Chat, RBAC mit Dezernaten, DSGVO-Compliance und Audit-Trail — alles self-hosted via Docker Compose, alles im Browser.

## Core Value

Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollständig im Browser verwalten, während eine proaktive KI-Agentin aktenübergreifend lernt, automatisch Entwürfe erstellt, Fristen erkennt und als digitale Rechtsanwaltsfachangestellte mitarbeitet — ohne dass KI-generierte Inhalte jemals automatisch versendet werden.

## Requirements

### Validated

<!-- Shipped and confirmed working in v3.4 -->

**Pre-existing (before v3.4):**
- ✓ Authentifizierung mit NextAuth.js v5 (Credentials, JWT Sessions, RBAC) — existing
- ✓ Aktenverwaltung CRUD (Anlegen, Bearbeiten, Archivieren, Aktenzeichen-Generierung) — existing
- ✓ Conflict Check bei Aktenanlage (Namensabgleich über Beteiligte) — existing
- ✓ Kontaktverwaltung CRUD (Natürliche/Juristische Personen, KYC, CSV/vCard-Import) — existing
- ✓ Beteiligtenverwaltung (Mandant, Gegner, Gericht etc. einer Akte zuweisen) — existing
- ✓ Dokumentenverwaltung (Upload zu MinIO, Metadaten in DB, Ordnerstruktur) — existing
- ✓ OnlyOffice Editor-Integration (React-Wrapper, Config, Callback) — existing
- ✓ Kalender CRUD (Termine, Fristen, Wiedervorlagen anlegen/bearbeiten) — existing
- ✓ Ticket-System (CRUD, Filter, Sortierung, Quick-Actions, Detailseite) — existing
- ✓ KI-Entwürfe-Workspace (Liste, Detail, als Dokument/Aktennotiz speichern) — existing
- ✓ Vorlagen-System Basis (docxtemplater, Platzhalter-Befüllung) — existing
- ✓ Volltextsuche via Meilisearch — existing
- ✓ Command Palette (Cmd+K) — existing
- ✓ Dashboard-Layout mit Sidebar, Header, Glass UI — existing
- ✓ MinIO/S3 Dateispeicher-Integration — existing
- ✓ Audit-Logging (logAuditEvent) — existing
- ✓ Docker Compose Deployment-Stack — existing
- ✓ Dokumentstatus-Workflow (ENTWURF → ZUR_PRUEFUNG → FREIGEGEBEN → VERSENDET) — existing
- ✓ KI-Kennzeichnung an Dokumenten ("KI" + "nicht freigegeben" Badges) — existing

**Infrastructure (v3.4 Phase 1):**
- ✓ Redis 7 + BullMQ Worker-Prozess in Docker Compose — v3.4
- ✓ Custom server.ts mit Socket.IO WebSocket auf Port 3000 — v3.4
- ✓ Graceful Shutdown für Worker (laufende Jobs abschließen) — v3.4
- ✓ Stirling-PDF Docker-Sidecar für OCR + PDF-Tools — v3.4

**Fristen & Kalender (v3.4 Phase 2 + 2.1):**
- ✓ BGB §§187-193 Fristberechnung (Ereignisfrist, Beginnfrist, Monatsende-Überlauf, 50+ Tests) — v3.4
- ✓ Feiertagskalender pro Bundesland mit §193 BGB Wochenende/Feiertag-Verschiebung — v3.4
- ✓ Vorfristen-Erinnerungen (7/3/1 Tag) mit BullMQ Cron-Job — v3.4
- ✓ Tagesübersicht + Quick-Actions + Dashboard-Widget — v3.4
- ✓ 5-stufige Prioritäten (Sehr niedrig → Dringend) — v3.4

**Dokumente & Vorlagen (v3.4 Phase 2 + 2.2):**
- ✓ WOPI-Protokoll stabil (Laden/Speichern, Co-Editing, document.key Versionierung) — v3.4
- ✓ Track Changes, Kommentare, Versionierung in OnlyOffice — v3.4
- ✓ Vorlagen-System mit Platzhalter-Befüllung (mandant.name, akte.aktenzeichen etc.) — v3.4
- ✓ Briefkopf-Verwaltung (Logo + Kanzleidaten, Formular-Modus) — v3.4
- ✓ PDF-Export mit Kanzlei-Briefkopf — v3.4
- ✓ Vorlagenkategorien + Freie Ordnerstruktur — v3.4
- ✓ Ordner-Schemata für Akten (Standard-Ordner pro Akte, admin-verwaltbar) — v3.4

**E-Mail (v3.4 Phase 3 + 3.1):**
- ✓ IMAP-Sync mit IDLE für eingehende E-Mails in Echtzeit — v3.4
- ✓ Shared Kanzlei-Postfach + per-User Mailboxen — v3.4
- ✓ Inbox-Seite mit Filtern (veraktet/unveraktet, Akte, Verantwortlicher) — v3.4
- ✓ E-Mail-Detailansicht (Header, Body, Anhänge) — v3.4
- ✓ E-Mail verakten (Auto-Suggest, One-Click, Anhänge ins DMS) — v3.4
- ✓ Compose-View mit Rich-Text, DMS-Anhänge, Akte-Verknüpfung, SMTP — v3.4
- ✓ Ticket aus E-Mail erstellen — v3.4
- ✓ Akte Tab "E-Mails" — v3.4

**Dokument-Pipeline (v3.4 Phase 4 + 4.1):**
- ✓ Auto-OCR bei PDF-Upload (Stirling-PDF, skip wenn bereits durchsuchbar) — v3.4
- ✓ OCR-Status speichern + Badge + manueller Retry — v3.4
- ✓ OCR-Ergebnis in Meilisearch indiziert — v3.4
- ✓ PDF-Preview im Browser (react-pdf, Navigation, Zoom, Download) — v3.4
- ✓ Dokument-Detailseite (Metadaten, Versionen, Status, Tags, Audit-Historie) — v3.4
- ✓ RAG-Pipeline: Paragraph-Chunking, Ollama Embedding, pgvector Storage — v3.4

**Finanzen (v3.4 Phase 5):**
- ✓ RVG-Berechnung (KostBRaeG 2025, Anrechnung, PKH, 50+ Tests) — v3.4
- ✓ Rechnungen (Nummernkreis, Status-Flow, §14 UStG, PDF mit Briefkopf) — v3.4
- ✓ E-Rechnung: XRechnung CII + ZUGFeRD PDF/A-3 — v3.4
- ✓ Aktenkonto mit Fremdgeld-Compliance (5-Werktage, 15k Anderkonto) — v3.4
- ✓ DATEV CSV-Export (Buchungsstapel) — v3.4
- ✓ SEPA pain.001 + pain.008 — v3.4
- ✓ Banking-Import CSV + CAMT053 mit semi-automatischer Zuordnung — v3.4
- ✓ Zeiterfassung (Timer + manuell + Akte-Auto-Start) — v3.4

**KI / OpenClaw (v3.4 Phase 6):**
- ✓ Multi-Provider AI (Ollama/OpenAI/Anthropic) via Vercel AI SDK v4 — v3.4
- ✓ Akten-spezifischer Document Chat mit RAG, Quellennachweisen, Konfidenz — v3.4
- ✓ Proaktive Helena-Agentin (E-Mail/Dokument-Scan, Aktionsvorschläge) — v3.4
- ✓ Auto-Fristenerkennung aus Schriftsätzen → Kalender-ENTWURF — v3.4
- ✓ Auto-Beteiligte-Erkennung aus Dokumenten → Vorschlag — v3.4
- ✓ KI-Entwurf-Workflow: Jedes KI-Ergebnis = ENTWURF, explizite Freigabe — v3.4
- ✓ Chat-Verlauf speichern (pro User + pro Akte) — v3.4
- ✓ Token-Usage-Tracking pro User/Akte + Admin-Dashboard — v3.4
- ✓ AI-Runner: Idempotenz + Retry + Rate-Limits — v3.4
- ✓ Quellennachweise bei KI-Antworten (Dokument + Absatz) — v3.4

**beA (v3.4 Phase 6):**
- ✓ beA-Posteingang (Empfangen + Auto-Akte-Zuordnung) — v3.4
- ✓ beA-Postausgang (Senden mit Dokumentenanhang) — v3.4
- ✓ eEB (Elektronisches Empfangsbekenntnis) — v3.4
- ✓ Prüfprotokoll anzeigen/archivieren — v3.4
- ✓ Safe-ID-Verwaltung an Kontakten — v3.4
- ✓ XJustiz-Parser + Viewer — v3.4

**Rollen & Sicherheit (v3.4 Phase 7 + 8 + 9):**
- ✓ Akten-Zugriff: Persönlich + Gruppen/Dezernate + Admin-Override — v3.4
- ✓ SEKRETARIAT als eingeschränkter Sachbearbeiter (kein Freigeben) — v3.4
- ✓ 4-Rollen-System (ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT) — v3.4
- ✓ Systemweiter Audit-Trail (Admin-Ansicht + pro Akte + CSV/PDF-Export) — v3.4
- ✓ DSGVO: Anonymisierung, Auskunftsrecht PDF, 10-Jahres-Aufbewahrung — v3.4
- ✓ Health-Checks (App/Worker/Redis/Ollama) + Email-Alerts — v3.4
- ✓ Versand-Gate (ENTWURF-Dokumente können nicht versendet werden) — v3.4
- ✓ RBAC-Enforcement auf allen API-Routes (Finance, Dashboard, KI, beA) — v3.4

**Docker Build (v3.5 Phase 10):**
- ✓ Webpack-Fehler in Financial Module behoben — v3.5
- ✓ Production Docker Build lauffähig (alle 9 Services healthy) — v3.5

**Glass UI (v3.5 Phase 11):**
- ✓ oklch Design-Token-System (4 Glass-Tier, Gradient-Mesh, Dark Mode) — v3.5
- ✓ Animiertes Glass-Sidebar (Motion/React v11, backdrop-blur-xl, Dark-Mode-Toggle) — v3.5
- ✓ Glass-Komponentenbibliothek (GlassCard, GlassPanel, GlassKpiCard, glass-input, glass-shimmer) — v3.5
- ✓ Alle 26 Dashboard-Seiten auf Glass-Design migriert — v3.5

### Active

<!-- v3.6 scope — deferred from v3.5 -->

**Falldatenblätter:**
- [ ] Generisches Framework für Rechtsgebiet-spezifische Felder (Konfiguration, nicht hart codiert)
- [ ] Mindestens 3 Beispiel-Schemata (Arbeitsrecht, Familienrecht, Verkehrsrecht)

**BI-Dashboard:**
- [ ] Standard-KPI-Kacheln (Neue Akten/Monat, offene Posten, fällige Fristen, Umsatz/Monat)
- [ ] RBAC-geschützt (nur ADMIN + ANWALT)

**Export:**
- [ ] CSV + XLSX Export für Akten, Kontakte, Finanzdaten

## Future (post v3.6)

**Mandantenportal:**
- [ ] Freigegebene Dokumente einsehen/herunterladen
- [ ] Sichere Nachrichten an Anwalt senden
- [ ] Aktuellen Sachstand einsehen
- [ ] Eigene Unterlagen hochladen
- [ ] Authentifizierung: Einladungslink + Passwort

**Internes Messaging:**
- [ ] Akten-bezogene Diskussionen (Case Threads)
- [ ] Allgemeine Kanäle (Kanzlei-weit)
- [ ] @Mentions + In-App-Benachrichtigungen

**Mahnwesen:**
- [ ] Mahnstufen, Mahnlauf, Mahn-PDF

**Fallzusammenfassung:**
- [ ] Timeline + Key Facts pro Akte (KI-generiert)

**Globaler KI-Chat:**
- [ ] Aktenübergreifende Suche und Fragen via RAG

**CalDAV-Sync:**
- [ ] Bidirektionaler Sync mit externen Kalendern

**PDF-Tools (Stirling-PDF):**
- [ ] Merge, Split, Reorder/Rotate, Compress, Watermark, Redact

**Sonstiges:**
- [ ] VoIP: Sipgate Anrufjournal + Zuordnung

### Out of Scope

<!-- Explicit boundaries with reasoning. -->

- Native Mobile App — Web-first, responsive reicht; native kommt frühestens nach v2
- Desktop-Client — Widerspricht Browser-Only-Prinzip
- Zwangsvollstreckung — Eigenes Modul, nach MVP als Erweiterung
- Kanzlei-übergreifende Mandats-Teilung — Zu komplex
- beA native Integration (ohne bea.expert) — OSCI/Java-Komplexität; €10/Monat vernachlässigbar
- Eigenes Buchhaltungsmodul (FiBu) — DATEV-Export deckt Steuerberater-Schnittstelle ab
- Bidirektionaler IMAP-Sync (Flags/Löschen zurück) — One-Way-Import korrekt; Flags zurück = fragil
- KI Auto-Versand — Absolute No-Go per BRAK 2025 + BRAO
- Offline Mode — Real-time ist Core Value

## Context

Shipped v3.5 with ~91,300 LOC TypeScript (234 files changed, +26,707/-1,020 lines in v3.5).
Tech stack: Next.js 14+ (App Router), TypeScript, Tailwind CSS (oklch), shadcn/ui, PostgreSQL 16 + Prisma (60+ Models), MinIO, Meilisearch, OnlyOffice Docs (Docker), Redis + BullMQ, Socket.IO, Stirling-PDF, Vercel AI SDK v4 (Ollama/qwen3.5:35b / OpenAI / Anthropic), bea.expert, Motion/React v11.
Docker Compose deployment with 9 services (app, worker, postgres, redis, minio, meilisearch, stirling-pdf, onlyoffice, ollama).
All BUILD and Glass UI requirements satisfied. FD/BI/EXP deferred to v3.6.
Minor tech debt: 62× font-heading in sub-components, 77× .glass alias in sub-components (both non-blocking), Briefkopf OnlyOffice editing deferred, bea.expert library requires commercial registration.

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
| Ollama + Mistral 7B als Standard-LLM | Self-hosted, keine Datenabflüsse, DSGVO-konform | ✓ Good — Multi-provider with Ollama default |
| Multi-Provider via AI SDK v4 | Flexibilität für Cloud-LLMs (OpenAI, Anthropic) | ✓ Good — Provider factory with runtime switching |
| OnlyOffice statt TipTap | Native DOCX-Unterstützung, Collaboration, Track Changes | ✓ Good — WOPI rebuilt, co-editing stable |
| IMAP IDLE statt Polling | Echtzeit-E-Mail-Empfang, professionelle UX | ✓ Good — ImapFlow with reconnection strategy |
| Briefkopf-Bearbeitung in OnlyOffice | Kein eigener Designer nötig | ⚠️ Revisit — Form mode works, OnlyOffice editing deferred |
| Freie Vorlagen-Ordner (kein fixes Schema) | Maximale Flexibilität für Kanzlei-Workflows | ✓ Good |
| Ordner-Schemata für Akten + frei erweiterbar | Konsistente Grundstruktur + Flexibilität | ✓ Good — Per-Sachgebiet defaults with global fallback |
| 5-stufige Prioritäten (Sehr niedrig → Dringend) | Feinere Steuerung bei Fristen/Wiedervorlagen | ✓ Good |
| DATEV CSV-Export | Am verbreitetsten, deckt meisten Steuerberater ab | ✓ Good — EXTF_ format implemented |
| XRechnung + ZUGFeRD beides | Pflicht seit 01.01.2025 B2B | ✓ Good — Hand-built CII XML + pdf-lib embedding |
| SEPA pain.001 + pain.008 | Überweisungen + Lastschriften | ✓ Good — sepa.js XML generation |
| Shared + per-User Mailboxen | Kanzlei-Posteingang + individuelle Accounts | ✓ Good — Multi-mailbox with IDLE per mailbox |
| 4-Rollen statt 5 (PRAKTIKANT entfernt) | PRAKTIKANT-Rolle redundant, SACHBEARBEITER deckt ab | ✓ Good — Simplified RBAC |
| Hand-built CII XML statt @e-invoice-eu/core | Bibliothek zu komplex, Hand-Build gibt volle EN16931-Kontrolle | ✓ Good |
| Non-fatal Versand-Gate | Document status failure sollte Send nie blockieren | ✓ Good — try-catch wrapper |
| Helena als proaktive Agentin | KI-Differentiator: scannt automatisch, schlägt vor, erstellt nie auto | ✓ Good — Suggestions feed with ENTWURF enforcement |
| oklch + 4 Glass-Tiers (v3.5) | Konsistentes Design-Token-System, Dark Mode, Apple Sequoia-Ästhetik | ✓ Good — globals.css token foundation, keine CSS-Variablen-Konflikte |
| Motion/React v11 (v3.5) | Spring-Physics-Animationen, accessible (prefers-reduced-motion) | ✓ Good — sidebar, modals, buttons, count-up KPIs |
| var(--glass-*) statt opacity patterns (v3.5) | Design-Token-Konsistenz über alle Komponenten | ✓ Good — glass-border-color, glass-bg canonical tokens |
| Inter statt DM Serif Display (v3.5) | SF Pro Display → Inter → system-ui Stack, moderner, schneller | ✓ Good — keine custom font loading, system-native feel |
| qwen3.5:35b als Ollama-Standard (v3.5) | Deutlich besser als mistral:7b für Legal-Domain | ✓ Good — GPU-required but justified |
| NEXT_PHASE Build-Flag (v3.5) | Verhindert pino-roll File-Transport bei SSR-Build-Zeit | ✓ Good — clean production builds |
| Hybrid-Messaging (Akte + allgemein) | Beides gebraucht: case-spezifisch + Kanzlei-weit | — Pending (v3.6+) |
| Mandantenportal mit Einladungslink + Passwort | Einfach, sicher, kein OAuth-Setup für Mandanten | — Pending (v3.6+) |
| CalDAV-Sync bidirektional | Integration mit bestehenden Kalender-Systemen | — Pending (v3.6+) |

---
*Last updated: 2026-02-26 after v3.5 milestone*
