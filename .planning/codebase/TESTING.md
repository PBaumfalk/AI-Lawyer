# Testing Patterns

**Analysis Date:** 2026-03-06

## Test Framework

- **Runner:** Vitest 4.x
- **Config:** `vitest.config.ts`
  - `environment: "node"`
  - `globals: true` (no explicit `import { describe }` required, but used in some files)
- **Assertions:** Vitest built-in `expect`

## Commands

```bash
npm test           # vitest run
npm run test:watch # vitest (watch)

# Single test file
npx vitest run tests/pii/ner-filter.acceptance.test.ts --timeout 60000
```

## Test Locations & Naming

**Unit/Integration tests (co-located):**
- `src/lib/**/__tests__/*.test.ts`
- `src/lib/**/*.test.ts` (flat co-location)

**Acceptance tests (top-level):**
- `tests/**` (currently: `tests/pii/ner-filter.acceptance.test.ts`)

**Naming:**
- `kebab-case.test.ts`
- `kebab-case.acceptance.test.ts` for acceptance tests

## Mocking Conventions (Observed)

- Vitest mocking via `vi.mock(...)`.
- **Important:** `vi.mock(...)` declarations appear **before** any imports that transitively load the mocked module.
- Logger (`@/lib/logger`) is mocked to noop in tests.
- External services (Redis, embedding/AI calls, Prisma) are mocked in unit/integration tests.

Example ordering (from `src/lib/helena/__tests__/tools.test.ts`):
```ts
// Mocks -- must be declared before any import that transitively loads them
vi.mock("@/lib/logger", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) }));

// Imports (after mocks)
import { createHelenaTools } from "../tools/index";
```

## Acceptance Tests

- `tests/pii/ner-filter.acceptance.test.ts` requires a live Ollama model.
- File header documents the requirement and uses `vi.setConfig({ testTimeout: 60_000 })`.
- Tags: `@tags: acceptance, requires-ollama` (in comments).

## Coverage / E2E

- **Coverage:** Not configured (no `@vitest/coverage-*` installed).
- **E2E:** Not configured (no Playwright/Cypress).

---

*Testing analysis: 2026-03-06*
