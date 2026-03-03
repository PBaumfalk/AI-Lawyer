---
gsd_state_version: 1.0
milestone: v0.5
milestone_name: Mandantenportal
status: unknown
last_updated: "2026-03-03T13:04:26.000Z"
progress:
  total_phases: 21
  completed_phases: 19
  total_plans: 54
  completed_plans: 52
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollstaendig im Browser verwalten, waehrend eine autonome KI-Agentin aktenuebergreifend lernt und als digitale Rechtsanwaltsfachangestellte mitarbeitet.
**Current focus:** v0.5 Mandantenportal — Phase 47 in progress

## Current Position

Phase: 47 of 48 (Portal Messaging) -- COMPLETE
Plan: 2 of 2 in current phase -- COMPLETE
Status: Phase 47 complete (Portal Messaging), ready for Phase 48
Last activity: 2026-03-03 — Completed 47-02 (Portal Chat UI)

Progress: [######░░░░] 38%

## Performance Metrics

**Velocity:**
- Total plans completed: 130 (v3.4:38 + v3.5:10 + v0.1:19 + v0.2:23 + v0.3:13 + v0.4:21 + v0.5:6)
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
| Phase 46 P01 | 5min | 2 tasks | 5 files |
| Phase 46 P02 | 3min | 2 tasks | 6 files |
| Phase 47 P01 | 6min | 2 tasks | 13 files |
| Phase 47 P02 | 4min | 2 tasks | 7 files |

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
- Server-side data isolation via Kontakt->Beteiligter chain (not client-side filtering)
- 404 (not 403) on unauthorized Mandant access to hide Akte existence
- Composite index [akteId, mandantSichtbar, createdAt] for efficient portal timeline queries
- naechsteSchritte update creates mandantSichtbar=true STATUS_CHANGE activity
- Server component direct Prisma queries for portal pages (no redundant API fetch from server)
- Back link to dashboard only visible for multi-Akte Mandanten
- NaechsteSchritteCard uses accent border for visual prominence (Mandant's #1 question: what happens next)
- NaechsteSchritteEditor role-gated to ADMIN, ANWALT, SACHBEARBEITER (not SEKRETARIAT)
- [Phase 46]: mandantSichtbar defaults to false: Anwalt must explicitly opt in per document
- [Phase 46]: Portal document API uses Prisma select (not include) to avoid exposing dateipfad
- [Phase 46]: createdById uses Akte anwaltId for Mandant uploads (Mandant not internal User)
- [Phase 46]: 50MB portal upload limit vs 100MB internal for portal security
- [Phase 46]: Mandant uploads skip OCR/RAG/preview for simplified pipeline
- [Phase 47]: Compound unique (akteId, typ, mandantUserId) replaces @unique on akteId for Channel
- [Phase 47]: Akte-to-Channel relation changed from one-to-one to one-to-many
- [Phase 47]: Portal messages strip all mentions (no @Helena/@alle from Mandant side)
- [Phase 47]: PORTAL channels use mandantUserId field (User.id) since Mandant is a User with role=MANDANT
- [Phase 47]: 10s polling for portal messages (no Socket.IO in portal -- simpler, sufficient for Mandant MVP)
- [Phase 47]: Reuse existing portal upload endpoint for message file attachments
- [Phase 47]: Server-side presigned URL resolution in GET messages API for attachment downloads

### Pending Todos

Deferred from previous milestones:
- BI-Dashboard -- deferred to post-v0.5
- Export CSV/XLSX -- deferred to post-v0.5

### Blockers/Concerns

None -- fresh milestone.

## Session Continuity

Last session: 2026-03-03
Stopped at: Completed 47-02-PLAN.md (Portal Chat UI)
Resume: Continue with Phase 48 (next phase in milestone)
