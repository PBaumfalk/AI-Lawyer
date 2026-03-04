---
status: awaiting_human_verify
trigger: "Perform a comprehensive bug audit of the entire AI-Lawyer application after Phase 51 fixes"
created: 2026-03-04T10:00:00Z
updated: 2026-03-04T11:30:00Z
---

## Current Focus

hypothesis: Application is now clean after fixing two real bugs found in audit
test: TypeScript compiles, build succeeds, all code tests pass, fixes are minimal and targeted
expecting: User confirms the fixes are acceptable
next_action: Await human verification

## Symptoms

expected: Application runs cleanly - all features work, no TypeScript errors, tests pass, no runtime issues
actual: Two real bugs found and fixed during systematic audit
errors: See Evidence section
reproduction: Systematic check of all subsystems
started: Phase 51 fixes applied 2026-03-04

## Eliminated

- hypothesis: TypeScript type errors remain
  evidence: `npx tsc --noEmit` passes clean with zero errors
  timestamp: 2026-03-04T10:05:00Z

- hypothesis: Build is broken
  evidence: `npx next build` succeeds clean, all routes compile, no warnings
  timestamp: 2026-03-04T10:10:00Z

- hypothesis: ESLint errors exist
  evidence: `npx next lint` only shows warnings (unused vars), zero errors
  timestamp: 2026-03-04T10:05:00Z

- hypothesis: Prisma schema is invalid
  evidence: `npx prisma validate` passes clean
  timestamp: 2026-03-04T10:05:00Z

- hypothesis: Tests are failing due to code bugs
  evidence: 417/427 tests pass. 10 failures are all NER filter acceptance tests that require Ollama running (ECONNREFUSED on port 11434). Infrastructure requirement, not code bug.
  timestamp: 2026-03-04T10:08:00Z

- hypothesis: compose-popup.tsx still has TS2448 saveDraft error
  evidence: saveDraft is now defined with useCallback before the useEffect that references it. Clean.
  timestamp: 2026-03-04T10:06:00Z

- hypothesis: Hardcoded secrets in source code
  evidence: Grep for API_KEY/SECRET/PASSWORD/TOKEN assignments in src/ found zero matches
  timestamp: 2026-03-04T10:12:00Z

- hypothesis: SQL injection vulnerabilities
  evidence: All $queryRawUnsafe/$executeRawUnsafe calls use parameterized queries or static DDL. No string interpolation with user input.
  timestamp: 2026-03-04T10:12:00Z

- hypothesis: Missing auth on API routes
  evidence: All 196 route files checked. The middleware excludes /api/ki* but all ki-chat, ki-entwuerfe, and ki/* routes have their own auth() or requirePermission() calls inside handlers. Portal routes properly check MANDANT role + requireMandantAkteAccess.
  timestamp: 2026-03-04T10:15:00Z

- hypothesis: Docker compose has port conflicts or missing env vars
  evidence: All ports unique (3000, 5432, 6379, 9000, 9001, 7700, 8080, 8081, 8010, 11434). Env vars consistent between app/worker. All localhost fallback URLs match docker port mappings.
  timestamp: 2026-03-04T10:18:00Z

- hypothesis: React hooks rules violations
  evidence: ESLint react-hooks plugin passes. Manual multiline grep found no hooks called after early returns in component bodies.
  timestamp: 2026-03-04T10:20:00Z

- hypothesis: Race conditions in gamification shop purchases
  evidence: shop-service.ts uses prisma.$transaction for all mutating operations (purchase, equip, activate). Quest-service uses $transaction + P2002 catch. Boss engine uses $transaction with re-read.
  timestamp: 2026-03-04T10:25:00Z

## Evidence

- timestamp: 2026-03-04T10:05:00Z
  checked: TypeScript compilation
  found: Zero errors from `npx tsc --noEmit`
  implication: All type safety is intact

- timestamp: 2026-03-04T10:08:00Z
  checked: Test suite (vitest)
  found: 417 passed, 10 failed (all NER filter tests needing Ollama)
  implication: All code tests pass; failures are infra-dependent

- timestamp: 2026-03-04T10:10:00Z
  checked: Next.js build
  found: Build succeeds, all routes compile, middleware 77.5kB
  implication: Application is deployable

- timestamp: 2026-03-04T10:30:00Z
  checked: compose-popup.tsx draft save mechanism
  found: BUG-1 (HIGH) - saveDraft() POSTs to /api/email-send when draftIdRef is null. The email-send route creates the email with sendeStatus=WIRD_GESENDET (not ENTWURF, because sendSchema strips that field) and queues it to BullMQ with 10s delay. If user has entered recipients, auto-save ACCIDENTALLY SENDS the email. Also, subsequent PATCH to /api/emails/{id} returns 405 (no PATCH handler exists).
  implication: Auto-save in compose popup could accidentally send emails

- timestamp: 2026-03-04T10:35:00Z
  checked: kontakte import route
  found: BUG-2 (MEDIUM) - JSON.parse(mappingStr) on line 40 of /api/kontakte/import/route.ts is not wrapped in try-catch. Malformed mapping JSON causes unhandled error -> 500 instead of 400.
  implication: Poor error handling for malformed CSV import mapping

- timestamp: 2026-03-04T11:00:00Z
  checked: Fixes applied and verified
  found: Both fixes compile clean (tsc --noEmit: zero errors). All 417 code tests still pass. Lint shows no new issues.
  implication: Fixes are safe and minimal

## Resolution

root_cause: Two bugs found in comprehensive audit of the entire application
fix: |
  BUG-1 (HIGH): Removed broken auto-save/draft mechanism from compose-popup.tsx.
  The saveDraft function incorrectly used the email-send endpoint (which queues emails
  for immediate sending) to "save" drafts. Removed saveDraft, autoSaveTimer, and
  draftIdRef. The `dirty` state remains for discard confirmation. A proper draft API
  endpoint is needed before auto-save can be re-enabled.

  BUG-2 (MEDIUM): Wrapped JSON.parse(mappingStr) in try-catch in
  /api/kontakte/import/route.ts. Now returns 400 with clear German error message
  instead of unhandled 500 for malformed JSON.
verification: |
  - `npx tsc --noEmit`: zero errors
  - `npx vitest run`: 417 passed, 10 failed (same NER/Ollama failures as before)
  - `npx next lint`: no new warnings or errors
  - Build succeeds clean
files_changed:
  - src/components/email/compose-popup.tsx
  - src/app/api/kontakte/import/route.ts
