# Coding Conventions

**Analysis Date:** 2026-03-06

## Stack / Language

- **Framework:** Next.js (App Router) + React 18
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS
- **API routes:** `app/api/**/route.ts` (Next.js App Router)

## Language Split

- **Code identifiers:** English (functions, variables, types)
- **UI strings:** German (labels, messages, errors)
- **German identifiers:** Allowed for legal-domain types/fields mirroring Prisma schema (e.g. `akteId`, `kurzrubrum`, `anwaltId`, `faelligAm`).

## Naming & File Structure

**Files:**
- React components: `kebab-case.tsx` (e.g. `akte-detail-header.tsx`)
- Hooks: `use-kebab-case.ts`
- Lib/services/utilities: `kebab-case.ts`
- Tests: `*.test.ts` or `*.test.tsx`
- API routes: `route.ts` only (App Router)

**Identifiers:**
- Functions/variables: `camelCase`
- React components: `PascalCase`
- Types/interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Boolean helpers: prefix `is` / `has`

## Imports & Aliases

- Path alias: `@/*` → `./src/*` (from `tsconfig.json`)
- Internal imports should prefer `@/` over relative paths when crossing directories.
- Type-only imports use `import type`.

## Client/Server Components

- Interactive/stateful components have **"use client"** as the first line.
- Server components (no directive) used for data-heavy server rendering in `app/`.

## Linting & Formatting

- **Lint:** `next lint` (ESLint with `next/core-web-vitals`).
- Custom rules (`.eslintrc.json`):
  - `no-unused-vars`: **warn**, ignore args prefixed with `_`
  - `react/no-unescaped-entities`: **off**
- **Prettier:** No repo-level Prettier config found.
- **TypeScript:** `strict: true`, `noEmit: true`, `moduleResolution: "bundler"`.

## Code Style (Observed)

- Double quotes commonly used in source (`"use client"`, imports, strings).
- Tests also use double quotes.
- Section header comments sometimes used in larger files.

## Logging

- Pino logger (`src/lib/logger.ts`) is used in server-side code.
- Tests mock the logger to suppress output.

---

*Convention analysis: 2026-03-06*
