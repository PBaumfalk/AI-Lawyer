# Phase 11: Glass UI Migration - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete visual redesign to Apple Sequoia-style liquid glass design system. Covers: upgraded design token foundation, Motion/React animations, glass sidebar, full light/dark mode, and consistent glass application across every user-facing page.

**No functional changes** — all business logic, API routes, Prisma schema, and auth remain untouched (exception: add `theme` field to UserSettings for dark mode persistence).

**Design reference:** `/Users/patrickbaumfalk/Projekte/GVZ-Claude` (glass component library to adapt)

</domain>

<decisions>
## Implementation Decisions

### Foundation (tokens, fonts, utilities)

- Font stack: SF Pro Display → SF Pro Text → Inter → ui-sans-serif → system-ui (remove Google Fonts DM Serif Display + DM Sans)
- Glass tiers: 4 blur levels — `glass-input` 8px, `glass-card` 16px, `glass-panel` 24px, `glass-panel-elevated` + `glass-sidebar` 40px
- Brand blue stays: oklch(45% 0.2 260) — all other tokens migrate to oklch
- Rename/replace existing utilities: `.glass` → `glass-card`, `.glass-heavy` → `glass-panel`, `.glass-lg` → `glass-panel-elevated`
- Install: `motion` (Motion/React v11)
- macOS-style scrollbars (8px, rounded thumb)

### Background Canvas

- **Body background:** Full-viewport gradient mesh, spans behind sidebar AND content (sidebar glass blurs it)
  ```css
  /* Light mode */
  body {
    background:
      radial-gradient(80% 50% at 20% 20%, oklch(85% 0.08 250 / 0.25), transparent),
      radial-gradient(60% 60% at 80% 30%, oklch(80% 0.06 270 / 0.20), transparent),
      radial-gradient(70% 40% at 50% 80%, oklch(90% 0.04 230 / 0.15), transparent),
      oklch(97% 0.005 250);
    background-attachment: fixed; /* gradient stays fixed, content scrolls over it */
  }
  /* Dark mode */
  .dark body {
    background:
      radial-gradient(80% 50% at 20% 20%, oklch(30% 0.08 250 / 0.3), transparent),
      radial-gradient(60% 60% at 80% 30%, oklch(25% 0.06 270 / 0.25), transparent),
      oklch(12% 0.02 250); /* deep navy base */
    background-attachment: fixed;
  }
  ```
- Gradient is **static** (no animation/drift)
- Content main area: `background: transparent` — glass panels float directly on gradient
- Header (top bar): sticky glass-panel (backdrop-blur: 24px, oklch(98% 0.01 250 / 0.7), 1px border-bottom)

### Sidebar — Visual Design

- **Style:** glass-sidebar (backdrop-blur: 40px, transparent glass — not dark slate-900)
- **Width:** 240px expanded / 56px collapsed (down from 256px / 64px)
- **Background behind sidebar:** same body gradient mesh (sidebar glass blurs it)
- **Text color light mode:** oklch(20% 0.01 250) — near-black charcoal
- **Text color dark mode:** oklch(92% 0.005 250) — near-white

### Sidebar — Navigation States

- **Active nav item:**
  ```css
  background: oklch(45% 0.2 260 / 0.15);
  border-left: 2px solid oklch(45% 0.2 260);
  color: oklch(45% 0.2 260);
  ```
- **Hover:** subtle white/10 overlay + `scale(1.01)` Motion spring
- **Collapse animation:** spring stiffness: 300, damping: 30

### Sidebar — Structure

- **Logo area:** glass-panel-elevated chip container (oklch(100% 0 0 / 0.15) bg, blur: 8px, rounded-[10px])
- **Admin section:** subtle separator line (oklch(0% 0 0 / 0.08)) + "ADMINISTRATION" label in text-tertiary caps
- **Timer widget:** embedded in glass-card chip (padding: 8px 12px, margin: 8px)
- **Sidebar bottom (top to bottom):**
  1. Dark mode toggle: Sun/Moon icon above profile chip
  2. Profile chip: `glass-card` container with Avatar initials + user name + Logout icon
- **Collapsed state (56px):** icons only, centered, no text — tooltip chip appears on hover

### Dark Mode

- **Default:** system preference auto-detect (`prefers-color-scheme`) — no stored preference = follow system
- **Toggle UI:** Sun/Moon icon button with Motion spring-rotate animation (stiffness: 300)
- **Toggle position:** directly above profile chip at sidebar bottom
- **Persistence:** `theme` field (String, default: "system") added to existing UserSettings Prisma model — API route to save/load user preference
- **Transition on switch:** 200ms CSS ease transition on background-color, color, border-color globally
- **Implementation:** `.dark` class on `<html>` element, toggled by ThemeProvider

### Animation Scope (Motion/React)

**Component-level:**
- Buttons: `whileHover={{ scale: 1.02 }}`, `whileTap={{ scale: 0.98 }}`, spring stiffness: 400
- Sidebar collapse width: spring stiffness: 300, damping: 30
- Dark mode toggle icon: spring rotate animation on switch
- Nav-item hover: `scale(1.01)` Motion spring
- Modals/Dialogs: `initial={{ opacity: 0, scale: 0.96 }}` → `animate={{ opacity: 1, scale: 1 }}`, spring stiffness: 400, damping: 25
- Toasts: slide-in from right (`x: 24 → 0`) + fade, slide-out right on exit

**Page-level:**
- Page enter: fade-in 150ms (opacity 0 → 1), no exit animation
- Tab content switches: fade + Y-slide (`opacity 0, y: 4` → `opacity 1, y: 0`, 150ms), AnimatePresence mode="wait"

**Data display:**
- KPI card numbers: count-up animation (0 → actual value, 0.8s easeOut) on mount
- List items: staggered fade-in (`opacity: 0, y: 8` → `opacity: 1, y: 0`), 50ms stagger, **max 10 items** — rest appear instantly
- Loading states: glass shimmer skeleton screens (not spinners)

**Accessibility:** All Motion animations wrapped with `prefers-reduced-motion` check — disabled if user prefers reduced motion

### Component Migration Priority

**New/upgraded components:**
- `glass-card.tsx` — upgrade with variants (default/elevated) + Motion
- `glass-kpi-card.tsx` — add counter animation + glass shimmer skeleton variant
- `glass-panel.tsx` — add elevation variants
- `button.tsx` — add Motion spring interactions
- `input.tsx`, `textarea.tsx`, `select.tsx` — apply glass-input tier styling
- `sidebar.tsx` — full migration to glass-sidebar
- Dialog/Modal — glass-panel-elevated + spring entry
- Toast (Sonner config) — glass styling + slide-from-right animation
- Skeleton — glass shimmer pattern

**Pages to migrate (in plan order):**
1. Layout shell: sidebar + header
2. Dashboard (KPI cards, Tagesuebersicht, recent Akten)
3. Akten list + detail (all tabs)
4. Kontakte list + detail + forms
5. Dokumente list
6. Email inbox (3-pane)
7. KI chat + Entwuerfe
8. Finanzen (overview, aktenkonto, rechnungen, rechner)
9. Kalender
10. Tickets list + detail
11. beA inbox
12. Settings + Admin pages
13. Create/edit forms (Akte anlegen, Kontakt neu)

### Claude's Discretion

- Exact oklch values for text-secondary and text-tertiary (just ensure AA contrast)
- macOS scrollbar exact styling (8px thumb, border-radius)
- Glass shimmer exact gradient opacity values for skeleton
- Exact padding/spacing within glass-card containers (keep current spacing rhythm)
- Admin pages: apply glass consistently, no special admin-specific design decisions
- Form field focus ring exact styling (just ensure it's visible and brand-blue)

</decisions>

<specifics>
## Specific Ideas

- **GVZ-Claude as design reference:** The entire component library at `/Users/patrickbaumfalk/Projekte/GVZ-Claude/frontend/src/components/glass/` is the reference implementation. Port patterns (not code verbatim) into AI-Lawyer's existing component structure.
- **Gradient through sidebar:** The key visual idea is that the gradient mesh runs behind the glass sidebar — you see the blurred, frosted gradient through the sidebar. This is what gives the Apple Sequoia feel.
- **Dark mode = deep navy:** Not plain black — deep navy `oklch(12% 0.02 250)` with darker blue/purple gradient tints. Matches the premium feel of the light mode.
- **Profile chip at sidebar bottom:** This is a new element (not in current sidebar). Should show user's initials as avatar + display name (from session) + logout icon on right.
- **Stagger cap:** Hard cap at 10 items to prevent performance issues on long lists like the Akten-Liste with 50+ cases.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-glass-ui-migration*
*Context gathered: 2026-02-26*
