# Testing Patterns

**Analysis Date:** 2026-03-04

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `vitest.config.ts` (root)

**Assertion Library:**
- Vitest built-in (`expect`) — no separate assertion library

**Run Commands:**
```bash
npm test              # Run all tests once (vitest run)
npm run test:watch    # Watch mode (vitest)
npx vitest run tests/pii/ner-filter.acceptance.test.ts --timeout 60000  # Single acceptance test
```

**Coverage:** No coverage configuration in `vitest.config.ts` — coverage enforcement is not active. Max 20% effort on tests is a documented architectural constraint.

## Test File Organization

**Location:**
- Co-located `__tests__/` subfolder next to the module being tested: `src/lib/helena/__tests__/tools.test.ts`
- OR co-located flat file in the same directory: `src/lib/fristen/rechner.test.ts`
- Acceptance tests in top-level `tests/` directory: `tests/pii/ner-filter.acceptance.test.ts`

**Naming:**
- Unit/integration: `kebab-case.test.ts`
- Acceptance (requires external services): `kebab-case.acceptance.test.ts`

**Structure:**
```
src/lib/
├── helena/
│   ├── __tests__/
│   │   ├── tools.test.ts        # unit tests for tools module
│   │   └── orchestrator.test.ts # integration tests for orchestrator
│   ├── tools/
│   └── ...
├── finance/
│   ├── rvg/
│   │   ├── __tests__/
│   │   │   └── calculator.test.ts
│   │   └── calculator.ts
│   └── invoice/
│       └── __tests__/
│           ├── invoice.test.ts
│           └── e-rechnung.test.ts
└── fristen/
    ├── rechner.test.ts   # flat co-location (no __tests__ subdir)
    └── rechner.ts
tests/
└── pii/
    └── ner-filter.acceptance.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Section header comments used for large test files ─────────────────────

describe("ModuleName or ClassName", () => {
  describe("methodName or scenario", () => {
    it("specific behavior being tested", () => {
      // arrange
      // act
      // assert
    });
  });
});
```

**Patterns:**
- `beforeEach(() => { vi.clearAllMocks(); })` used when mocks need resetting between tests
- `vi.resetAllMocks()` used in some suites to reset both mock state and implementation
- Named test groups with `describe` at both module level and sub-scenario level
- Test names are full sentences describing expected behavior: `"returns error when no akteId and no context"`

**Numbered section headers** in large test files:
```typescript
// =============================================================
// 1. RVG Fee Table (SS 13 RVG) - Base Fee Computation
// =============================================================
describe('RVG Fee Table - computeBaseFee', () => {
```

## Mocking

**Framework:** Vitest (`vi.mock`, `vi.fn`, `vi.mocked`)

**Critical rule:** `vi.mock(...)` declarations MUST appear before any import statement that transitively loads the mocked module. Comment block pattern:

```typescript
// ---------------------------------------------------------------------------
// Mocks -- must be declared before any import that transitively loads them
// ---------------------------------------------------------------------------

vi.mock("@/lib/rbac", () => ({
  buildAkteAccessFilter: vi.fn((_userId: string, _role: string) => ({
    OR: [{ anwaltId: _userId }],
  })),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createHelenaTools } from "../tools/index";
```

**Mocking classes** (e.g. ioredis):
```typescript
vi.mock("ioredis", () => {
  class MockRedis {
    status = "ready";
    connect = vi.fn(async () => undefined);
    incr = vi.fn(async () => 1);
    on = vi.fn();
    constructor() { /* noop */ }
  }
  return { default: MockRedis };
});
```

**Mocking AI SDK `generateText`** (partial mock preserving rest of module):
```typescript
vi.mock("ai", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    generateText: vi.fn(async (opts: any) => { /* custom behavior */ }),
  };
});
```

**Accessing mock instances for assertion:**
```typescript
const { generateQueryEmbedding } = await import("@/lib/embedding/embedder");
expect(generateQueryEmbedding).toHaveBeenCalledWith("Treu und Glauben");

// Or using vi.mocked for typed access:
const mockAkteFindMany = vi.mocked(prisma.akte.findMany);
mockAkteFindMany.mockResolvedValue([] as any);
```

**What to Mock:**
- Database (`@/lib/db` prisma client) — always mock in unit tests
- External services (Redis/ioredis, AI SDK `generateText`, embedding service)
- Logger (`@/lib/logger`) — always mock to noop to suppress output
- Any module with side effects (notifications, audit logging, queue producers)

**What NOT to Mock:**
- Pure computation functions being tested (fee tables, date calculators, format functions)
- The module under test itself
- Standard library functions

## Fixtures and Factories

**Mock Prisma factory pattern** (used in `src/lib/helena/__tests__/tools.test.ts`):
```typescript
function createMockPrisma(): ExtendedPrismaClient {
  return {
    akte: {
      findFirst: vi.fn(async () => ({
        id: "akte-1",
        aktenzeichen: "123/26",
        kurzrubrum: "Mustermann ./. Beispiel GmbH",
        // ...
      })),
      findMany: vi.fn(async () => []),
    },
    helenaDraft: {
      create: vi.fn(async (args: any) => ({
        id: "draft-1",
        ...args.data,
      })),
    },
    // ...
  } as unknown as ExtendedPrismaClient;
}
```

**Context factory pattern:**
```typescript
function createMockToolContext(overrides?: Partial<ToolContext>): ToolContext {
  const prisma = createMockPrisma();
  return {
    prisma,
    userId: "user-test-1",
    userRole: "ADMIN",
    akteId: "akte-1",
    ...overrides,  // spread overrides last for easy per-test customization
  };
}
```

**Date helper for locale-safe dates** (used in `src/lib/fristen/rechner.test.ts`):
```typescript
// Helper: create a Date in local time (avoid timezone issues)
function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}
```

**Location:**
- Fixtures defined as `const` at top of test file or as local helper functions
- No shared fixture files — each test file is self-contained

## Coverage

**Requirements:** None enforced in config. Architectural policy: max 20% effort on tests.

**View Coverage:**
```bash
npx vitest run --coverage  # requires @vitest/coverage-v8 or similar (not installed)
```
Coverage reporting is not configured.

## Test Types

**Unit Tests:**
- Scope: Pure functions with no I/O (fee calculators, date arithmetic, text parsers)
- Location: `__tests__/` or flat `.test.ts` co-located with module
- Examples: `src/lib/finance/rvg/__tests__/calculator.test.ts`, `src/lib/fristen/rechner.test.ts`
- Pattern: No mocks needed — import directly and call with plain values

**Integration Tests (mocked DB):**
- Scope: Service modules that orchestrate Prisma queries and external calls
- Location: `__tests__/` co-located with module
- Examples: `src/lib/helena/__tests__/tools.test.ts`, `src/lib/bea/__tests__/auto-assign.test.ts`
- Pattern: Mock Prisma + all external services; test the full service function behavior

**Acceptance Tests:**
- Scope: End-to-end validation requiring live external services (Ollama LLM)
- Location: `tests/` top-level directory
- Examples: `tests/pii/ner-filter.acceptance.test.ts`
- Pattern: Tagged `@tags: acceptance, requires-ollama` in file header comment; use `vi.setConfig({ testTimeout: 60_000 })` for long timeouts
- These tests are NOT run in CI automatically — must be invoked with specific file path

**E2E Tests:** Not configured (no Playwright or Cypress).

## Common Patterns

**Async Testing:**
```typescript
it("returns summary data", async () => {
  const result = await readAkte.execute!({ akteId: "akte-1" }, {
    toolCallId: "tc-1",
    messages: [],
  } as any) as any;

  expect(result.data).toBeDefined();
  expect(result.data.aktenzeichen).toBe("123/26");
});
```

**Error path testing:**
```typescript
it("returns error when embedding fails", async () => {
  const { generateQueryEmbedding } = await import("@/lib/embedding/embedder");
  (generateQueryEmbedding as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
    new Error("Embedding service down"),
  );

  const result = await searchGesetze.execute!(...) as any;
  expect(result.error).toBeDefined();
});
```

**Mock call assertion:**
```typescript
it("creates HelenaDraft with PENDING status", async () => {
  const mockPrisma = createMockPrisma();
  // ... execute ...

  const createMock = (mockPrisma.helenaDraft as any).create;
  expect(createMock).toHaveBeenCalled();
  const createArgs = createMock.mock.calls[0][0];
  expect(createArgs.data.typ).toBe("DOKUMENT");
  expect(createArgs.data.status).toBe("PENDING");
});
```

**Boundary value testing** (common in financial/legal calculation tests):
```typescript
it("caps at 0.75 when halved rate exceeds 0.75", () => {
  const result = calculateAnrechnung(2.5, 1.3, 100);
  expect(result.halvedRate).toBeCloseTo(1.25, 2);
  expect(result.cappedRate).toBe(0.75);
});

it("rounds up to next step boundary within 500-2000 range", () => {
  expect(computeBaseFee(501)).toBe(93.00);
  expect(computeBaseFee(999)).toBe(93.00);
  expect(computeBaseFee(1001)).toBe(134.50);
});
```

**`toBeCloseTo` for floating-point amounts:**
```typescript
expect(result.items[0].amount).toBeCloseTo(baseFee * 1.3, 2);
```

**Looping over required IDs:**
```typescript
it("contains all required positions", () => {
  const required = ['1000', '1003', '2300', '3100'];
  for (const nr of required) {
    expect(getVvPosition(nr)).toBeDefined();
  }
});
```

---

*Testing analysis: 2026-03-04*
