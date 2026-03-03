# AI-Lawyer — AI-First Kanzleisoftware

## What This Is

Eine vollständig browserbasierte Kanzleisoftware mit autonomer KI-Agentin ("Helena") für die Kanzlei Baumfalk, Dortmund. Vereint Aktenverwaltung, Dokumentenmanagement mit OnlyOffice (Co-Editing, Track Changes, Vorlagen, Briefkopf), BGB-konforme Fristenberechnung, vollständigen E-Mail-Client (IMAP IDLE + SMTP), OCR-Pipeline mit RAG-Ingestion, Finanzen (RVG, Rechnungen, E-Rechnung, DATEV, SEPA, Zeiterfassung), beA-Integration, autonome KI-Agentin mit ReAct-Loop, Tool-Calling, deterministischem Schriftsatz-Orchestrator, proaktivem Background-Scanner mit Cross-Akte Urteil-Matching, per-Akte Memory und QA-Gates, internes Echtzeit-Messaging mit Akten-Threads und strukturierte Falldatenblaetter mit Community-Template-Workflow — RBAC mit Dezernaten, DSGVO-Compliance und Audit-Trail — alles self-hosted via Docker Compose, alles im Browser.

## Core Value

Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollständig im Browser verwalten, während eine autonome KI-Agentin aktenübergreifend lernt, Schriftsätze deterministisch entwirft, proaktiv Scanner-Alerts auslöst, per-Akte Memory pflegt und als digitale Rechtsanwaltsfachangestellte mitarbeitet — ohne dass KI-generierte Inhalte jemals automatisch versendet oder finalisiert werden (BRAK 2025 / BRAO 43).

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

**Helena Agent (v0.2):**
- ✓ ReAct Agent-Loop mit 14 Tools (9 read + 5 write), bounded execution, Ollama response guard, token budget, rate limiter — v0.2
- ✓ Deterministic Schriftsatz-Orchestrator (Intent → Slot-Filling → RAG → Assembly → ERV-Validator) mit SchriftsatzSchema — v0.2
- ✓ @Helena Task-System: @-mention parsing, BullMQ queue, Socket.IO progress, abort, REST API — v0.2
- ✓ Draft-Approval Workflow: ENTWURF Prisma $extends gate (BRAK 2025), HelenaDraft lifecycle, feedback-to-context — v0.2
- ✓ Proaktiver Background-Scanner (BullMQ cron): Frist-Check, Inaktivitaets-Check, Anomalie-Check, Alert-Deduplizierung, Eskalation — v0.2
- ✓ Alert-System (6 Typen) + Alert-Center Dashboard + Socket.IO Push + Sidebar-Badge — v0.2
- ✓ Helena Memory: per-Akte Kontext, auto-refresh, DSGVO cascade delete — v0.2
- ✓ Activity Feed UI: Akte-Detail Feed ersetzt Tabs, Composer mit @Helena, Helena vs Human Attribution — v0.2
- ✓ QA-Gates: Goldset (20 Queries), Retrieval-Metriken (Recall@k, MRR), Halluzinations-Check, Release-Gates — v0.2
- ✓ Inline Draft-Review im Feed: Accept/Reject/Edit ohne Seitenwechsel — v0.2
- ✓ Schriftsatz-Retrieval-Log (Audit-Trail: Chunks → Entwurf) — v0.2

**RAG Pipeline Quality (v0.1):**
- ✓ Hybrid Search (Meilisearch BM25 + pgvector via RRF, k=60, N=50) — v0.1
- ✓ Parent-Child Chunking (500-Token Kind-Chunk, 2.000-Token Parent-Chunk) — v0.1
- ✓ Cross-Encoder Reranking via Ollama (top-50 → top-10, 3s fallback) — v0.1

**Gesetze-RAG (v0.1):**
- ✓ bundestag/gesetze in law_chunks (tägl. BullMQ-Cron 02:00, Encoding-Smoke-Test) — v0.1
- ✓ Helena retrievet Top-5 Normen bei Rechtsfragen mit "nicht amtlich"-Disclaimer — v0.1
- ✓ Normen-Verknüpfung in Akte-UI (Suchmodal, Chip-Liste, pinned im Helena-Kontext) — v0.1

**Urteile-RAG (v0.1):**
- ✓ BMJ Rechtsprechung-im-Internet in urteil_chunks (7 Bundesgerichts-RSS-Feeds) — v0.1
- ✓ NER PII-Filter via Ollama (Few-Shot + Institution-Whitelist, State Machine) — v0.1
- ✓ BAG RSS-Feed täglicher inkrementeller Update — v0.1
- ✓ Helena zitiert Urteile mit Gericht + AZ + Datum + Quellenlink (kein LLM-generiertes AZ) — v0.1

**Arbeitswissen-RAG (v0.1):**
- ✓ Amtliche Formulare in muster_chunks mit normierten {{PLATZHALTER}} — v0.1
- ✓ Admin-Upload UI /admin/muster (MinIO, NER-Status-Badge, nie Git) — v0.1
- ✓ PII-Anonymisierung kanzlei-eigener Muster (PENDING_NER → INDEXED | REJECTED) — v0.1
- ✓ Helena erstellt ENTWURF-Schriftsätze (Rubrum, Anträge, Begründung + {{PLATZHALTER}}) — v0.1

**Kanzlei-Collaboration (v0.3):**
- ✓ Internes Messaging: Akten-bezogene Threads + allgemeine Kanäle + @Mentions + Echtzeit Socket.IO — v0.3
- ✓ SCAN-05 Neu-Urteil-Check: Cross-Akte Semantic Search + NEUES_URTEIL Alerts + Helena-Briefing — v0.3
- ✓ Falldatenblaetter: Strukturierte Checklisten pro Falltyp + Community-Template-Workflow + Admin-Approval — v0.3

### Active

<!-- Next milestone: v0.5 (to be defined via /gsd:new-milestone) -->
(No active milestone — run `/gsd:new-milestone` to define v0.5 scope)

**Gamification (v0.4 — validated):**
- ✓ Gamification Engine (UserGameProfile, Quest DSL, XP/Level/Runen/Streak, BullMQ crons, DSGVO opt-in) — v0.4
- ✓ Dashboard QuestWidget (XP bar, quests, streak, Runen, deep-links, opt-in toggle) — v0.4
- ✓ Bossfight (Team Backlog-Monster, 4 phases, Socket.IO real-time, admin threshold) — v0.4
- ✓ Klassen + Weekly + Special Quests (role-specific, delta conditions, admin campaigns) — v0.4
- ✓ Anti-Missbrauch (qualified completion, Redis Runen cap, random audits, atomic tx) — v0.4
- ✓ Item-Shop + Inventar (18 items, 4 rarity tiers, cosmetic equip, comfort perks) — v0.4
- ✓ Heldenkarte (avatar, badges, quest history) — v0.4
- ✓ Team-Dashboard + Reporting (quest rate, backlog delta, bossfight damage, PDF/CSV) — v0.4
- ✓ Quick Wins (clickable KPIs, OCR recovery, empty states, Chat rename, Zeiterfassung edit) — v0.4

### Backlog

<!-- Deferred to future milestones -->

**BI-Dashboard + Export:**
- [ ] KPI-Kacheln (Neue Akten, offene Posten, Fristen, Umsatz)
- [ ] CSV/XLSX Export für Akten, Kontakte, Finanzdaten

**Helena Intelligence:**
- [ ] Helena befüllt existierende Falldatenblaetter automatisch aus Akte-Daten
- [ ] Helena schlägt neue Falldatenblatt-Templates basierend auf Fallmustern vor
- [ ] Fallzusammenfassung: Timeline + Key Facts pro Akte (KI-generiert)
- [ ] Globaler KI-Chat: Aktenübergreifende Suche und Fragen via RAG

**Mandantenportal:**
- [ ] Freigegebene Dokumente einsehen/herunterladen
- [ ] Sichere Nachrichten an Anwalt senden
- [ ] Aktuellen Sachstand einsehen
- [ ] Eigene Unterlagen hochladen
- [ ] Authentifizierung: Einladungslink + Passwort

**Mahnwesen:**
- [ ] Mahnstufen, Mahnlauf, Mahn-PDF

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

Shipped v0.4 with ~135k LOC TypeScript (108 commits in v0.4, 746+ total).
Tech stack: Next.js 14+ (App Router), TypeScript, Tailwind CSS (oklch), shadcn/ui, PostgreSQL 16 + Prisma (85+ Models including UserGameProfile, Quest, QuestCompletion, Bossfight, BossfightDamage, ShopItem, UserInventoryItem, WeeklySnapshot), MinIO, Meilisearch, OnlyOffice Docs (Docker), Redis + BullMQ, Socket.IO, Stirling-PDF, Vercel AI SDK v4 (Ollama/qwen3.5:35b / OpenAI / Anthropic), bea.expert, Motion/React v11, Recharts, canvas-confetti, pdf-lib, fast-xml-parser, pgvector HNSW.
Docker Compose deployment with 9 services (app, worker, postgres, redis, minio, meilisearch, stirling-pdf, onlyoffice, ollama).
Helena is an autonomous agent with ReAct-Loop, 14 tools, deterministic Schriftsatz pipeline, @-mention task system, draft-approval workflow, background scanner with 7 alert types (incl. NEUES_URTEIL), per-Akte memory, QA-gates, and channel messaging integration.
Gamification system: Quest DSL evaluator, XP/Level/Runen/Streak engine, Bossfight team mechanic, Item-Shop with 18 items (4 rarity tiers), Heldenkarte profile with 8 achievement badges, Team-Dashboard with Recharts trend charts and PDF/CSV reporting, Anti-Missbrauch guards (qualified completion, Redis Runen cap, random audits).
Known tech debt: helena/index.ts TS type mismatches, search-web.ts stub, @Helena silent in ALLGEMEIN channels, sidebar unread badge not real-time for background, Akte stats counter shows old chatNachrichten, doppel-runen 2h window edge case.

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
| Hybrid-Messaging (Akte + allgemein) (v0.3) | Beides gebraucht: case-spezifisch + Kanzlei-weit | ✓ Good — ALLGEMEIN + AKTE channels with lazy-creation and RBAC sync |
| Falldatenblaetter als DB-backed Templates (v0.3) | Single source of truth statt TypeScript registry | ✓ Good — 8 Feldtypen, Gruppen-Builder, Community-Workflow |
| @Helena AKTE-only in Messaging (v0.3) | Helena braucht akteId-Kontext für sinnvolle Antworten | ✓ Good — design trade-off, ALLGEMEIN silently skipped |
| Nightly cron für Akte-Embeddings (v0.3) | Einfacher als on-demand, 02:30 vor Urteile-Sync | ✓ Good — akzeptable Staleness für 5-Personen-Kanzlei |
| Banner refetch statt auto-insert (v0.3) | Konsistent mit Activity Feed Pattern, verhindert Race Conditions | ✓ Good — message:new triggers refetch, not local insert |
| Mandantenportal mit Einladungslink + Passwort | Einfach, sicher, kein OAuth-Setup für Mandanten | — Pending |
| CalDAV-Sync bidirektional | Integration mit bestehenden Kalender-Systemen | — Pending |

| Zero new npm packages for v0.2 (v0.2) | All agent capabilities on existing AI SDK v4 + BullMQ + Prisma + Socket.IO | ✓ Good — no dependency bloat |
| Deterministic Schriftsatz pipeline (v0.2) | generateObject not free-form ReAct for legal filings | ✓ Good — predictable, validated output |
| ENTWURF gate via Prisma $extends (v0.2) | BRAK 2025 / BRAO 43 compliance at database level, not HTTP | ✓ Good — defense-in-depth |
| lockDuration:120s on helena-agent queue (v0.2) | Default 30s causes duplicate agent runs | ✓ Good — BullMQ v5 best practice |
| Rule-based complexity classifier (v0.2) | No LLM call for mode/tier selection, German legal term patterns | ✓ Good — fast, deterministic |
| Activity Feed replaces 8 tabs (v0.2) | Chronological view with all event types, reduces page complexity | ✓ Good — 921→152 LOC reduction |
| Goldset as TypeScript fixture (v0.2) | Version-controlled deterministic QA, not DB | ✓ Good — reproducible tests |
| PendingSchriftsatz for multi-turn (v0.2) | @@unique([userId, akteId]) for one pending pipeline per user per Akte | ✓ Good — clean conversation state |
| Hybrid Search via RRF (v0.1) | BM25 + pgvector parallel retrieval beats vector-only for exact §-Nummern | ✓ Good — k=60, N=50, measurably better exact-match recall |
| Cross-Encoder Reranking via LLM-as-reranker (v0.1) | Qwen3.5-as-reranker validated (dedicated Qwen3-Reranker-4B availability unverified) | ✓ Good — 3s AbortSignal timeout, fallback to RRF order |
| Inline NER gate for Urteile (v0.1) | Synchronous runNerFilter() in ingestUrteilItem() cleaner than BullMQ for per-item flow | ✓ Good — double gate: inline before INSERT + piiFiltered=true query filter |
| BullMQ NER state machine for Muster (v0.1) | Async because upload flow needs UI feedback on status | ✓ Good — PENDING_NER→NER_RUNNING→INDEXED/REJECTED, no bypass path |
| seedAmtlicheFormulare() at worker startup (v0.1) | Idempotent via SystemSetting guard, avoids cron complexity for one-time seed | ✓ Good — content bypasses MinIO for hardcoded templates |
| params Promise pattern in Next.js 15 (v0.1) | Sync params pattern caused 404s on DELETE/PATCH — await params required | ✓ Good — caught by integration checker, 2-line fix applied |

## Shipped Milestones

- **v3.4 Full-Featured Kanzleisoftware** — 13 phases, 38 plans (2026-02-25)
- **v3.5 Production Ready** — 2 phases, 10 plans (2026-02-26)
- **v0.1 Helena RAG** — 7 phases, 19 plans (2026-02-27)
- **v0.2 Helena Agent** — 10 phases, 23 plans (2026-02-28)
- **v0.3 Kanzlei-Collaboration** — 5 phases, 13 plans (2026-03-02)
- **v0.4 Quest & Polish** — 10 phases, 21 plans (2026-03-03)

**LLM Strategy:** Hybrid — Ollama (qwen3.5:35b) default, Cloud-Provider (Claude/GPT-4) optional pro Task, konfigurierbar in Settings.

| Gamification opt-in DSGVO (v0.4) | GameProfile only visible to owning user, opt-in toggle, no cross-user reads | ✓ Good — self-only API routes, no team-level individual data |
| Quest DSL evaluator (v0.4) | JSON DSL in Quest.bedingung with union types (count/delta) — machine-readable, no LLM parsing | ✓ Good — evaluates against Prisma COUNT/delta queries, extensible |
| Atomic Prisma $transaction for rewards (v0.4) | XP + Runen + QuestCompletion in single transaction — prevents drift from concurrent completions | ✓ Good — P2002 idempotent dedup catches races |
| Redis INCR for Runen cap (v0.4) | Daily cap enforcement mirrors rate-limiter.ts pattern — fail-open on Redis errors | ✓ Good — INCR+EXPIRE atomic, 40/day WV-only cap |
| Absent-until-loaded pattern (v0.4) | Widgets return null until fetch completes — no layout shift, no loading spinner | ✓ Good — QuestWidget, BossfightBanner, Heldenkarte all use this |
| canvas-confetti for Bossfight (v0.4) | Only new npm dependency (6KB) for boss victory celebration | ✓ Good — fire-and-forget, no cleanup needed |
| Recharts for backlog trend (v0.4) | LineChart with glass-style tooltip for Team Dashboard | ✓ Good — consistent with existing chart patterns |
| Condition templates for Special Quests (v0.4) | Server-side templates prevent admin from writing raw JSON — select preset, fill values | ✓ Good — zero JSON knowledge required |

---
*Last updated: 2026-03-03 after v0.4 milestone completion*
