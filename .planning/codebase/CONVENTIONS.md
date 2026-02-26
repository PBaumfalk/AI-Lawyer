# Coding Conventions

**Analysis Date:** 2025-02-24

## Naming Patterns

**Files:**
- kebab-case for all files: `ticket-search-bar.tsx`, `kontakt-form.tsx`, `process-tasks.ts`
- Domain/feature directory: `tickets/`, `kontakte/`, `lib/ai/`, `components/ui/`
- API routes use dynamic segments: `[id]/route.ts`, `[akteId]/[dId]/route.ts`

**Functions:**
- camelCase for all function names: `processTaggedTasks()`, `acquireLock()`, `buildCaseContext()`
- Verb-first naming for async operations: `uploadFile()`, `getDownloadUrl()`, `deleteFile()`
- Lowercase for exported utility functions: `cn()`, `ensureBucket()`
- Underscore prefix for internal/private logic: `_` used for unused parameters in ESLint rule `argsIgnorePattern: "^_"`

**Variables:**
- camelCase for all variables: `ticketId`, `runnerId`, `defaultSearch`, `primaryTag`
- German domain terms keep original case: `KontaktData`, `CustomFieldDef`, `ProcessResult`
- Array variables: plural form: `results`, `tickets`, `akten`, `docs`, `beteiligte`
- Config constants: UPPER_SNAKE_CASE: `MINIO_ENDPOINT`, `LOCK_STALE_MS`, `BUCKET`, `MINIO_BUCKET`

**Types:**
- PascalCase for interfaces: `TicketSearchBarProps`, `KontaktFormProps`, `TabsContextValue`, `AkteOption`
- PascalCase for exported types: `AiAction`, `PromptTemplateInput`, `ProcessResult`, `CustomFieldDef`
- Generic type suffixes: `Props` for React component props, `Type` for custom types, `Config` for configurations
- Discriminated unions use singular form: `status: "OFFEN" | "IN_BEARBEITUNG" | "ERLEDIGT"` (German uppercase enums)

## Code Style

**Formatting:**
- Prettier assumed but not explicitly configured (default settings likely in use)
- 2-space indentation (ESLint config uses Next.js defaults)
- Trailing semicolons required (TypeScript strict mode)
- Double quotes for strings (consistent in codebase)

**Linting:**
- ESLint extends `next/core-web-vitals`
- Config location: `.eslintrc.json`
- Custom rules:
  ```json
  "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
  "react/no-unescaped-entities": "off"
  ```
- TypeScript strict mode enabled in `tsconfig.json`
- Next.js rules built-in via `eslint-config-next`

## Import Organization

**Order:**
1. React/Next.js imports: `import React from "react"`, `import { useRouter } from "next/navigation"`
2. Third-party packages: `import { Button } from "@/components/ui/button"`, `import { toast } from "sonner"`
3. Local imports from lib: `import { prisma } from "@/lib/db"`, `import { auth } from "@/lib/auth"`
4. Local imports from components/types: `import { type CustomFieldDef } from "./kontakt-form-intern"`
5. Types imported separately: `import type { UserRole } from "@prisma/client"`

**Path Aliases:**
- `@/*` maps to `./src/*` (defined in `tsconfig.json`)
- All imports use absolute paths with `@/`: `@/lib/db`, `@/components/ui/button`, `@/types`
- No relative imports (except within same directory for sub-components)

## Error Handling

**Patterns:**
- Try-catch blocks with `error: any` type (not explicitly typed):
  ```typescript
  } catch (err: any) {
    result.errors.push({ row: i + 2, error: err.message?.slice(0, 100) ?? "Unbekannter Fehler" });
  }
  ```
- API routes return `Response.json()` with status codes:
  ```typescript
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  ```
- Error fields use German UI messages: "Nicht authentifiziert", "Ungültige E-Mail-Adresse", "Unbekannter Fehler"
- Graceful fallbacks with nullish coalescing: `err.message?.slice(0, 100) ?? "Unbekannter Fehler"`
- Optional error catch with `.catch(() => {})` to silence errors when not critical (e.g., audit logs)

## Logging

**Framework:** `console.*` (Node.js built-in)

**Patterns:**
- `console.log()` for informational messages with context tags: `console.log("[ONLYOFFICE] Document ready")`
- `console.error()` for error conditions with descriptive context: `console.error("[ONLYOFFICE] Editor error:", event)`
- Context tag format: `[COMPONENT_NAME]` or `[SERVICE_NAME]` in square brackets
- Used primarily in API routes and editors for debugging
- Minimal logging in production (no explicit log levels, relies on `NODE_ENV` check in Prisma config)

## Comments

**When to Comment:**
- Complex algorithms: Lock acquisition logic in `process-tasks.ts` has multi-line JSDoc
- Security considerations: `// Security: NEVER sends emails/beA...` in task processing
- Non-obvious business logic: "ai: prefixed tags are system-managed" in ticket validation
- Workflow documentation: Step-by-step process descriptions in function JSDoc

**JSDoc/TSDoc:**
- Used for complex functions and public exports
- Single-line comments for inline clarifications:
  ```typescript
  // MinIO ignores this but SDK requires it
  region: "us-east-1",
  // Process max 20 tasks per run to avoid overload
  take: 20,
  ```
- Multi-line JSDoc for exported functions:
  ```typescript
  /**
   * Upload a file to MinIO.
   * @returns The storage key (path) of the uploaded file.
   */
  export async function uploadFile(...): Promise<string>
  ```

## Function Design

**Size:** Generally 30-60 lines for API route handlers; 10-30 lines for utility functions

**Parameters:**
- Named parameters for complex operations: `{ ticketId, runnerId }` for lock operations
- Destructuring for object parameters in React: `{ basePath = "/tickets", defaultSearch, ... }: TicketSearchBarProps`
- Default values provided at function signature: `async function acquireLock(ticketId: string, runnerId: string): Promise<boolean>`

**Return Values:**
- Explicit typed returns: `Promise<ProcessResult[]>`, `Promise<string>`, `Promise<void>`
- API handlers return `Response.json()` with status codes or `NextResponse.json()`
- Utility functions return plain values: `const cn = (...) => twMerge(clsx(...))`
- Void functions for side-effects only: `await ensureBucket(): Promise<void>`

## Module Design

**Exports:**
- Named exports for functions and types: `export function cn()`, `export async function processTaggedTasks()`
- Type exports use `export type`: `export type CustomFieldDef`
- Re-exports of auth handlers: `export { auth as middleware }` in middleware
- Barrel files in UI: `src/components/ui/` exports components directly

**Barrel Files:**
- Not used for api routes (each route is own file)
- Not used for lib modules (each utility is own file)
- UI components export individually from `src/components/ui/`
- Considered but not consistently applied across feature domains

## Database & Prisma

**Schema:**
- Single source of truth: `prisma/schema.prisma`
- German field names match domain: `akteId`, `faelligAm`, `erledigtAm`, `aiLockedAt`
- Relationships include foreign key constraints
- Optional fields use `?`: `schuldenstand?: String`

**Queries:**
- Use `prisma.` client directly (no repository pattern)
- Select only needed fields: `select: { id: true, name: true }`
- Include relations when needed: `include: { akte: { select: { id: true, aktenzeichen: true } } }`
- Filter with `where` conditions, order with `orderBy`, limit with `take`
- Atomic operations for race-critical sections: `updateMany` with WHERE conditions for lock acquisition

## React Patterns

**Components:**
- "use client" directive at top for client components
- Props interface naming: `{ComponentName}Props`
- Functional components with hooks: `useState`, `useCallback`, `useRouter`
- Event handlers prefixed with `handle`: `handleStatusChange()`, `handleClear()`
- Classes for styling: Tailwind CSS utility classes, `cn()` for conditional classes

**State Management:**
- `useState()` for local state: `const [search, setSearch] = useState(defaultSearch ?? "")`
- `useCallback()` for memoized functions: `const updateUrl = useCallback((...) => { ... }, [router, basePath])`
- Derived state from props: `const activeTab = value ?? internalTab`
- Form state as object: `const [form, setForm] = useState<Record<string, any>>({ ... })`

---

*Convention analysis: 2025-02-24*
