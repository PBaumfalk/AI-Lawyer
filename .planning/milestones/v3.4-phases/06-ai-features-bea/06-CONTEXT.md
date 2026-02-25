# Phase 6: AI Features + beA - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Multi-provider AI integration with OpenClaw as the agent backend, document chat via RAG, proactive AI assistant "Helena" that scans documents/emails and generates suggestions, beA electronic legal messaging integration via bea.expert REST API. Every AI output is a draft requiring human approval — never auto-sent.

Phase 4 already built the RAG ingestion pipeline (chunking, embedding, pgvector). Phase 6 builds the retrieval, chat, and agent layers on top.

</domain>

<decisions>
## Implementation Decisions

### Document Chat UX
- Dedicated /ki-chat page (not sidebar in Akte)
- Chat-first layout (like ChatGPT): big chat area center-stage, Akte/document selector as dropdown or sidebar, conversation history on the left
- Inline numbered references [1], [2] for source citations — below the answer, a source list shows document name + relevant passage, click to open document
- Explicit disclaimer text when uncertain ("Ich bin mir nicht sicher, aber..." or "Dazu habe ich keine ausreichenden Informationen") — no scores, natural language
- Default: per-Akte chat. Toggle for cross-Akte queries — searches all accessible Akten, results indicate which Akte each source is from
- Separate chat history per Akte — each Akte has own conversation threads, history grouped by Akte in left sidebar
- Save AI output: both "Als Entwurf speichern" (to KI-Entwuerfe) AND "Als Dokument speichern" (direct to DMS with KI badge) available. Entwurf recommended by default
- Drag & drop file upload into chat — PDFs/DOCX get OCR'd and embedded on the fly if not already indexed
- Quick-action buttons above chat input: "Zusammenfassung erstellen", "Fristen pruefen", "Schriftsatz entwerfen", "Beteiligte identifizieren"
- Token-by-token streaming (like ChatGPT) — real-time response streaming via Vercel AI SDK
- Always German responses — system prompt enforces German regardless of input language
- "Fallzusammenfassung" one-click button on Akte detail page — generates structured timeline + key facts, saved as Entwurf
- Merge /ki-entwuerfe into /ki-chat — old page redirects, chat history and saved drafts in one place
- Full Markdown rendering in AI responses (headings, bold, lists, tables)
- Shareable conversations — "Copy link" button, colleagues with Akte access can view
- Fixed "OpenClaw" persona internally but presented as "Helena" — system prompt not user-editable
- Cmd+K shortcut to chat — "Helena fragen" action in Command Palette opens KI-Chat with entered text as first message

### Helena (Proactive AI Agent)
- **Name:** Helena — energische, praezise juristische Persoenlichkeit
- **Backend:** OpenClaw as Docker service — all AI goes through OpenClaw, single AI backend
- **LLM:** Start with Ollama + Mistral 7B (lokal, DSGVO-konform). Cloud-Provider (Claude, ChatGPT) erst spaeter mit Datenanonymisierung
- **Triggers:** On every new document/email — automatic background scanning for deadlines, party recognition, draft suggestions
- **Proactive initiatives:** Helena checks active Akten for missing steps, stale cases, next actions — like a real ReFa. Runs multiple times daily (every 4 hours)
- **Daily briefing:** Personal morning briefing per user — "3 Fristen heute faellig, 2 E-Mails brauchen Antwort, Akte Mueller wartet auf Rueckmeldung vom Gericht"
- **Suggestions:** Notification bell + dedicated "Helena Vorschlaege" feed page. Card-based feed: icon, title, preview excerpt, Akte link. Actions: Uebernehmen/Ablehnen/Bearbeiten
- **Deadline detection:** Creates ENTWURF Frist entries in calendar. User must approve to activate
- **Auto-drafts (all four):**
  - Response drafts to emails
  - Schriftsatz drafts
  - Document classification + filing (DMS folder + tags)
  - Party/contact extraction (suggest Kontakte/Beteiligte)
- **Email drafts:** Both notification feed AND inline "KI-Antwort verfuegbar" banner in email detail view
- **Calendar integration:** Helena suggests Termine (not just Fristen) — e.g., "Soll ich Vorbereitungstermin am 12.03. anlegen?"
- **Learning:** Track accept/dismiss for future tuning (no model fine-tuning, prompt/ranking adjustments)
- **Style learning:** Helena learns Kanzlei writing style from FREIGEGEBENE documents (not drafts). Adapts per attorney — different styles for different Anwaelte
- **Feedback:** Daumen hoch/runter on every suggestion. Aggregated for quality tuning
- **Quality:** Entwurf-Pflicht + Halluzinations-Warnung bei unsicheren Antworten. No separate fact-check step
- **Bot identity:** Own user "Helena" with avatar. All KI actions attributed to this user in audit trail
- **Navigation:** Under existing KI menu point (renamed from KI-Entwuerfe to Helena)
- **@Mention:** Helena ansprechbar via @Helena in Akten-Threads. Responds in thread context
- **Messaging:** Helena posts as Bot-User in Akten-Threads (summaries, hints, suggestions). Recognizable by Helena avatar
- **Rechtshinweise:** Yes, with disclaimer "Dieser Hinweis ersetzt keine anwaltliche Pruefung"
- **Track Changes:** Helena can insert suggestions as Track Changes in OnlyOffice documents. Anwalt accepts/rejects like from a colleague
- **Onboarding:** Automatic wizard after first login — Ollama connection test, model selection, first document scan. Helena introduces herself personally: "Hallo! Ich bin Helena, Ihre digitale Rechtsanwaltsfachangestellte..."

### Helena Security Boundaries (HARD LIMITS)
- NIEMALS direkt versenden (E-Mails, beA, Briefe — nur Entwuerfe)
- NIEMALS Fristen aktivieren (nur ENTWURF)
- NIEMALS Fristen als erledigt markieren oder loeschen
- NIEMALS Loeschen (keine Dokumente, Kontakte, Buchungen)
- NIEMALS Finanzdaten aendern (kein Zugriff auf Rechnungen, Buchungen, Bankdaten)

### Helena Data Access
- Helena has access to ALL Akten der Kanzlei (global knowledge for better analysis)
- But: Output is RBAC-filtered per user — Helena shows users only info from Akten they have access to
- No cross-user data leaks

### Helena Tools
- DMS: read documents, create Entwuerfe, classify, tag
- Kalender: create ENTWURF Fristen/Termine, check schedules, trigger Vorfrist reminders
- E-Mail: read incoming emails, create response Entwuerfe. Never send directly
- Kontakte/Beteiligte: lookup contacts, suggest new Beteiligte, extract data from documents

### beA Integration
- Eigener Bereich in der Sidebar — separate from E-Mail (different workflow)
- Eigene Inbox/Outbox for beA-Nachrichten
- Auto-Zuordnung: beA-Nachrichten automatically matched to Akten via Aktenzeichen, Gerichtsbezug, Beteiligte. Bei Unsicherheit: suggestion with confirmation
- eEB: One-click Bestaetigung — button on incoming Zustellung, sends eEB back automatically with date
- XJustiz: Inline-Viewer — XML parsed and rendered as structured readable view (tables, Beteiligte, Termine)
- Helena scans beA-Nachrichten same as emails: Fristen, Beteiligte, Antwort-Entwuerfe
- Versand: Direkt senden, nur Anwalt (RBAC). Kein Freigabe-Workflow fuer beA
- Safe-IDs: Am Kontakt verwaltet — Feld auf jedem Kontakt (Gericht, Anwalt, Behoerde). Beim beA-Versand automatisch gezogen
- Pruefprotokoll: Auf Anfrage (Button "Pruefprotokoll anzeigen"), nicht automatisch als Badge

### AI Provider & Token Tracking
- Single provider for whole Kanzlei — Admin selects via dropdown in Einstellungen (Ollama, OpenAI, Anthropic). API-Key, Modell, Test
- Default: Ollama + Mistral 7B (laeuft im gleichen Docker Compose Stack)
- Embedding: Ollama multilingual E5 (already set up in Phase 4)
- Token tracking: Aggregated per day/month — Dashboard shows tokens today/week/month, broken down by user and function (Chat, Scan, Entwurf). No per-request log
- Monthly token budget: Admin sets limit. At 80% warning, at 100% proactive scanning pauses (chat stays on). Monthly reset
- Global rate limit only (no per-user limits)
- Admin AI dashboard: total tokens, documents processed, suggestions generated/accepted/dismissed, per-user breakdown, provider costs
- Graceful degradation when Ollama down: "Helena ist gerade nicht verfuegbar" banner, app works normally, scans catch up later

### DSGVO
- Phase 6: everything local (Ollama). No data leaves the server
- Cloud providers only in future phase with anonymization pipeline

### Claude's Discretion
- Helena's avatar design and visual styling
- Exact spacing, typography, and animation in chat UI
- OpenClaw Docker service configuration details
- Exact proactive scan scheduling logic
- Error state handling and retry behavior
- Loading skeleton designs
- beA message list layout details

</decisions>

<specifics>
## Specific Ideas

- Helena soll "energisch" sein — nicht passiv, sondern aktiv mitdenken wie eine echte ReFa
- Helena passt sich dem Schreibstil jedes einzelnen Anwalts an (lernt aus freigegebenen Dokumenten)
- "Ich bin Helena, Ihre digitale Rechtsanwaltsfachangestellte" — persoenliche Vorstellung beim ersten Start
- beA als eigener Bereich weil der Workflow anders ist als E-Mail (eEB, Pruefprotokoll, XJustiz)
- Command Palette als Shortcut zu Helena (nicht inline-chat in Palette, sondern Navigation zur Chat-Seite)
- Ollama und Mistral laufen im gleichen Docker Compose Stack — immer verfuegbar wenn App laeuft

</specifics>

<deferred>
## Deferred Ideas

- **Datenanonymisierung fuer Cloud-LLMs** — Pipeline zum Ersetzen von Namen, Adressen, Aktenzeichen durch Platzhalter bevor Daten an Claude/ChatGPT gehen. Eigene Phase nach Phase 6
- **Per-Feature Provider-Konfiguration** — Verschiedene LLMs fuer verschiedene Tasks (z.B. Ollama fuer Chat, Claude fuer Schriftsaetze). Erst sinnvoll mit Cloud-Providern
- **Detailliertes per-Request Token Logging** — Einzelne KI-Anfragen loggen mit Timestamp, User, Akte, Tokens in/out. Mehr Speicher, erst bei Bedarf
- **Faktencheck gegen Quelldokumente** — Helena prueft eigene Antwort nochmal gegen Quelldokumente. Self-verification. Spaetere Verbesserung
- **Helena customizable system prompt** — Admin-editierbare Persona/Instruktionen. Erst wenn Grundsystem stabil

</deferred>

---

*Phase: 06-ai-features-bea*
*Context gathered: 2026-02-24*
