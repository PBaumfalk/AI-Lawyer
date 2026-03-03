# Phase 50: Portal Dokumente Navigation - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Add tab-based sub-page navigation to the portal akte detail page so Mandanten can discover and reach the Dokumente page (and Nachrichten page) via normal UI navigation. The Dokumente page already exists and works — this phase makes it reachable.

</domain>

<decisions>
## Implementation Decisions

### Navigation Structure
- Tab bar between page title and two-column content area
- 3 tabs: Uebersicht | Dokumente | Nachrichten
- URL-based routing: each tab is a real Next.js page (pages already exist)
  - `/portal/akten/[id]` -> Uebersicht (current akte detail)
  - `/portal/akten/[id]/dokumente` -> Dokumente (existing page)
  - `/portal/akten/[id]/nachrichten` -> Nachrichten (existing page)
- Shared layout.tsx inside `app/(portal)/portal/akten/[id]/` renders title + tab bar; sub-pages render below via `{children}`
- Existing page.tsx content (Timeline + sidebar cards) stays as Uebersicht tab content

### Tab Labels & Icons
- Icon + text labels for each tab
- Icons: ClipboardList (Uebersicht), FileText (Dokumente), MessageSquare (Nachrichten)
- First tab labeled "Uebersicht"
- No badges or count indicators on tabs

### Tab Visual Style
- Underline tabs: active tab gets primary-colored bottom border
- Inactive tabs: text-muted-foreground, no underline
- Subtle glass-border-color line under the full tab bar, active underline sits on top
- Full-width equal-split on all screen sizes (3 tabs split width equally)

### Claude's Discretion
- Exact spacing between title and tab bar
- Hover state styling for inactive tabs
- Transition animation for active underline
- How to extract shared data (title, back link) into layout vs keeping in page

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `akte-uebersicht.tsx`: Info card component, stays in Uebersicht tab
- `naechste-schritte-card.tsx`: Action card, stays in Uebersicht tab
- `sachstand-timeline.tsx`: Timeline component, stays in Uebersicht tab
- Dokumente page at `app/(portal)/portal/akten/[id]/dokumente/page.tsx`: fully implemented, client component
- Nachrichten page at `app/(portal)/portal/akten/[id]/nachrichten/page.tsx`: fully implemented, client component
- lucide-react icons: ClipboardList, FileText, MessageSquare already used in portal

### Established Patterns
- Portal pages use server components with direct Prisma queries (no API fetch from server)
- Glass styling: `bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08]`
- Active nav state: `bg-primary/10 text-primary font-medium` (from sidebar)
- Back link pattern: conditional on multi-Akte Mandanten, uses ArrowLeft icon

### Integration Points
- New layout.tsx at `app/(portal)/portal/akten/[id]/layout.tsx` wraps existing page.tsx + sub-pages
- Current page.tsx has auth check + Prisma queries for title data — these move to layout
- Tab component uses Next.js `usePathname()` for active state detection
- Existing `requireMandantAkteAccess` for server-side access control in layout

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard tab navigation pattern with existing glass UI conventions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 50-portal-dokumente-navigation*
*Context gathered: 2026-03-03*
