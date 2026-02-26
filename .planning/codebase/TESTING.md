# Testing Patterns

**Analysis Date:** 2025-02-24

## Test Framework

**Status:** No test framework configured

**Current State:**
- No Jest, Vitest, Mocha, or other test runner installed
- No test files exist in `src/` directory
- `package.json` contains no test scripts or test dependencies
- ESLint configured but no testing-related linting rules
- TypeScript strict mode enabled (provides some compile-time safety)

**Implications:**
- Testing is **NOT part of the current MVP Phase 1** per project memory ("Max 20% effort on tests")
- All validation occurs at runtime in API routes and components
- Type safety via TypeScript provides primary correctness guarantees
- Code is validated through manual testing and integration testing

## Validation & Safety Mechanisms (Current)

**Input Validation:**
- Zod schemas for structured validation: `src/lib/auth.ts` uses `loginSchema.safeParse(credentials)`
- API route parameter parsing: NextRequest parameter extraction in route handlers
- Form validation via `react-hook-form` with `@hookform/resolvers` in components
- Type guards: `if (!session?.user)` checks before operations

**Pattern Example from `src/app/api/tickets/route.ts`:**
```typescript
// Validate tags — ai: prefixed tags are system-managed
const tags: string[] = (body.tags ?? []).map((t: string) => t.trim()).filter(Boolean);
const hasAiTag = tags.some((t) => t.startsWith("ai:"));
if (hasAiTag) {
  return Response.json(
    { error: "Tags mit dem Präfix 'ai:' können nicht manuell gesetzt werden." },
    { status: 400 }
  );
}
```

**Error Handling Validation:**
- Try-catch blocks in API routes: `src/app/api/akten/[id]/dokumente/neu/route.ts`
- Runtime type assertions with `any` type: `error: any` allows flexible error handling
- Fallback values: `?? "Unbekannter Fehler"` prevents null propagation

## Integration Testing (Manual)

**Current Practice:**
- Docker Compose deployment for full stack testing: `docker-compose.yml`
- API endpoints tested via curl/Postman manually
- Component behavior tested in browser via dev server: `npm run dev`
- Database seeding via `prisma/seed.ts` for test data

**Database Testing:**
- Prisma migrations used for schema testing: `npm run db:migrate`
- `prisma db push` for rapid iteration
- `prisma db seed` for populating test data
- No database snapshot/rollback mechanism (destructive testing)

## Code Quality Practices (In Place)

**Linting:**
- `npm run lint` runs Next.js ESLint
- Config: `.eslintrc.json` extends `next/core-web-vitals`
- TypeScript checking: `strict: true` in `tsconfig.json`
- Type coverage via TS compiler (no explicit type checking tool)

**Build Verification:**
- `npm run build` produces production bundle
- TypeScript compilation required (fails on type errors)
- ESLint must pass before Next.js build

## Testing Tools & Dependencies (Not Installed)

The following are commonly used but NOT in this project:

- **Jest** - Not installed; would require `jest`, `@types/jest`, `ts-jest`
- **Vitest** - Not installed; would require `vitest`
- **React Testing Library** - Not installed; would require `@testing-library/react`, `@testing-library/jest-dom`
- **Supertest** - Not installed; would require `supertest` for API testing
- **Cypress/Playwright** - Not installed; would require cypress or playwright for E2E

## Testability of Current Codebase

**Easily Testable:**
- Utility functions: `cn()`, `generateStorageKey()`, `ensureBucket()` (pure functions)
- Validation schemas: Zod schemas can be tested independently
- Database queries: Could be unit-tested with mock Prisma adapter
- Helper functions: `buildCaseContext()`, `buildPrompt()` are isolated functions

**Difficult to Test (As Written):**
- API routes: Tightly coupled to NextRequest/NextResponse, Prisma client
- Components: Require React Testing Library setup; deeply integrated with hooks
- Locked operations: Race condition testing would require concurrent test execution
- OnlyOffice integration: Requires running OnlyOffice Docker service

**Testability Issues:**
- No dependency injection (Prisma imported directly, not passed)
- No interface abstraction for external services (S3Client, Meilisearch hardcoded)
- Form state management complex with derived state (difficult to test all paths)
- AI task processing depends on external Ollama service

## Future Testing Strategy (Recommendations)

**Phase Approach:**
1. **Unit Tests (if Phase 2+):** Utility functions, validation schemas, Prisma queries with mocked client
2. **Integration Tests:** API routes with in-memory database (sqlite), mocked external services
3. **E2E Tests:** Full workflow using Playwright or Cypress with Docker Compose stack
4. **Type Safety:** Continue strict TypeScript; consider Zod for comprehensive type validation

**Setup Skeleton (For Future Implementation):**

```bash
# Install test dependencies
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/dom jsdom

# Add to package.json
"test": "vitest",
"test:ui": "vitest --ui",
"test:coverage": "vitest --coverage"

# Create test directories
mkdir -p src/__tests__/{unit,integration,e2e}
```

**Example Unit Test Pattern (Future):**

```typescript
// src/lib/__tests__/unit/utils.test.ts
import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn()", () => {
  it("merges Tailwind classes correctly", () => {
    const result = cn("px-2 py-1", "px-4");
    expect(result).toBe("py-1 px-4");
  });
});
```

**Example Integration Test Pattern (Future):**

```typescript
// src/app/api/__tests__/integration/tickets.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { POST } from "@/app/api/tickets/route";

describe("POST /api/tickets", () => {
  it("creates a ticket with valid data", async () => {
    const req = new Request("http://localhost:3000/api/tickets", {
      method: "POST",
      body: JSON.stringify({ titel: "Test ticket" })
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });
});
```

## Validation Without Tests

**Current Safety Mechanisms:**

| Component | Validation | Safety Mechanism |
|-----------|-----------|------------------|
| API Routes | Input | Zod schemas, type checking |
| Database | Schema | Prisma migrations, FK constraints |
| Forms | Client input | react-hook-form + resolvers |
| TypeScript | Type errors | Strict mode, tsconfig checks |
| Lint | Code quality | ESLint, next/core-web-vitals |
| Runtime | Errors | Try-catch, console.error logging |

**Known Gaps (No Test Coverage):**
- Concurrent request handling (no race condition tests)
- OnlyOffice integration edge cases (JWT validation, callback handling)
- AI prompt generation and LLM response handling
- Complex Prisma query logic (nested includes, atomicity)
- Form field validation across all 8 Kontakt form tabs
- Permission checks (role-based access control not tested)

---

*Testing analysis: 2025-02-24*

**Note:** This project prioritizes rapid iteration (MVP Phase 1) over test coverage. Testing infrastructure should be considered for Phase 2 when core features stabilize.
