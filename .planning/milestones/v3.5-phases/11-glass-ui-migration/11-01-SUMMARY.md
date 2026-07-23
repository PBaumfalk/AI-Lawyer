---
phase: 11-glass-ui-migration
plan: 01
subsystem: design-system
tags: [css, oklch, glass-ui, dark-mode, theme, prisma]
dependency_graph:
  requires: []
  provides: [globals-css-oklch, glass-tier-classes, theme-provider, user-settings-model, theme-api]
  affects: [all-pages, all-components]
tech_stack:
  added: [motion@12.34.3]
  patterns: [oklch-design-tokens, css-glass-tiers, react-context-theme, prisma-upsert]
key_files:
  created:
    - src/components/providers/theme-provider.tsx
    - src/app/api/user/theme/route.ts
  modified:
    - src/app/globals.css
    - tailwind.config.ts
    - src/app/layout.tsx
    - prisma/schema.prisma
decisions:
  - "Switched tailwind.config.ts color references from hsl(var(--*)) to raw var(--*) because CSS vars now contain oklch values (hsl() would produce invalid CSS)"
  - "Created new UserSettings Prisma model (separate table) rather than adding theme to User model — cleaner separation of concerns, extensible for future per-user settings"
  - "Prisma db push deferred: database not running locally; schema is valid and client generated — push runs on next Docker Compose startup"
metrics:
  duration: 3 minutes
  completed_date: "2026-02-26T21:08:10Z"
  tasks_completed: 3
  files_modified: 6
---

# Phase 11 Plan 01: Glass UI Foundation Summary

Design token foundation established: oklch CSS variables, 4-tier glass utility system, gradient mesh body background, dark mode, ThemeProvider with DB persistence, Motion/React installed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Upgrade globals.css to full oklch glass design system | 3bef248 | src/app/globals.css |
| 2 | Update tailwind.config.ts fonts + install Motion/React | de354c4 | tailwind.config.ts, package.json |
| 3 | ThemeProvider + Prisma theme field + API route | 169f9ec | theme-provider.tsx, layout.tsx, schema.prisma, route.ts |

## What Was Built

**globals.css** — Complete rewrite from HSL to oklch design system:
- 83 oklch usages across :root and .dark blocks
- 4 glass tiers: `.glass-input` (8px), `.glass-card` (16px), `.glass-panel` (24px), `.glass-panel-elevated` (40px), `.glass-sidebar` (40px, border-right only)
- Backward-compat aliases: `.glass` -> glass-card, `.glass-heavy` -> glass-panel, `.glass-lg` -> glass-panel-elevated
- Gradient mesh body background (fixed attachment) for light and dark
- macOS-style 8px scrollbars
- Glass shimmer skeleton animation (`glass-shimmer` class)
- 200ms global theme transition for all elements
- Google Fonts @import removed (system font stack only)

**tailwind.config.ts** — Updated for oklch compat:
- Color references switched from `hsl(var(--*))` to `var(--*)` (critical for oklch values)
- Font families updated to SF Pro Display / Inter / system-ui stack
- Sidebar color tokens removed (replaced by `glass-sidebar` CSS class)

**motion@12.34.3** — Installed (Motion/React v11 spring physics library)

**ThemeProvider** — React Context-based theme management:
- Reads stored preference from `/api/user/theme` on mount
- Resolves "system" to current OS preference via matchMedia
- Applies `.dark` class to `document.documentElement`
- Listens for system preference changes with cleanup
- Exports `useTheme()` hook: `{ theme, resolvedTheme, setTheme }`
- Wired in `src/app/layout.tsx` wrapping body content

**Prisma UserSettings** — New model `user_settings`:
- `theme String @default("system")`
- One-to-one relation with User (cascade delete)
- Schema validated, Prisma client regenerated

**API Route** — `/api/user/theme`:
- `GET` returns `{ theme }` for authenticated user (falls back to "system" for unauthenticated)
- `PATCH` validates and upserts theme preference for authenticated user

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Tailwind hsl() wrapper incompatible with oklch CSS variables**
- **Found during:** Task 2
- **Issue:** tailwind.config.ts referenced colors as `hsl(var(--border))` etc., but after Task 1 the CSS variables now contain oklch values. `hsl(oklch(...))` is invalid CSS and would break all Tailwind utility classes (bg-background, text-foreground, etc.)
- **Fix:** Switched all color references to `var(--border)`, `var(--background)`, etc. (raw CSS variable references without the hsl() wrapper). Tailwind outputs these as-is and browsers resolve oklch values directly.
- **Files modified:** tailwind.config.ts
- **Commit:** de354c4

**2. [Rule 2 - Missing Functionality] Created UserSettings Prisma model**
- **Found during:** Task 3
- **Issue:** Plan referenced `model UserSettings` but this model did not exist in prisma/schema.prisma. No settings table existed.
- **Fix:** Created `UserSettings` model with `userId` (unique FK to User), `theme` field, cascade delete. Added `settings UserSettings?` relation on User model.
- **Files modified:** prisma/schema.prisma
- **Commit:** 169f9ec

### Deferred Items

- `prisma db push` not executed — PostgreSQL database unreachable (not running locally; runs in Docker Compose). Schema is valid, client generated. Migration will apply on next `docker compose up`.

## Self-Check: PASSED

Files verified:
- `src/app/globals.css` — FOUND (83 oklch usages)
- `tailwind.config.ts` — FOUND (var() references, SF Pro fonts)
- `src/components/providers/theme-provider.tsx` — FOUND
- `src/app/layout.tsx` — FOUND (ThemeProvider imported and used)
- `prisma/schema.prisma` — FOUND (UserSettings model with theme field)
- `src/app/api/user/theme/route.ts` — FOUND

Commits verified:
- 3bef248 — FOUND (globals.css oklch)
- de354c4 — FOUND (tailwind fonts + motion)
- 169f9ec — FOUND (ThemeProvider + Prisma + API)
