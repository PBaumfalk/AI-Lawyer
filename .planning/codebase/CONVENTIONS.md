# Coding Conventions

**Analysis Date:** 2026-03-04

## Language Split

**Code language:** English identifiers, variable names, function names, comments.
**UI language:** German strings, labels, error messages, button text, toast notifications.
**German identifiers allowed in:** domain types mirroring Prisma schema (e.g. `akteId`, `kurzrubrum`, `anwaltId`, `faelligAm`), legal-domain function names (e.g. `berechneFrist`, `computeRvgFee`).

## Naming Patterns

**Files:**
- React components: `kebab-case.tsx` (e.g. `activity-feed.tsx`, `akte-detail-header.tsx`)
- Hooks: `use-kebab-case.ts` (e.g. `use-email-store.ts`, `use-keyboard-shortcuts.ts`)
- Service/lib files: `kebab-case.ts` (e.g. `fee-table.ts`, `portal-access.ts`, `channel-service.ts`)
- Test files: `kebab-case.test.ts` or inside `__tests__/` subfolder as `kebab-case.test.ts`
- API routes: Next.js App Router `route.ts` files only

**Functions:**
- camelCase for all functions and methods: `computeBaseFee`, `berechneFrist`, `createHelenaTools`, `requireAuth`
- German domain verbs acceptable: `berechneFristRueckwaerts`, `naechsterGeschaeftstag`, `classifyDringlichkeit`
- Factory functions prefixed with `create`: `createHelenaTools`, `createToolCache`, `createStallDetector`, `createLogger`
- Hook functions prefixed with `use`: `useHelenaTaskProgress`, `useKeyboardShortcuts`
- Boolean helpers prefixed with `is`/`has`: `isGeschaeftstag`, `istFeiertag`

**Variables:**
- camelCase for local variables and parameters
- Domain-language variables match Prisma field names: `akteId`, `anwaltId`, `kurzrubrum`, `bundesland`

**Constants:**
- Module-level constants: `UPPER_SNAKE_CASE`
- Examples: `PERMISSIONS`, `EDITABLE_MIMETYPES`, `GERMAN_LEGAL_SEPARATORS`, `RVG_2025`, `ANDERKONTO_SCHWELLE`, `DEFAULT_SETTINGS`
- `as const` used on tuple/array constants for type narrowing

**Types / Interfaces:**
- `interface` for prop types and data shapes: `interface ActivityFeedProps`, `interface PermissionSet`
- `type` for unions and aliases: `type RouteParams`, `type ExtendedPrismaClient`
- PascalCase for all type names
- `import type` used for type-only imports to avoid circular deps: `import type { ExtendedPrismaClient } from "@/lib/db"`

**React Components:**
- PascalCase function component names: `ActivityFeed`, `ActivityFeedEntry`, `RvgCalculator`
- One primary component export per `.tsx` file; secondary helpers are non-exported or named exports

## Code Style

**Formatting:**
- No dedicated Prettier config found; formatting is enforced via Next.js default ESLint and TypeScript strict mode
- Indentation: 2 spaces (TypeScript/TSX files)
- Single quotes preferred in test files; double quotes in source files (mixed, no enforcer)

**Linting:**
- Tool: `eslint-config-next` (extends `next/core-web-vitals`)
- `no-unused-vars` is set to `warn` with `argsIgnorePattern: "^_"` — prefix unused args with `_`
- `react/no-unescaped-entities` is turned off — German text in JSX is fine without escaping `'`

**TypeScript Strictness:**
- `strict: true` in `tsconfig.json` — all strict checks enabled
- `any` typing is used in specific integration points (test mocks, Prisma dynamic queries): acceptable with comment
- `as unknown as T` pattern used for type bridging between Prisma extended types and test mocks

## Import Organization

**Order:**
1. Node built-ins (`path`, `crypto`)
2. Third-party packages (`next`, `react`, `zod`, `ai`, `vitest`)
3. Internal absolute imports via `@/` alias (`@/lib/db`, `@/components/ui/button`)
4. Relative imports (`./activity-feed-entry`, `../fee-table`)
5. Type-only imports — use `import type` when importing only types

**Path Aliases:**
- `@/*` maps to `./src/*` — use `@/` for all internal imports from `src/`
- Relative imports used within the same directory subtree

**Mocks in tests:**
- `vi.mock(...)` calls must be declared BEFORE any `import` that transitively loads the mocked module
- Pattern documented with comment block `// Mocks -- must be declared before any import...`

## Component Client/Server Boundary

- All interactive/stateful components have `"use client"` as first line
- Server components (no directive) are used for data-fetching pages in `app/` directory
- Client components are the default for everything in `src/components/`

## API Route Error Handling

**Auth guard pattern** (applied at start of every route):
```typescript
const result = await requireAuth();
if (result.error) return result.error; // NextResponse 401/403 already constructed
const { session } = result;
```

**Zod validation pattern** (for POST/PUT bodies):
```typescript
const sendMessageSchema = z.object({
  body: z.string().min(1).max(10000).trim(),
});

const parsed = sendMessageSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json(
    { error: "Validierungsfehler", details: parsed.error.flatten() },
    { status: 400 }
  );
}
```

**JSON parse guard**:
```typescript
let body: unknown;
try {
  body = await request.json();
} catch {
  return NextResponse.json({ error: "Ungueltiger Request-Body" }, { status: 400 });
}
```

**Error response shape:** `{ error: "German message" }` with appropriate HTTP status code.
**Success response shape:** `Response.json(data)` or `NextResponse.json(data, { status: 201 })`.

**Empty catch blocks** (`} catch {`) used when the failure is explicitly non-fatal and documented inline. Named catches `(err)` or `(err: any)` used when the error value is inspected.

## Logging

**Framework:** Pino (`src/lib/logger.ts`)
**Usage pattern:**
```typescript
import { createLogger } from "@/lib/logger";
const log = createLogger("my-module");
log.info({ key: "value" }, "Human-readable message");
log.error({ err }, "Error context message");
```
- Always create a module-scoped child logger with `createLogger("module-name")`
- Do NOT use `console.log` in server-side code; use the pino logger
- In tests, logger is mocked to a noop via `vi.mock("@/lib/logger", ...)`

## Comments

**When to comment:**
- Section headers using `// ─── Section Name ─────────────────────────────────────────────` divider lines
- Legal/compliance reasoning: always comment BRAK 2025 / BRAO references explaining why a rule exists
- Complex business logic with regulatory basis: inline comment citing legal paragraph (e.g. `// BGB 187(1): Event day not counted.`)
- Algorithm decisions that are non-obvious

**JSDoc/TSDoc:**
- Used on exported library functions and module-entry functions
- Example: `/** Create a child logger scoped to a module. */`
- Not required on React component props interfaces

## Function Design

**Size:** Functions are generally focused; large files (`worker.ts` at 1186 lines, `ki-chat/route.ts` at 1028 lines) exist for complex orchestration but are the exception.

**Parameters:** Domain object parameters typed with interfaces; optional parameters use `?` suffix or default values.

**Return Values:**
- Service functions return discriminated union `{ data: T } | { error: string }` for caller error handling
- API routes return `NextResponse.json(...)` directly
- Pure lib functions return domain values (numbers, objects, dates) and throw on programmer error

**Async:** Always `async/await`; no raw Promise chains.

## Module Design

**Exports:** Named exports preferred over default exports in lib files. React components use named exports within `"use client"` files.

**Barrel files:** Used selectively — only 4 `index.ts` barrel files exist (`src/lib/helena/tools/index.ts`, `src/lib/helena/schriftsatz/index.ts`, `src/lib/helena/index.ts`, `src/lib/fristen/index.ts`). Most modules export directly from their file; do NOT add barrel files unless a module has multiple public exports that are logically grouped.

**Class usage:** Classes are rare — only `RvgCalculator` in `src/lib/finance/rvg/calculator.ts` uses class pattern (builder pattern). Prefer functions and plain objects.

## Prisma / Database Conventions

- Always import `prisma` from `@/lib/db` (the extended client with business invariants)
- Use `ExtendedPrismaClient` type (not raw `PrismaClient`) when typing prisma parameters
- Use `PrismaTransactionClient` type for transaction callbacks
- `select` clauses always enumerate only needed fields (never `include: { user: true }` without limiting fields)

---

*Convention analysis: 2026-03-04*
