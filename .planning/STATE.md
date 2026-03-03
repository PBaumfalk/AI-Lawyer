---
gsd_state_version: 1.0
milestone: v0.5
milestone_name: Mandantenportal
status: unknown
last_updated: "2026-03-03T12:12:05.859Z"
progress:
  total_phases: 21
  completed_phases: 16
  total_plans: 54
  completed_plans: 46
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollstaendig im Browser verwalten, waehrend eine autonome KI-Agentin aktenuebergreifend lernt und als digitale Rechtsanwaltsfachangestellte mitarbeitet.
**Current focus:** v0.5 Mandantenportal — Phase 44 complete, ready for Phase 45

## Current Position

Phase: 44 of 48 (Portal Authentifizierung) -- COMPLETE
Plan: 2 of 2 in current phase (all complete)
Status: Phase 44 Complete
Last activity: 2026-03-03 — Completed 44-02 (Portal activation + login + password reset)

Progress: [##░░░░░░░░] 19%

## Performance Metrics

**Velocity:**
- Total plans completed: 126 (v3.4:38 + v3.5:10 + v0.1:19 + v0.2:23 + v0.3:13 + v0.4:21 + v0.5:2)
- Average duration: ~15 min
- Total execution time: ~30 hours

**By Milestone:**

| Milestone | Phases | Plans | Timeline |
|-----------|--------|-------|----------|
| v3.4 | 13 | 38 | 2 days |
| v3.5 | 2 | 10 | 2 days |
| v0.1 | 7 | 19 | 2 days |
| v0.2 | 10 | 23 | 2 days |
| v0.3 | 5 | 13 | 3 days |
| v0.4 | 10 | 21 | 2 days |
| v0.5 | 6 | 13 | in progress |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Mandantenportal als /portal/* Route Group (same Next.js app, shared DB, own layout + auth)
- Einladungslink + Passwort (no OAuth setup needed for Mandanten)
- Per-Dokument Freigabe-Toggle (granular control, Anwalt decides explicitly)
- No auth.ts changes needed for MANDANT -- existing authorize flow handles all UserRole values generically
- kontaktId FK on User (not portalUserId on Kontakt) keeps Kontakt model clean
- Portal layout uses (session.user as any).role for MANDANT check
- Shield icon for portal login to distinguish from internal Scale icon
- Briefkopf kanzleiName fetched server-side in layout, passed as props
- PortalInvite as separate model for multi-invite tracking (not reusing User.inviteToken)
- crypto.randomUUID for secure invite tokens
- Revoke existing PENDING invites before creating new one
- BeteiligteSection in feed/overview tab for immediate visibility
- Transaction-based activation: User creation + invite status update in single $transaction
- Anti-enumeration: password reset always returns 200 regardless of email existence
- 30min inactivity auto-logout with 5min warning dialog (PortalSessionProvider)
- Activity event throttling at 30s intervals for performance

### Pending Todos

Deferred from previous milestones:
- BI-Dashboard -- deferred to post-v0.5
- Export CSV/XLSX -- deferred to post-v0.5

### Blockers/Concerns

None -- fresh milestone.

## Session Continuity

Last session: 2026-03-03
Stopped at: Completed 44-02-PLAN.md (Portal activation + login + password reset)
Resume: Continue with Phase 45 (Portal API)
