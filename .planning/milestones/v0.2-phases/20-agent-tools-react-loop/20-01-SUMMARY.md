---
phase: 20-agent-tools-react-loop
plan: 01
subsystem: ai-agent
tags: [helena, tools, ai-sdk, vercel-ai, zod, prisma, rbac, pgvector, rvg, embeddings]

# Dependency graph
requires:
  - "Phase 19 Schema Foundation: HelenaTask, HelenaDraft, HelenaAlert, HelenaMemory, AktenActivity models"
provides:
  - "18 Helena tool modules (12 read + 6 write) as AI SDK tool() definitions"
  - "createHelenaTools() factory with shared ToolContext, cache wrapping, audit logging"
  - "filterToolsByRole() for 4-tier RBAC (ADMIN/ANWALT/SACHBEARBEITER/SEKRETARIAT)"
  - "createToolCache() for in-run deduplication of identical tool calls"
  - "logToolCall() audit logger with PII-safe truncation"
  - "buildSystemPrompt() for Helena persona (German, Du-Form, hard limits)"
affects: [20-02-react-loop, 21-helena-task-system, 22-schriftsatz-orchestrator, 23-draft-approval, 24-scanner-alerts, 25-helena-memory, 26-activity-feed-qa]

# Tech tracking
tech-stack:
  added: []
  patterns: [tool-factory-pattern, static-tool-registry, tool-context-injection, cache-wrapped-execute, audit-logged-tools, rbac-tool-filtering]

key-files:
  created:
    - src/lib/helena/tools/types.ts
    - src/lib/helena/tools/index.ts
    - src/lib/helena/tool-cache.ts
    - src/lib/helena/audit-logger.ts
    - src/lib/helena/role-filter.ts
    - src/lib/helena/system-prompt.ts
    - src/lib/helena/tools/_read/read-akte.ts
    - src/lib/helena/tools/_read/read-akte-detail.ts
    - src/lib/helena/tools/_read/read-dokumente.ts
    - src/lib/helena/tools/_read/read-dokumente-detail.ts
    - src/lib/helena/tools/_read/read-fristen.ts
    - src/lib/helena/tools/_read/read-zeiterfassung.ts
    - src/lib/helena/tools/_read/search-gesetze.ts
    - src/lib/helena/tools/_read/search-urteile.ts
    - src/lib/helena/tools/_read/search-muster.ts
    - src/lib/helena/tools/_read/get-kosten-rules.ts
    - src/lib/helena/tools/_read/search-alle-akten.ts
    - src/lib/helena/tools/_read/search-web.ts
    - src/lib/helena/tools/_write/create-draft-dokument.ts
    - src/lib/helena/tools/_write/create-draft-frist.ts
    - src/lib/helena/tools/_write/create-notiz.ts
    - src/lib/helena/tools/_write/create-alert.ts
    - src/lib/helena/tools/_write/update-akte-rag.ts
    - src/lib/helena/tools/_write/create-draft-zeiterfassung.ts
  modified: []

key-decisions:
  - "Static import registry over dynamic require() for esbuild compatibility"
  - "include instead of nested select for read-akte-detail to get relation data correctly"
  - "HelenaDraft.akteId is non-nullable FK -- notes (create_notiz) require an Akte context"
  - "create_draft_zeiterfassung uses HelenaDraftTyp.NOTIZ with meta.subtype=zeiterfassung (no ZEITERFASSUNG enum value)"
  - "Prisma InputJsonValue cast for meta fields with Record<string,unknown> Zod schemas"

patterns-established:
  - "Tool module pattern: single export create*Tool(ctx: ToolContext) returning tool() from AI SDK"
  - "ToolContext injection: shared Prisma, RBAC filter, cache, abortSignal via factory"
  - "Cache-wrapped execute: createCacheKey deterministic hashing, check before execute"
  - "Error boundary: all tool execute functions wrapped with try/catch returning ToolResult.error"
  - "Abort check: ctx.abortSignal?.aborted at start of every tool execute"
  - "Content truncation: text fields capped at 2000 chars, descriptions at 500 chars"
  - "Embedding error handling: search tools wrap generateQueryEmbedding in try/catch with German error"

requirements-completed: [AGNT-02, AGNT-03]

# Metrics
duration: 7min
completed: 2026-02-27
---

# Phase 20 Plan 01: Helena Tool Library Summary

**18 AI SDK tool modules (12 read + 6 write) with factory, RBAC filtering, in-run caching, audit logging, and German persona system prompt**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-27T14:57:58Z
- **Completed:** 2026-02-27T15:04:45Z
- **Tasks:** 3
- **Files modified:** 24

## Accomplishments
- Created complete Helena tool library with 18 tool modules following AI SDK tool() pattern
- Built createHelenaTools() factory with static registry, automatic cache wrapping, audit logging, and error boundary
- Implemented 4-tier RBAC tool filtering (ADMIN full, ANWALT full, SACHBEARBEITER limited write, SEKRETARIAT read+notiz)
- Search tools (gesetze/urteile/muster) use existing pgvector search infrastructure with embedding error handling
- Write tools create HelenaDraft records (PENDING status), never final records -- except create_alert which creates HelenaAlert directly
- All 24 files compile with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create types, supporting infrastructure, and tool factory** - `eb531c9` (feat)
2. **Task 2: Create 12 read tool modules** - `4742f71` (feat)
3. **Task 3: Create 6 write tool modules** - `0080076` (feat)

## Files Created/Modified
- `src/lib/helena/tools/types.ts` - ToolContext, ToolResult, SourceAttribution interfaces
- `src/lib/helena/tools/index.ts` - createHelenaTools factory with static registry and wrapping
- `src/lib/helena/tool-cache.ts` - Map-based in-run cache with deterministic key hashing
- `src/lib/helena/audit-logger.ts` - Tool call audit trail with PII-safe truncation
- `src/lib/helena/role-filter.ts` - Role-based tool filtering for 4 UserRole tiers
- `src/lib/helena/system-prompt.ts` - Helena persona system prompt builder (German, Du-Form)
- `src/lib/helena/tools/_read/read-akte.ts` - Akte summary with counts
- `src/lib/helena/tools/_read/read-akte-detail.ts` - Full Akte with beteiligte, normen, falldaten
- `src/lib/helena/tools/_read/read-dokumente.ts` - Document list for Akte
- `src/lib/helena/tools/_read/read-dokumente-detail.ts` - Single document with OCR text
- `src/lib/helena/tools/_read/read-fristen.ts` - KalenderEintrag with active/past filter
- `src/lib/helena/tools/_read/read-zeiterfassung.ts` - Time entries with billing info
- `src/lib/helena/tools/_read/search-gesetze.ts` - Semantic law search via pgvector
- `src/lib/helena/tools/_read/search-urteile.ts` - Semantic case law search
- `src/lib/helena/tools/_read/search-muster.ts` - Semantic template search
- `src/lib/helena/tools/_read/get-kosten-rules.ts` - RVG fee calculation
- `src/lib/helena/tools/_read/search-alle-akten.ts` - Cross-case search
- `src/lib/helena/tools/_read/search-web.ts` - Stub (not yet configured)
- `src/lib/helena/tools/_write/create-draft-dokument.ts` - Draft document creation
- `src/lib/helena/tools/_write/create-draft-frist.ts` - Draft deadline/appointment
- `src/lib/helena/tools/_write/create-notiz.ts` - Draft note creation
- `src/lib/helena/tools/_write/create-alert.ts` - Direct HelenaAlert creation
- `src/lib/helena/tools/_write/update-akte-rag.ts` - Proposed Akte field updates as draft
- `src/lib/helena/tools/_write/create-draft-zeiterfassung.ts` - Draft time entry

## Decisions Made
- **Static imports over dynamic require():** The plan suggested dynamic require() for auto-discovery but noted esbuild bundling issues. Chose explicit static imports with a registry map for reliable bundling and full TypeScript type checking.
- **include for read-akte-detail:** Used Prisma `include` instead of nested `select` for the detail tool, since deeply nested select with relations caused type inference issues with optional fields.
- **Notes require Akte context:** HelenaDraft.akteId is a non-nullable FK in the schema, so create_notiz requires an Akte. General Akte-unbound notes mentioned in the plan are not possible with current schema.
- **InputJsonValue cast:** Zod's `z.record(z.unknown())` produces `Record<string,unknown>` which Prisma's JSON fields don't accept directly. Cast to `Prisma.InputJsonValue` at the boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Kontakt field names in read-akte-detail**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** Used `kontakt.name` but Kontakt model uses `nachname` for surname. Also used `norm`/`rechtsgebiet` on AkteNorm but actual fields are `gesetzKuerzel`/`paragraphNr`.
- **Fix:** Changed to correct Prisma field names: `nachname`, `gesetzKuerzel`, `paragraphNr`, `anmerkung`
- **Files modified:** src/lib/helena/tools/_read/read-akte-detail.ts
- **Verification:** TypeScript compiles with zero errors
- **Committed in:** 4742f71 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed select/include for nested relations**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** Using `select` with deeply nested relations (anwalt, sachbearbeiter, beteiligte, normen, _count) caused TypeScript inference issues -- Prisma `select` doesn't include relations by default.
- **Fix:** Switched to `include` for relations while keeping scalar fields accessible via full model type
- **Files modified:** src/lib/helena/tools/_read/read-akte-detail.ts
- **Verification:** TypeScript compiles with zero errors
- **Committed in:** 4742f71 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed Prisma JSON meta type mismatch**
- **Found during:** Task 3 (TypeScript compilation)
- **Issue:** `Record<string, unknown>` from Zod schema not assignable to Prisma's `NullableJsonNullValueInput | InputJsonValue`
- **Fix:** Added `Prisma.InputJsonValue` cast at the boundary in create-draft-dokument.ts
- **Files modified:** src/lib/helena/tools/_write/create-draft-dokument.ts
- **Verification:** TypeScript compiles with zero errors
- **Committed in:** 0080076 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes were necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 18 tool modules ready for ReAct orchestrator integration (Plan 02)
- createHelenaTools() factory callable from any server context with Prisma, userId, and userRole
- filterToolsByRole() tested against all 4 role tiers
- Tool cache and audit logger infrastructure ready for orchestrator wrapping
- buildSystemPrompt() provides complete German persona with hard limits

## Self-Check: PASSED

- FOUND: all 24 source files in src/lib/helena/
- FOUND: .planning/phases/20-agent-tools-react-loop/20-01-SUMMARY.md
- FOUND: commit eb531c9 (Task 1)
- FOUND: commit 4742f71 (Task 2)
- FOUND: commit 0080076 (Task 3)

---
*Phase: 20-agent-tools-react-loop*
*Completed: 2026-02-27*
