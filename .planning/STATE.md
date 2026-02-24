# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollstaendig im Browser verwalten, waehrend eine proaktive KI-Agentin aktenuebergreifend lernt, automatisch Entwuerfe erstellt, Fristen erkennt und als digitale Rechtsanwaltsfachangestellte mitarbeitet.
**Current focus:** Phase 3 - Email Client

## Current Position

Phase: 3 of 7 (Email Client)
Plan: 3 of 4 in current phase
Status: In Progress
Last activity: 2026-02-24 -- Completed 03-03-PLAN.md (Email Compose & Mailbox Admin)

Progress: [████████████░░░░░░░░] 56%

## Performance Metrics

**Velocity:**
- Total plans completed: 14
- Average duration: 7.9 min
- Total execution time: 1.91 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Infrastructure Foundation | 3/3 | 17 min | 5.7 min |
| 2 - Deadline Calculation + Document Templates | 6/6 | 58 min | 9.7 min |
| 2.1 - Wire Frist-Reminder Pipeline | 1/1 | 5 min | 5 min |
| 2.2 - Fix API Routes and UI Paths | 1/1 | 5 min | 5 min |
| 3 - Email Client | 3/4 | 34 min | 11.3 min |

**Recent Trend:**
- Last 5 plans: 02.1-01 (5 min), 02.2-01 (5 min), 03-01 (14 min), 03-02 (10 min), 03-03 (10 min)
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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 03-02-PLAN.md (Inbox UI) -- Phase 3, Plan 2 of 4
Resume file: None
