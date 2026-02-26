# Fix Plan - AI-Lawyer Kanzleisoftware

## Priority 1: Foundation/Critical Path

- [x] Ticket-Liste (Basis) implementieren: Tabelle mit Status, Titel, Akte, Fälligkeit, Priorität, Tags
  - Neue Route `/tickets` mit Server Component, Prisma-Query (inkl. Akte/Verantwortlich), Glass-Table
  - Reusable `TicketSearchBar` in `src/components/tickets/ticket-search-bar.tsx` mit `basePath`-Prop
  - Sidebar: "Tickets" Nav-Item mit TicketCheck-Icon nach E-Mails eingefügt
  - Overdue-Hervorhebung (rose) bei überfälligen Tickets, responsive Spalten (hidden md/lg)
- [x] Ticket-Filter: Status (OFFEN/IN_BEARBEITUNG/ERLEDIGT) + URL-Query
  - Bereits in TicketSearchBar + Tickets-Page implementiert (Select → URL-Param → Prisma where)
- [x] Ticket-Filter: Fälligkeit (heute/überfällig/7 Tage) + URL-Query
  - Select in TicketSearchBar mit 3 Optionen, Prisma-Where mit Datumsvergleich (gte/lt/lte)
- [x] Ticket-Filter: Tag (inkl. `ai:`) + URL-Query
  - Bereits in TicketSearchBar implementiert (tag → Prisma `has`)
- [x] Ticket-Filter: Akte + URL-Query
  - Select mit offenen Akten (max 200), akteId als URL-Param → Prisma where
- [x] Ticket-Sortierung: Fälligkeit/Priorität/zuletzt geändert
  - Sort-Select in TicketSearchBar, URL-Param `sort`, Prisma orderBy (faelligAm/prioritaet/updatedAt)
- [x] Ticket-Quick-Action: Statuswechsel in Liste
  - TicketStatusSelect Client-Component mit PATCH /api/tickets/[id] + router.refresh()
- [x] Ticket-Quick-Action: Verantwortlichen setzen in Liste
  - TicketVerantwortlichSelect Client-Component, Users-Liste vom Server geladen
- [x] Ticket-Detailseite: Basisfelder + Inline-Edit (Beschreibung, Fälligkeit)
  - Route `/tickets/[id]`, TicketDetail Client-Component mit Inline-Edit für Titel, Beschreibung, Fälligkeit
  - Sidebar-Metadaten: Status, Priorität, Verantwortlich, Akte (alle als Select mit PATCH)
  - Verknüpfte E-Mails, Tags, Zeitstempel-Anzeige
- [x] Ticket-Erstellen: Minimal-Dialog (Titel, Beschreibung, Akte, Fälligkeit, Priorität, Verantwortlicher, Tags)
  - Route `/tickets/neu`, Client-Component mit Formular, POST /api/tickets, Redirect zur Detailseite
  - Nutzt TicketTagInput für Tags, lädt Users + Akten per API

- [x] KI-Entwürfe: Liste (ChatNachricht.userId=null) + Filter (Akte, Datum, Typ)
  - Route `/ki-entwuerfe`, API `/api/ki-entwuerfe`, Server-Component mit Prisma where userId=null
  - KiEntwuerfeSearchBar mit Akte/Datum/Suche-Filtern, Sidebar-Nav mit Bot-Icon
- [x] KI-Entwürfe: Detailansicht (Quelle Task/Tag, Akte-Link, Zeitstempel)
  - Route `/ki-entwuerfe/[id]`, KiEntwurfDetail Client-Component, Akte-Link, Bezugsdokument, Zeitstempel
- [x] KI-Entwürfe: Button „Als Dokument ENTWURF anlegen”
  - POST /api/dokumente mit status=ENTWURF, ordner=”KI-Entwürfe”, Tags ki-entwurf
- [x] KI-Entwürfe: Button „Als Aktennotiz speichern”
  - POST /api/dokumente mit status=ENTWURF, ordner=”Aktennotizen”, Tags ki-entwurf+aktennotiz
- [x] KI-Kennzeichnung überall: „KI” + „nicht freigegeben”
  - DokumentStatusBadge zeigt jetzt neben „KI”-Badge auch „nicht freigegeben” (amber) wenn status != FREIGEGEBEN/VERSENDET
  - PreviewDialog: Props um status/erstelltDurch erweitert, zeigt KI + nicht-freigegeben Badges in Metadata-Bar
  - KI-Entwürfe-Liste + Detail zeigten Badges bereits (violet KI-Entwurf + amber nicht freigegeben)

- [x] AI-Service: Prompt-Templates fixieren (summary/draft/check/monitor) und zentral bereitstellen
  - Neues Modul `src/lib/ai/prompt-templates.ts`: zentrale Templates für summary, draft, check, monitor, auto
  - Shared SYSTEM_PROMPT_DE mit RDG-Hinweis, `tagToAction()`, `buildPrompt()`, `actionLabel()` API
  - `process-tasks.ts` refactored: nutzt zentrale Templates, case-context-Assembly in eigene async-Funktion extrahiert
  - ai:check (Prüfbericht mit Risikoleveln) und ai:monitor (Statusbericht) jetzt vollständig implementiert
- [x] AI-Service: harte Defaults setzen (Modell `mistral:7b`, num_ctx, temperature, top_p)
  - `AI_DEFAULTS` Konstante in `ollama.ts`: model=mistral:7b, numCtx=32768, temperature=0.3, topP=0.9
  - `top_p` Support in OllamaGenerateOptions + body builder hinzugefügt (vorher fehlend)
  - Env-Var-Overrides (`OLLAMA_DEFAULT_MODEL`, `OLLAMA_NUM_CTX`) werden einmal resolved, nicht bei jedem Call
  - Templates in `prompt-templates.ts` überschreiben temperature/maxTokens pro Aktion (summary=0.2, draft=0.3 etc.)
- [x] AI-Runner: Locking (DB-Feld) einführen, um Doppelverarbeitung zu verhindern
  - Prisma: `aiLockedAt DateTime?` + `aiLockedBy String?` auf Ticket-Model
  - `acquireLock()`: Atomic `updateMany` mit WHERE `aiLockedAt IS NULL OR aiLockedAt < staleThreshold`
  - Stale-Lock-Timeout: 10 Minuten — abgestürzte Runner blockieren nicht dauerhaft
  - `releaseLock()`: Explizit bei Fehler; bei Erfolg wird Lock im selben Update mit ERLEDIGT-Status gelöscht
  - Runner-ID: `runner-{uuid}` pro processTaggedTasks()-Aufruf
- [ ] AI-Runner: Idempotenz-Regel (pro Ticket+Tag max. 1 Ergebnis/Tag) erzwingen
- [ ] AI-Runner: Retry (max 2) + Tag `ai:error` bei Fail
- [ ] AI-Runner: Endpoint `/api/openclaw/process` nur ADMIN + Rate-Limit

- [ ] RAG: Embedding-Storage (Dokument-Chunk-Embeddings) als Prisma-Model anlegen
- [ ] RAG: Chunking (DOCX/PDF/Text) implementieren, Output in DB speichern
- [ ] RAG: Embedding-Job (nur neue/geänderte Dokumente) implementieren
- [ ] RAG: Retrieval-API pro Akte (Top-K + Snippets) implementieren
- [ ] Document-Chat pro Akte: UI-Shell + API (Retrieval → Ollama → Antwort + Quellen)
- [ ] Document-Chat: Verlauf speichern (AiConversation/ChatNachricht)

- [ ] Internes Messaging: Datenmodell finalisieren (Thread, Message, Read-States, Mentions, Attachments/Links)
- [ ] Internes Messaging: Thread-Liste (Inbox) mit Filtern (Akte, ungelesen, erwähnt, zugewiesen)
- [ ] Internes Messaging: Thread-View (Chat) mit performantem Infinite-Scroll + „Jump to latest“
- [ ] Internes Messaging: Composer (Markdown-lite, Attachments/Doc-Links, Mention-Picker `@`)
- [ ] Internes Messaging: Mentions (@User, @Role) + Benachrichtigungen (In-App)
- [ ] Internes Messaging: Message-Actions (Antworten, Zitieren, Link kopieren, Task daraus erzeugen)
- [ ] Internes Messaging: „Task aus Nachricht“ (prefill Titel/Body, Link zur Nachricht)
- [ ] Internes Messaging: „Dokument verlinken“ (Picker, erzeugt Card/Preview)
- [ ] Internes Messaging: Berechtigungen sauber (Kanzlei/Akte; Sichtbarkeit nur für Berechtigte)

- [ ] E-Mail: Inbox-Seite (Liste + Pagination)
- [ ] E-Mail: Inbox-Filter (veraktet/unveraktet, Akte, Verantwortlicher)
- [ ] E-Mail: Detailansicht (Header/Body/Anhänge)
- [ ] E-Mail: Aktion „Verakten“ (Modal Akte wählen)
- [ ] E-Mail: Aktion „Ticket erstellen“ (prefill)
- [ ] E-Mail: Compose-View (SMTP senden)
- [ ] Akte: Tab „E-Mails“ (veraktete Mails)

- [ ] Kalender: Fristenberechnung MVP (Wochenende/Feiertag verschieben)
- [ ] Kalender: Tagesübersicht (heute/überfällig) + Quick-Actions
- [ ] Tests: Versand-Gate + Dokumentstatus-Transitionen (RBAC)
- [ ] Tests: OpenClaw-Scope (nur erlaubte Routen)
- [ ] Observability: Health (app/ollama/openclaw) + strukturierte Logs für KI-Aktionen


## Priority 2: Core Features

- [ ] Dokumentansicht: Dokument-Detailseite (Metadaten, Version, Status, Tags, Akte-Link, Historie)
- [ ] Dokumentansicht: PDF-Preview im Browser (Viewer mit Seiten-Navigation, Zoom, Download)
- [ ] Dokumentansicht: Actions-Bar (Umbenennen, Verschieben, Tags, Statuswechsel, „Als PDF exportieren“)

- [ ] Stirling-PDF: Docker-Service integrieren (nur localhost, eigenes Volume)
- [ ] Stirling-PDF: Tesseract direkt anbinden (Stirling-OCR-Backend aktivieren; `deu` + `eng` vorinstallieren)
- [ ] Stirling-PDF: Healthcheck erweitern (Service + OCR verfügbar)

- [ ] Upload-Pipeline: PDF-Auto-OCR aktivieren (jede neue/aktualisierte PDF wird serverseitig OCR-verarbeitet)
- [ ] Upload-Pipeline: OCR-Entscheidungslogik fixieren (OCR nur wenn PDF nicht bereits durchsuchbar; Skip bei schon vorhandenem Textlayer)
- [ ] Upload-Pipeline: OCR-Job-Status speichern (`ocrStatus`: pending/done/failed + `ocrLastRunAt`)
- [ ] Upload-Pipeline: OCR-Queue/Worker implementieren (asynchron, retries, backoff; blockiert nicht den Upload-Request)
- [ ] Upload-Pipeline: Fehlerpfad sauber (bei OCR-Fail: Dokument bleibt nutzbar; Hinweis + Retry-Button)

- [ ] Stirling-PDF: OCR-API-Wrapper implementieren (Upload → OCR → PDF zurück)
- [ ] Entscheidung: Auto-OCR überschreibt Dateiinhalt (gleiche Dokument-ID), Audit protokolliert Lauf
- [ ] Audit: OCR-Lauf protokollieren (DokumentId, Ergebnis, Runtime, Sprache)

- [ ] Dokumentansicht: OCR-Status anzeigen (Badge + „OCR erneut ausführen“)
- [ ] Volltext: OCR-Ergebnis in Meilisearch indizieren (Reindex-Hook nach OCR)
- [ ] Stirling-PDF: „OCR jetzt ausführen“ Action (manuell aus Dokumentansicht; nutzt gleichen Worker)

- [ ] Stirling-PDF: Merge PDFs (mehrere Dokumente auswählen → neues PDF in Akte speichern)
- [ ] Stirling-PDF: Split PDF (Seitenbereich wählen → neue PDFs speichern)
- [ ] Stirling-PDF: Reorder/Rotate Pages (Thumbnails → Operation → neues PDF speichern)
- [ ] Stirling-PDF: Compress PDF (Presets) → neues PDF speichern
- [ ] Stirling-PDF: Extract Pages (Seitenbereich → neues PDF) → neues Dokument speichern
- [ ] Stirling-PDF: Add Watermark (Text/Datum) → neues PDF speichern
- [ ] Stirling-PDF: Redact MVP (Rechtecke zeichnen → serverseitig anwenden) → neues PDF speichern
- [ ] Stirling-PDF: Convert to PDF (DOCX/Images → PDF) → neues Dokument speichern
- [ ] Stirling-PDF: Nach jeder PDF-Operation Auto-OCR + Reindex ausführen

- [ ] Sicherheit: Stirling-Endpunkte nur serverseitig (kein Browser-Direct), Rate-Limit für OCR/Tools


## Priority 3: Polish/Nice-to-have

Entscheidung: **Finanzen in dieser Reihenfolge bauen** (weil jeweils aufeinander aufbaut):

1) **Rechnungen → Mahnwesen → E-Rechnung**
- [ ] Rechnungen: DB-Model (Rechnung + Positionen + Status) anlegen
- [ ] Rechnungen: Nummernkreis (pro Kanzlei/Jahr) anlegen
- [ ] Rechnungen: atomare Nummernvergabe implementieren
- [ ] Rechnungen: UI „Rechnung erstellen“ (Kopf + Positionen)
- [ ] Rechnungen: PDF-Rendering MVP (Briefkopf, Tabelle, Summen)
- [ ] Rechnungen: Statusflow (Entwurf/gestellt/bezahlt/storniert) + Audit
- [ ] Mahnwesen: Mahnstufen definieren
- [ ] Mahnwesen: Mahnlauf (überfällige Rechnungen → Mahnentwurf)
- [ ] Mahnwesen: Mahn-PDF erzeugen + in DMS ablegen
- [ ] E-Rechnung: Pflichtfelder-Validator
- [ ] E-Rechnung: XRechnung XML Export
- [ ] E-Rechnung: ZUGFeRD Export

2) **Aktenkonto → Banking → DATEV → SEPA**
- [ ] Aktenkonto: Buchungs-Model (Einnahme/Ausgabe/Fremdgeld/Auslage) finalisieren
- [ ] Aktenkonto: UI Buchung erfassen + Liste + Saldo
- [ ] Aktenkonto: Beleg-Verknüpfung (Dokument anhängen)
- [ ] Banking: CSV Import + Preview
- [ ] Banking: CAMT Import + Preview (MT940 später)
- [ ] Banking: Zuordnung (Rechnung/Akte) + Übernahme als Buchungen
- [ ] DATEV: Export-Format festlegen + Mapping implementieren
- [ ] DATEV: Export-UI (Zeitraum, Vorschau, Download)
- [ ] SEPA: pain.001 Generator
- [ ] SEPA: Zahlungsauftrag-UI + Export

3) **Zeiterfassung → RVG**
- [ ] Zeiterfassung: Timer MVP pro Akte
- [ ] Zeiterfassung: Manuelle Einträge
- [ ] Zeiterfassung: Auswertung (Summe pro Akte/User)
- [ ] RVG: Streitwert-Eingabe + Validierung
- [ ] RVG: Wertgebühr 1.0 aus Streitwert + Multiplikator
- [ ] RVG: Presets (Geschäfts-/Verfahrens-/Terminsgebühr) auswählen
- [ ] RVG: Ergebnis-Aufschlüsselung + „als Rechnungspositionen übernehmen“

4) **Alles andere später**
- [ ] XJustiz: Parser + Viewer
- [ ] Mandantenportal: Dokumentfreigabe (read-only)
- [ ] VoIP: Sipgate Anrufjournal + Zuordnung
- [ ] CalDAV: Outbound-Sync (AI-Lawyer → CalDAV) one-way
- [ ] BI: Dashboard-Kacheln (Akten/Monat, offene Posten, Fristen)
- [ ] Export: CSV zuerst, XLSX danach


## Discovered
<!-- Ralph adds tasks it discovers here -->

- [ ] Daten-Backfill/Migration: bestehende Dokumente auf `status=ENTWURF` setzen und Freigabe-Felder initialisieren
- [ ] Rate-Limits/Abuse-Protection für OpenClaw-Endpunkte (Token-Bruteforce/DoS; sensible Defaults)
- [ ] E-Mail-Integrationsstrategie dokumentieren (SMTP-only vs. IMAP/OAuth2; Zuständigkeit/Sync-Modell)