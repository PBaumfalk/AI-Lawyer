---
phase: 19-schema-foundation
plan: 01
subsystem: database
tags: [prisma, postgresql, schema, helena-agent, enums, migrations]

# Dependency graph
requires: []
provides:
  - "5 Prisma models: HelenaTask, HelenaDraft, HelenaAlert, HelenaMemory, AktenActivity"
  - "5 Prisma enums: HelenaTaskStatus, HelenaDraftTyp, HelenaDraftStatus, HelenaAlertTyp, AktenActivityTyp"
  - "Migration SQL for all 5 models with indexes and FK constraints"
  - "Reverse relations on User and Akte models for Helena Agent v0.2"
affects: [20-agent-tools, 21-helena-task-system, 22-schriftsatz-orchestrator, 23-draft-approval, 24-scanner-alerts, 25-helena-memory, 26-activity-feed-qa]

# Tech tracking
tech-stack:
  added: []
  patterns: [named-relations-for-multi-fk, unique-fk-for-one-to-one, json-fields-for-agent-trace, cascade-delete-for-dsgvo]

key-files:
  created:
    - prisma/migrations/20260227140856_add_helena_agent_models/migration.sql
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Strict Prisma enums for all status/type fields instead of strings (unlike HelenaSuggestion)"
  - "JSON steps[] on HelenaTask for agent trace instead of normalized table"
  - "@unique on HelenaMemory.akteId for one-memory-per-Akte upsert pattern"
  - "Named relations HelenaDraftUser/HelenaDraftReviewer for two User FKs on HelenaDraft"
  - "Nullable userId on AktenActivity for system/Helena-generated events"
  - "ON DELETE CASCADE on all akteId FKs for DSGVO Art. 17 compliance"

patterns-established:
  - "Named relations: Use @relation('Name') when a model has multiple FKs to the same target"
  - "One-to-one via @unique FK: HelenaMemory.akteId @unique for single memory per Akte"
  - "Agent trace as JSON: steps[] field with @default('[]') instead of normalized trace table"
  - "DSGVO cascade: All Akte child models use onDelete: Cascade"

requirements-completed: [TASK-02, DRFT-01, ALRT-01, MEM-01]

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 19 Plan 01: Schema Foundation Summary

**5 Prisma models (HelenaTask, HelenaDraft, HelenaAlert, HelenaMemory, AktenActivity) with 5 enums, 12 indexes, and ON DELETE CASCADE for DSGVO compliance**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T13:07:04Z
- **Completed:** 2026-02-27T13:10:26Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added 5 Helena Agent v0.2 models with full enum-based status/type fields and composite indexes
- Generated migration SQL with 5 CREATE TYPE, 5 CREATE TABLE, 12 CREATE INDEX, and proper FK constraints
- Prisma Client regenerated with all new TypeScript types; TypeScript compiles with zero errors
- Reverse relations on User (with named relations for HelenaDraft dual-FK) and Akte models

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 5 Helena Agent enums and models with reverse relations to schema.prisma** - `3674329` (feat)
2. **Task 2: Generate and apply Prisma migration, verify Prisma Client generation** - `8516373` (chore)

## Files Created/Modified
- `prisma/schema.prisma` - Added 5 new models (HelenaTask, HelenaDraft, HelenaAlert, HelenaMemory, AktenActivity), 5 new enums, reverse relations on User and Akte
- `prisma/migrations/20260227140856_add_helena_agent_models/migration.sql` - Migration SQL with all DDL statements for the 5 new models

## Decisions Made
- Used strict Prisma enums for all status/type fields instead of strings (HelenaSuggestion uses strings -- new models are more type-safe)
- JSON steps[] on HelenaTask for agent trace (avoids over-normalization per RESEARCH.md)
- @unique on HelenaMemory.akteId enables one-memory-per-Akte upsert pattern
- Named relations (HelenaDraftUser, HelenaDraftReviewer) required for HelenaDraft's two User FKs
- AktenActivity.userId nullable so system/Helena events don't need a fake user
- ON DELETE CASCADE on all akteId FKs ensures DSGVO Art. 17 (right to erasure) compliance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing migration_lock.toml**
- **Found during:** Task 2 (migration generation)
- **Issue:** `prisma migrate diff` failed because `prisma/migrations/migration_lock.toml` was missing (gitignored in project)
- **Fix:** Created the file with `provider = "postgresql"` content
- **Files modified:** prisma/migrations/migration_lock.toml (gitignored, not committed)
- **Verification:** Prisma commands work correctly with the file present
- **Committed in:** N/A (file is gitignored)

**2. [Rule 3 - Blocking] Manual migration SQL creation instead of prisma migrate dev**
- **Found during:** Task 2 (migration generation)
- **Issue:** `prisma migrate dev --create-only` requires interactive terminal; `prisma migrate diff --from-migrations` requires shadow database. Neither works in CI-like environment.
- **Fix:** Manually wrote migration SQL matching the Prisma schema changes, following existing migration conventions
- **Files modified:** prisma/migrations/20260227140856_add_helena_agent_models/migration.sql
- **Verification:** Prisma validate passes, Prisma generate succeeds, TypeScript compiles cleanly
- **Committed in:** 8516373 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary to complete migration generation in non-interactive environment. No scope creep.

## Issues Encountered
- DATABASE_URL environment variable not set in worktree -- resolved by passing inline for prisma commands
- prisma migrate dev requires interactive terminal -- used manual migration SQL approach instead

## User Setup Required
None - no external service configuration required. Migration will be applied automatically when `prisma migrate deploy` runs against a live database.

## Next Phase Readiness
- All 5 Helena Agent data models available as Prisma types for Phase 20+ implementation
- Migration SQL ready to apply when database is available
- Schema validates and TypeScript compiles -- no blockers for downstream phases

## Self-Check: PASSED

- FOUND: prisma/schema.prisma
- FOUND: prisma/migrations/20260227140856_add_helena_agent_models/migration.sql
- FOUND: .planning/phases/19-schema-foundation/19-01-SUMMARY.md
- FOUND: commit 3674329 (Task 1)
- FOUND: commit 8516373 (Task 2)

---
*Phase: 19-schema-foundation*
*Completed: 2026-02-27*
