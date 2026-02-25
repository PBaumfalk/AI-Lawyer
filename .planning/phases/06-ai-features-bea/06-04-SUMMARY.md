---
phase: 06-ai-features-bea
plan: 04
subsystem: bea
tags: [bea, xjustiz, xml-parser, fast-xml-parser, safe-id, auto-assignment, react-context, browser-auth]

# Dependency graph
requires:
  - phase: 06-03
    provides: Helena proactive scanning infrastructure for beA message events
provides:
  - bea.expert API client wrapper with dynamic library loading
  - BeaSessionProvider React context for browser-side beA authentication
  - XJustiz XML parser (v3.4.1 - v3.5.1) extracting Grunddaten, Beteiligte, Instanzen, Termine
  - Auto-assignment logic matching beA messages to Akten via Aktenzeichen, SAFE-ID, court reference
  - Extended BeaNachricht schema with eEB, XJustiz, and SAFE-ID fields
affects: [06-05, bea-ui, bea-compose, bea-eeb]

# Tech tracking
tech-stack:
  added: [fast-xml-parser (direct dependency)]
  patterns: [browser-only module with dynamic library loading, priority-chain matching with confidence scoring, namespace-stripping XML parsing]

key-files:
  created:
    - src/lib/bea/client.ts
    - src/lib/bea/session.tsx
    - src/lib/xjustiz/parser.ts
    - src/lib/bea/auto-assign.ts
    - src/lib/xjustiz/__tests__/parser.test.ts
    - src/lib/bea/__tests__/auto-assign.test.ts
  modified:
    - prisma/schema.prisma
    - package.json
    - package-lock.json

key-decisions:
  - "bea.expert library loaded via dynamic import pattern (CDN/vendor/npm) since npm package not publicly available"
  - "BeaSession keys stored only in memory (never localStorage) for security -- page refresh requires re-auth"
  - "30-minute inactivity timeout for beA session with user activity tracking (click/keydown/scroll)"
  - "XJustiz parser uses removeNSPrefix for version-agnostic parsing across 3.4.1-3.5.1"
  - "Auto-assignment confidence levels: SICHER (single Aktenzeichen match), WAHRSCHEINLICH (SAFE-ID or court ref), UNSICHER (no match)"
  - "Internal AZ regex requires 4-5 digits before slash to avoid false positives with court AZ format"
  - "session.tsx uses .tsx extension (not .ts) for React JSX Provider component"

patterns-established:
  - "Dynamic library loader pattern: async loadBeaExpertLib() with cached state and concurrent-safe loading"
  - "Priority-chain matching: sequential strategy execution, first match wins, confidence-weighted"
  - "XJustiz field extraction: dig() helper for safe nested object navigation, ensureArray() for XML array normalization"
  - "vi.resetAllMocks() in beforeEach (not clearAllMocks) to properly reset mockResolvedValue defaults"

requirements-completed: [REQ-BA-001, REQ-BA-005, REQ-BA-006]

# Metrics
duration: 8min
completed: 2026-02-25
---

# Phase 6 Plan 4: beA Foundation Layer Summary

**bea.expert API client with browser-side session management, XJustiz v3.4.1-3.5.1 parser, and auto-assignment logic matching beA messages to Akten via Aktenzeichen/SAFE-ID/court reference**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-25T05:47:37Z
- **Completed:** 2026-02-25T05:55:49Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Built bea.expert API client wrapper with all 8 functions (login, postboxes, folders, messages, send, eEB, Pruefprotokoll) and dynamic library loading
- Created XJustiz XML parser handling versions 3.4.1 through 3.5.1 with namespace stripping and graceful error handling
- Implemented beA auto-assignment matching messages to Akten with 3 strategies and confidence scoring
- Extended BeaNachricht Prisma model with eEB, XJustiz, and SAFE-ID fields
- 34 unit tests (25 parser + 9 auto-assign) all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Install bea.expert Library + Schema Changes + bea.expert Client + Session Context** - `7d9967a` (feat)
2. **Task 2: XJustiz Parser + Auto-Assignment Logic + Unit Tests** - `ec1aca4` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Extended BeaNachricht with eebStatus, eebDatum, xjustizData, safeIdAbsender, safeIdEmpfaenger fields
- `src/lib/bea/client.ts` - bea.expert API client wrapper with dynamic library loading (browser-only)
- `src/lib/bea/session.tsx` - BeaSessionProvider React context with 30-min inactivity timeout
- `src/lib/xjustiz/parser.ts` - XJustiz XML parser extracting Grunddaten, Beteiligte, Instanzen, Termine
- `src/lib/bea/auto-assign.ts` - Auto-assignment of beA messages to Akten with 3 matching strategies
- `src/lib/xjustiz/__tests__/parser.test.ts` - 25 unit tests for XJustiz parser
- `src/lib/bea/__tests__/auto-assign.test.ts` - 9 unit tests for auto-assignment logic
- `package.json` - Added fast-xml-parser as direct dependency
- `package-lock.json` - Updated lockfile

## Decisions Made
- **bea.expert library dynamic loading:** The npm package is not publicly available. Created a dynamic loader pattern supporting CDN (window global), npm import, or vendor file. Clear error messaging when library not available.
- **Session security:** BeaSession keys stored exclusively in memory. No localStorage, no cookies, no server transmission. Page refresh requires re-authentication with software token.
- **XJustiz namespace handling:** Used fast-xml-parser `removeNSPrefix: true` for version-agnostic parsing that works across XJustiz 3.4.1 through 3.5.1 without version-specific code paths.
- **Auto-assignment confidence levels:** SICHER for exact internal Aktenzeichen match (auto-assign), WAHRSCHEINLICH for SAFE-ID or court reference match (suggest with confirmation), UNSICHER for no match (leave unassigned).
- **session.tsx extension:** The BeaSessionProvider contains JSX (Provider component), requiring `.tsx` extension instead of `.ts` as specified in the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed session.ts to session.tsx**
- **Found during:** Task 1 (Session Context creation)
- **Issue:** Plan specified `session.ts` but the file contains JSX (React Provider component), causing TypeScript compilation errors
- **Fix:** Named file `session.tsx` instead of `session.ts`
- **Files modified:** src/lib/bea/session.tsx
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 7d9967a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Trivial file extension correction. No scope impact.

## Issues Encountered
- bea.expert JS library not available on npm or GitLab public repositories. Implemented dynamic loader pattern that will work once the library is obtained through the bea.expert registration process. All client functions are ready and will connect to the library via the dynamic import when configured.
- Database not running locally during execution, so `prisma db push` was skipped. Schema changes are saved and will be applied on next database connection via `prisma db push` or migration.

## User Setup Required

**External services require manual configuration:**
- **bea.expert account:** Register at https://bea.expert (requires active beA SAFE-ID). EUR 10/month per lawyer.
- **Software token:** Each lawyer needs their own beA software token from the BRAK portal.
- **BEA_API_URL:** Set environment variable to the bea.expert API endpoint provided after registration.
- **Library installation:** Once registered, obtain the bea.expert JS library and configure the loader in `src/lib/bea/client.ts`.

## Next Phase Readiness
- Foundation layer complete: client, session, parser, auto-assignment all ready for UI consumption
- Plan 06-05 can build beA pages using these primitives
- BeaSessionProvider wraps beA pages, useBeaSession hook provides login/logout/state
- parseXJustiz can be called on XJustiz attachments for inline viewer
- autoAssignToAkte can be called after message storage for automatic Akte linking

## Self-Check: PASSED

All 7 created files verified present. Both task commits (7d9967a, ec1aca4) verified in git log.

---
*Phase: 06-ai-features-bea*
*Completed: 2026-02-25*
