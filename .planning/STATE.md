# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollstaendig im Browser verwalten, waehrend eine proaktive KI-Agentin aktenuebergreifend lernt, automatisch Entwuerfe erstellt, Fristen erkennt und als digitale Rechtsanwaltsfachangestellte mitarbeitet.
**Current focus:** Phase 5 - Financial Module

## Current Position

Phase: 5 of 7 (Financial Module)
Plan: 2 of 6 in current phase (2 complete)
Status: Executing
Last activity: 2026-02-24 -- Completed 05-02-PLAN.md (Invoice system + RVG API)

Progress: [██████████████████████] 85%

## Performance Metrics

**Velocity:**
- Total plans completed: 22
- Average duration: 7.6 min
- Total execution time: 2.9 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Infrastructure Foundation | 3/3 | 17 min | 5.7 min |
| 2 - Deadline Calculation + Document Templates | 6/6 | 58 min | 9.7 min |
| 2.1 - Wire Frist-Reminder Pipeline | 1/1 | 5 min | 5 min |
| 2.2 - Fix API Routes and UI Paths | 1/1 | 5 min | 5 min |
| 3 - Email Client | 4/4 | 42 min | 10.5 min |
| 3.1 - Wire Email Real-Time + Compose | 1/1 | 2 min | 2 min |
| 4 - Document Pipeline OCR + RAG | 3/3 | 25 min | 8.3 min |
| 4.1 - Wire Akte RT + Email + Pipeline | 1/1 | 4 min | 4 min |
| 5 - Financial Module | 2/6 | 21 min | 10.5 min |

**Recent Trend:**
- Last 5 plans: 04-02 (6 min), 04-03 (8 min), 04.1-01 (4 min), 05-01 (12 min), 05-02 (9 min)
- Trend: Steady

*Updated after each plan completion*
| Phase 01 P01 | 6min | 3 tasks | 17 files |
| Phase 01 P02 | 5min | 2 tasks | 16 files |
| Phase 01 P03 | 6min | 2 tasks | 13 files |
| Phase 02 P03 | 6min | 2 tasks | 9 files |
| Phase 02 P01 | 9min | 4 tasks | 8 files |
| Phase 02 P04 | 8min | 2 tasks | 10 files |
| Phase 02 P06 | 11min | 2 tasks | 13 files |
| Phase 02 P02 | 15min | 2 tasks | 31 files |
| Phase 02 P05 | 9min | 2 tasks | 13 files |
| Phase 02.1 P01 | 5min | 3 tasks | 8 files |
| Phase 02.2 P01 | 5min | 3 tasks | 8 files |
| Phase 03 P01 | 14min | 4 tasks | 31 files |
| Phase 03 P02 | 10min | 2 tasks | 15 files |
| Phase 03 P03 | 10min | 2 tasks | 17 files |
| Phase 03 P04 | 8min | 2 tasks | 13 files |
| Phase 03.1 P01 | 2min | 3 tasks | 4 files |
| Phase 04 P01 | 11min | 3 tasks | 22 files |
| Phase 04 P02 | 6min | 2 tasks | 11 files |
| Phase 04 P03 | 8min | 2 tasks | 13 files |
| Phase 04.1 P01 | 4min | 3 tasks | 8 files |
| Phase 05 P01 | 12min | 1 tasks | 9 files |
| Phase 05 P02 | 9min | 2 tasks | 12 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 7-phase structure derived from research SUMMARY.md dependency analysis
- [Roadmap]: Mandantenportal + Messaging + CalDAV deferred to v2 (REQ-V2-001 through REQ-V2-012)
- [Roadmap]: Rollen/Sicherheit as Phase 7 (applied after all features built)
- [01-01]: Health endpoint returns 200 if core services (postgres, redis) healthy, 503 only if core down
- [01-01]: Worker depends on app service_healthy before processing jobs
- [01-01]: esbuild built-in alias option for @/ path resolution (no plugin needed)
- [01-02]: Cookie-first auth for Socket.IO: extracts NextAuth session-token from cookies, falls back to explicit token
- [01-02]: Room naming convention: user:{userId}, role:{ROLE}, akte:{akteId}
- [01-02]: Notification catch-up via since parameter on GET /api/notifications
- [01-02]: Browser push notifications only when tab backgrounded (document.hidden)
- [01-03]: Custom JSON API instead of Bull Board Hono adapter (serveStatic incompatible with Next.js App Router)
- [01-03]: Boolean settings auto-save on toggle for better UX
- [01-03]: Log viewer gracefully handles missing log files in development
- [02-03]: Stable document key format {dokumentId}_v{version} for OnlyOffice co-editing
- [02-03]: Keep existing ZUR_PRUEFUNG enum value (backward compatible with existing code)
- [02-03]: Version snapshots stored at {dateipfad}_v{version} in MinIO
- [02-03]: Non-destructive restore: always creates new version, pre-restore snapshot auto-created
- [02-01]: Normalize dates to noon before feiertagejs calls to avoid CET/CEST timezone false negatives
- [02-01]: date-fns addMonths handles BGB 188(3) month-end overflow natively
- [02-01]: Ereignisfrist month/year calculation applies period to event date directly per BGB 188(2)
- [02-01]: Section 193 defaults to true when not specified
- [02-04]: Full-template Briefkopf approach: copy header/footer XML parts from Briefkopf DOCX
- [02-04]: PizZip filter() API instead of forEach() for DOCX ZIP iteration
- [02-04]: fillDocxTemplate accepts Record<string, unknown> for loops/arrays
- [02-04]: OrdnerSchema per-Sachgebiet defaults with global fallback
- [02-04]: Auto-filename pattern: {Aktenzeichen}_{Kategorie}_{Mandant}_{Datum}.docx
- [02-06]: Vertretung auto-deactivation in reminder worker prevents stale vacation states
- [02-06]: Settings export excludes file references (dateipfad/logoUrl) -- files transferred separately
- [02-06]: OnboardingWizard saves settings via import API for consistency
- [02-06]: Escalation chain for overdue Fristen: Verantwortlicher -> Vertreter -> Admin
- [02-02]: pdf-lib for Fristenzettel PDF generation (lightweight, no native deps, A4 landscape)
- [02-02]: Sheet-Command-Palette bridge: CommandFristenRechnerWrapper client component connects server-rendered CommandPalette with FristenRechnerSheet
- [02-02]: Sonderfaelle as nullable string field on KalenderEintrag (not a separate enum)
- [02-02]: FristHistorie stored as Json field for Verlaengerung audit trail
- [02-02]: Auto-Wiedervorlage on document upload with DRINGEND priority and next-business-day date
- [02-02]: Mandatory erledigungsgrund for FRIST entries, plus ueberschreitungsgrund for overdue
- [02-02]: Warn-Ampel colors: emerald >7d, amber 3-7d, rose <3d, slate-900 overdue, slate-400 erledigt
- [02-05]: LocalStorage for Zuletzt verwendet template tracking (no server-side persistence needed)
- [02-05]: Settings auto-save via /api/einstellungen/import endpoint (reuses existing infrastructure)
- [02-05]: Benachrichtigungen as admin-only stub with Phase 3 email notice
- [02-05]: Briefkopf OnlyOffice mode as informational placeholder (save in form mode first)
- [02.1-01]: nodemailer v7 (not v8) for next-auth peer dependency compatibility
- [02.1-01]: Deduplication via Notification table JSON path query (no new DB model)
- [02.1-01]: Lazy SMTP transporter creation (no connection at import time)
- [02.1-01]: Dual-channel: in-app first (fast), then email (best-effort, never throws)
- [02.2-01]: PATCH (not PUT) for partial Ordner-Schema updates per REST best practices
- [02.2-01]: 204 No Content for successful DELETE (empty response body)
- [02.2-01]: Manual alert-dialog component creation (no components.json for shadcn CLI)
- [02.2-01]: Optimistic UI with full state revert on error for favorit toggle
- [03-01]: ImapFlow with IDLE on INBOX per mailbox, NOOP heartbeat every 4 min
- [03-01]: AES-256-GCM with scryptSync key derivation for credential encryption
- [03-01]: sanitize-html server-side with email-specific tag allowlist (tables, fonts, styles)
- [03-01]: Thread detection: References header first, then In-Reply-To, then new thread
- [03-01]: normalizeSubject strips German prefixes (AW, WG, Antwort, Weiterleitung)
- [03-01]: 10-second BullMQ delay for outgoing emails as undo window
- [03-01]: SMTP transport factory with lazy creation and per-kontoId caching
- [03-01]: Exponential backoff reconnection: 5s base, 5min max, admin notify after 3 failures
- [03-01]: LanguageTool as optional Docker service with profiles: [full]
- [03-02]: react-resizable-panels v4: Group/Panel/Separator exports, orientation prop, manual localStorage persistence
- [03-02]: DOMPurify client-side with email-safe allowlist and forced target=_blank on links
- [03-02]: contentEditable for inline reply editor (minimal, TipTap planned for compose)
- [03-02]: Custom event dispatch for keyboard shortcut actions bridging shortcuts to detail component
- [03-02]: Verakten/Ticket buttons as stubs -- full implementation in Plan 04
- [03-03]: TipTap v3 TextStyle/Color use named exports (no default export)
- [03-03]: User.position mapped to signature titel, User.telefon to mobil/durchwahl
- [03-03]: Set.add() pattern for downlevelIteration TypeScript compatibility
- [03-03]: Compose popup for NEW emails only -- reply/forward inline in detail (Plan 02)
- [03-03]: Provider auto-discovery: M365, Gmail, IONOS, Strato with manual fallback
- [03-04]: Auto-suggest priority: thread history (hoch) > sender/contact match (mittel) > Aktenzeichen regex (niedrig)
- [03-04]: Veraktung reversal keeps DMS copies (removes link only)
- [03-04]: All attachments selected by default in Veraktung panel
- [03-04]: Default DMS folder "Korrespondenz" for email attachment copies
- [03-04]: Sidebar E-Mail link already in correct position (no change needed)
- [03.1-01]: Socket-to-CustomEvent bridge in inbox-layout (not folder-tree) to keep bridge in one place
- [03.1-01]: Separate useEffects for room join/leave vs event bridge (different dependency arrays)
- [03.1-01]: Email layout converted to client component for ComposeManager context (no server-only code lost)
- [04-01]: Stirling-PDF skip-text OCR mode to avoid re-processing already-searchable PDFs
- [04-01]: pdf-parse via require() for text extraction; regex fallback for basic extraction
- [04-01]: Universal streamToBuffer for AWS SDK SdkStreamMixin, Blob, ReadableStream, Node Readable
- [04-01]: XHR for upload progress tracking (fetch API lacks upload progress events)
- [04-01]: dragCounter ref pattern for reliable drag-zone detection without false leaves
- [04-01]: OCR concurrency:1 (memory-heavy), preview concurrency:2
- [04-01]: Text files (plain, CSV, HTML) bypass OCR and get indexed directly
- [04-02]: react-pdf v10 with pdfjs-dist v5 (latest) plus core-js for Promise.withResolvers polyfill on Node 20
- [04-02]: ?detail=true query param on existing GET /api/dokumente/[id] for full relations (avoids new endpoint)
- [04-02]: Document name in list is a Link to detail page (replaces preview dialog as primary click action)
- [04-02]: Array.from(new Set()) pattern for downlevelIteration TypeScript compatibility
- [04-03]: Task 1 files already committed in 04-02 plan execution (no duplicate work needed)
- [04-03]: Enhanced /api/search as new route (preserving existing /api/dokumente/search for backward compat)
- [04-03]: Meilisearch ocrText added to displayedAttributes and attributesToCrop for snippet generation
- [04-03]: Command palette uses /api/search instead of /api/dokumente/search for richer results
- [04-03]: E5 instruction format: "passage: " prefix for documents, "query: " for search queries

- [04.1-01]: Worker emits OCR events to both akte:{akteId} and user:{userId} rooms for global toast reach
- [04.1-01]: Prisma lookup in worker event handler for createdById (not in OcrJobData type)
- [04.1-01]: Workflow icon for Pipeline sidebar link to differentiate from Activity (Job-Monitor)
- [04.1-01]: Z-index z-[80] for ComposeFab between upload panel (z-50) and minimized compose tabs (z-[85])

- [05-01]: Precomputed lookup table for fee tables: built from step parameters at module load, stored as [boundary, fee] pairs
- [05-01]: VV search relevance sorting: exact nr match > partial nr match > description/category match
- [05-01]: Anrechnung credit capped at Verfahrensgebuehr amount (credit cannot exceed target fee)
- [05-01]: RvgCalculator auto-adds 7002/7008 in getResult() not addPosition() to ensure correct totals
- [05-01]: PKH computePkhFee returns null above cap to signal caller should use full RVG table
- [05-02]: Atomic Nummernkreis via PostgreSQL UPSERT (INSERT ON CONFLICT DO UPDATE RETURNING) for gap-free concurrent-safe invoice numbers
- [05-02]: Invoice status machine side effects in transaction: GESTELLT locks date, STORNIERT creates Stornorechnung with GS-number, MAHNUNG creates Mahnung record
- [05-02]: Dual PATCH mode on invoice detail: action field triggers status transition, otherwise edit mode (ENTWURF only)
- [05-02]: Per-rate USt breakdown from positionen supports mixed-rate invoices per SS 14 UStG
- [05-02]: RVG uebernehmenAlsRechnung response provides pre-filled invoice data for one-click transfer
- [05-02]: Buffer to Uint8Array conversion for NextResponse compatibility with pdf-lib output

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 05-02-PLAN.md (Invoice system + RVG API) -- Phase 5 plan 2/6
Resume file: None
