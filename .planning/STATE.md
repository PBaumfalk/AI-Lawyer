# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollstaendig im Browser verwalten, waehrend eine proaktive KI-Agentin aktenuebergreifend lernt, automatisch Entwuerfe erstellt, Fristen erkennt und als digitale Rechtsanwaltsfachangestellte mitarbeitet.
**Current focus:** Phase 2 - Deadline Calculation + Document Templates

## Current Position

Phase: 2 of 7 (Deadline Calculation + Document Templates)
Plan: 6 of 6 in current phase (COMPLETE)
Status: Phase Complete
Last activity: 2026-02-24 -- Completed 02-06-PLAN.md (Vertretung/Urlaub & Settings)

Progress: [██████░░░░░░░░░░░░░░] 33%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 7.0 min
- Total execution time: 0.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Infrastructure Foundation | 3/3 | 17 min | 5.7 min |
| 2 - Deadline Calculation + Document Templates | 4/6 | 34 min | 8.5 min |

**Recent Trend:**
- Last 5 plans: 01-03 (6 min), 02-03 (6 min), 02-01 (9 min), 02-04 (8 min), 02-06 (11 min)
- Trend: Steady

*Updated after each plan completion*
| Phase 01 P01 | 6min | 3 tasks | 17 files |
| Phase 01 P02 | 5min | 2 tasks | 16 files |
| Phase 01 P03 | 6min | 2 tasks | 13 files |
| Phase 02 P03 | 6min | 2 tasks | 9 files |
| Phase 02 P01 | 9min | 4 tasks | 8 files |
| Phase 02 P04 | 8min | 2 tasks | 10 files |
| Phase 02 P06 | 11min | 2 tasks | 13 files |

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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 02-06-PLAN.md (Vertretung/Urlaub & Settings)
Resume file: None
