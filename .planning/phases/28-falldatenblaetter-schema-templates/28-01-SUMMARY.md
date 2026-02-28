---
phase: 28-falldatenblaetter-schema-templates
plan: "01"
subsystem: database
tags: [prisma, zod, seed, falldaten, templates, postgres]

# Dependency graph
requires: []
provides:
  - FalldatenTemplate Prisma model with enum, indexes, and User/Akte relations
  - FalldatenTemplateStatus enum (ENTWURF, EINGEREICHT, GENEHMIGT, ABGELEHNT, STANDARD)
  - Akte.falldatenTemplateId FK for template binding
  - Zod validation schemas for template CRUD payloads (8 field types)
  - Idempotent seed function for 10 STANDARD templates from existing schemas
  - Worker startup wiring for seed function
affects: [28-02 API routes, 28-03 UI, 29 Falldatenblaetter UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FalldatenTemplate DB model as single source of truth for template schemas"
    - "STANDARD status for immutable system-seeded templates (application-layer uniqueness)"

key-files:
  created:
    - prisma/migrations/20260228181626_add_falldaten_templates/migration.sql
    - src/lib/falldaten/validation.ts
    - src/lib/falldaten/seed-templates.ts
  modified:
    - prisma/schema.prisma
    - src/worker.ts

key-decisions:
  - "No @@unique constraint on [sachgebiet, status] -- STANDARD uniqueness enforced at application layer in seed function"
  - "Migration SQL created manually because DB not available locally; will apply on next docker-compose up"

patterns-established:
  - "FalldatenTemplate seed follows seedAmtlicheFormulare pattern: version guard via SystemSetting + ADMIN user lookup + idempotent loop"

requirements-completed: [FD-06, FD-07]

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 28 Plan 01: Schema + Templates Summary

**FalldatenTemplate Prisma model with 5-status enum, Zod validation for 8 field types, and idempotent seed function for 10 STANDARD templates wired into worker startup**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-28T17:15:07Z
- **Completed:** 2026-02-28T17:18:22Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- FalldatenTemplate Prisma model with full lifecycle status enum, User relations, and Akte FK
- Zod validation module supporting all 8 field types including new multiselect
- Idempotent seed function creating 10 STANDARD templates from existing TypeScript schemas
- Worker startup wiring with non-fatal error handling matching existing patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Add FalldatenTemplate Prisma schema + migration** - `3678485` (feat)
2. **Task 2: Create Zod validation module + seed function + worker wiring** - `14d2ec4` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added FalldatenTemplateStatus enum, FalldatenTemplate model, Akte FK, User relations
- `prisma/migrations/20260228181626_add_falldaten_templates/migration.sql` - SQL migration for new table, enum, FK, and indexes
- `src/lib/falldaten/validation.ts` - Zod schemas for template field, schema, create, update, and reject payloads
- `src/lib/falldaten/seed-templates.ts` - Idempotent seed function for 10 STANDARD templates
- `src/worker.ts` - Import and call seedFalldatenTemplates() at startup

## Decisions Made
- No `@@unique` constraint on `[sachgebiet, status]` because Prisma does not support partial unique indexes -- uniqueness for STANDARD templates enforced at application layer in seed function via findFirst check
- Migration SQL created manually since PostgreSQL not running locally in current session -- migration file ready for next `docker-compose up` or `prisma migrate deploy`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Database server not available locally (`P1001: Can't reach database server at localhost:5432`), so `prisma migrate dev` could not auto-apply. Created migration SQL file manually. Prisma client was generated successfully from schema alone.

## User Setup Required

None - no external service configuration required. Migration will auto-apply on next `prisma migrate deploy` or Docker startup.

## Next Phase Readiness
- Database schema and types ready for Plan 02 (API routes)
- Zod schemas ready for request validation in API handlers
- Seed function ready to populate STANDARD templates on first boot
- Pre-existing TypeScript errors in `src/lib/helena/index.ts` are unrelated to this work

## Self-Check: PASSED

All 6 files verified present. Both task commits (3678485, 14d2ec4) verified in git log.

---
*Phase: 28-falldatenblaetter-schema-templates*
*Completed: 2026-02-28*
