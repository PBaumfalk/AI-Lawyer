---
phase: 44-portal-authentifizierung
plan: 01
subsystem: auth
tags: [portal, invite, email, prisma, mandant, rbac]

# Dependency graph
requires:
  - phase: 43-portal-schema-shell
    provides: "MANDANT role in UserRole enum, portal fields on User (inviteToken, kontaktId)"
provides:
  - "PortalInvite Prisma model with token, expiry, status tracking"
  - "POST /api/portal/invite endpoint for creating invites"
  - "POST /api/portal/invite/[id]/resend endpoint for resending invites"
  - "Portal invite email template with Kanzlei name and Aktenzeichen"
  - "PortalInviteDialog component for Anwalt UI"
  - "BeteiligteSection component in Akte detail feed tab"
  - "PORTAL_EINLADUNG and PORTAL_EINLADUNG_ERNEUT audit actions"
affects: [44-portal-authentifizierung, 45-portal-api, 46-portal-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["PortalInvite with crypto.randomUUID token and 7-day expiry", "Invite-then-activate portal onboarding flow", "BeteiligteSection with role-gated invite buttons"]

key-files:
  created:
    - src/app/api/portal/invite/route.ts
    - src/app/api/portal/invite/[id]/resend/route.ts
    - src/lib/email/templates/portal-invite.ts
    - src/components/akten/portal-invite-dialog.tsx
    - src/components/akten/beteiligte-section.tsx
  modified:
    - prisma/schema.prisma
    - src/lib/audit.ts
    - src/components/akten/akte-detail-tabs.tsx

key-decisions:
  - "PortalInvite as separate model (not reusing User.inviteToken) for multi-invite tracking per Beteiligter"
  - "crypto.randomUUID for secure tokens instead of cuid"
  - "Revoke existing PENDING invites before creating new one (prevents token accumulation)"
  - "BeteiligteSection added to feed/overview tab (most visible default tab)"
  - "db push skipped (DB offline) -- schema validates, Prisma client generated"

patterns-established:
  - "Portal invite flow: Anwalt triggers from Akte detail -> API creates invite + sends email -> Mandant activates via token"
  - "Role-gated UI: canInvite check for ANWALT/ADMIN in BeteiligteSection"

requirements-completed: [AUTH-01, PORTAL-02]

# Metrics
duration: 6min
completed: 2026-03-03
---

# Phase 44 Plan 01: Portal Invite System Summary

**PortalInvite model with secure token generation, invite/resend API endpoints, professional German email template, and Anwalt-facing invite dialog in Akte detail**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-03T11:50:29Z
- **Completed:** 2026-03-03T11:57:01Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- PortalInvite Prisma model with unique token, 7-day expiry, status tracking (PENDING/ACCEPTED/EXPIRED/REVOKED)
- POST /api/portal/invite creates invite, validates rolle=MANDANT, checks for existing portal account, revokes stale invites, sends email, logs audit
- POST /api/portal/invite/[id]/resend handles both valid resend and expired-then-renew scenarios
- Professional German email template with Kanzlei branding, Aktenzeichen reference, and activation CTA button
- PortalInviteDialog component with email display, disabled state when no email, toast feedback
- BeteiligteSection in Akte detail feed tab showing all beteiligte with rolle badges, contact info, and MANDANT invite buttons (ANWALT/ADMIN only)

## Task Commits

Each task was committed atomically:

1. **Task 1: PortalInvite model + invite API endpoint** - `bb0d57e` (feat)
2. **Task 2: Portal invite button in Akte detail Beteiligte section** - `1bc1e7b` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added PortalInviteStatus enum, PortalInvite model, relations on Beteiligter/Kontakt/User
- `src/app/api/portal/invite/route.ts` - POST endpoint to create invite, validate, send email
- `src/app/api/portal/invite/[id]/resend/route.ts` - POST endpoint to resend or refresh expired invite
- `src/lib/email/templates/portal-invite.ts` - Email template with Kanzlei branding and activation link
- `src/components/akten/portal-invite-dialog.tsx` - Dialog for Anwalt to send portal invitation
- `src/components/akten/beteiligte-section.tsx` - Beteiligte list with role badges and invite buttons
- `src/components/akten/akte-detail-tabs.tsx` - Added kontaktId to AkteData type, imported BeteiligteSection in feed tab
- `src/lib/audit.ts` - Added PORTAL_EINLADUNG and PORTAL_EINLADUNG_ERNEUT audit actions

## Decisions Made
- **Separate PortalInvite model:** Used a dedicated model instead of reusing User.inviteToken fields from Phase 43. This allows tracking multiple invites per Beteiligter (resend history, status transitions) while the User.inviteToken will be used during the activation phase.
- **crypto.randomUUID for tokens:** More cryptographically secure than cuid for invite tokens.
- **Revoke-before-create pattern:** When creating a new invite for a Beteiligter that already has a PENDING invite, the old one is revoked first. Prevents token accumulation.
- **BeteiligteSection in feed tab:** Added to the default "Aktivitaeten" tab since there's no dedicated Beteiligte tab, making it immediately visible when opening an Akte.
- **db push skipped:** Database server not running locally. Schema validates and Prisma client generates successfully.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added PORTAL_EINLADUNG audit actions to AuditAktion type**
- **Found during:** Task 1 (API endpoint implementation)
- **Issue:** Plan specified `logAuditEvent` calls with "PORTAL_EINLADUNG" action, but AuditAktion type didn't include it
- **Fix:** Added PORTAL_EINLADUNG and PORTAL_EINLADUNG_ERNEUT to AuditAktion union type and AKTION_LABELS
- **Files modified:** src/lib/audit.ts
- **Verification:** TypeScript compiles without errors on audit calls
- **Committed in:** bb0d57e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for audit logging correctness. No scope creep.

## Issues Encountered
- `npx prisma db push` failed (P1001: database not reachable at localhost:5432). Expected when Docker database service is not running. Schema validation and Prisma client generation both succeeded. Push can be run when database is up.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PortalInvite model and invite API ready for Plan 44-02 (activation + login)
- Email template ready for real SMTP delivery when configured
- BeteiligteSection UI ready for user testing
- `npx prisma db push` needed when database service is started

## Self-Check: PASSED

All artifacts verified:
- 44-01-SUMMARY.md exists
- Commit bb0d57e (Task 1) exists
- Commit 1bc1e7b (Task 2) exists
- invite route exists
- resend route exists
- email template exists
- portal invite dialog exists
- beteiligte section exists
- PortalInvite model in schema
- Audit actions in audit.ts

---
*Phase: 44-portal-authentifizierung*
*Completed: 2026-03-03*
