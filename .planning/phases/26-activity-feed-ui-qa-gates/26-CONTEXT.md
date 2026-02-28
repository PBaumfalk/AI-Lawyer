# Phase 26: Activity Feed UI + QA-Gates - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

The Akte detail page gets a unified chronological activity feed as the default view, replacing simple tabs while keeping complex CRUD tabs alongside. Helena quality becomes measurable via goldset tests, retrieval metrics, and hallucination checks with admin-only dashboard and CI-compatible release gates.

</domain>

<decisions>
## Implementation Decisions

### Feed vs Tabs migration
- Feed becomes the **default tab** on Akte detail page
- **3 tabs kept** alongside: Dokumente, Kalender, Finanzen (combined Aktenkonto + Rechnungen + Zeiterfassung)
- Feed **absorbs**: Uebersicht, Beteiligte, Historie, Warnungen, Pruefprotokoll, E-Mails — these all appear as feed entries
- Existing `akte-detail-tabs.tsx` gets restructured: Feed tab (default) + Dokumente + Kalender + Finanzen

### Feed filters
- Filter chips **match AktenActivityTyp enum** directly
- Chips: Alle | Dokumente | Fristen | E-Mails | Helena | Notizen | Status
- "Helena" chip combines HELENA_DRAFT + HELENA_ALERT
- "Status" chip combines BETEILIGTE + STATUS_CHANGE

### Feed entry interaction
- Primary click **expands entry inline** showing more detail (preview, actions)
- Small link icon **navigates to the kept tab** for deeper interaction (e.g., Dokument entry links to Dokumente tab)
- Both patterns available: expand for quick view, link for full CRUD

### Composer
- **Sticky bottom** of feed, always visible — like a chat input
- Supports **notes + @Helena mentions only** — no document upload or Frist creation in composer
- Document/Frist creation uses the existing Dokumente/Kalender tabs
- Simple textarea with @Helena trigger button

### @Helena task flow in feed
- User note appears **immediately** in feed when sent
- Below it, a **"Helena denkt nach..." spinner** shows with step progress (Step X/Y, current tool name)
- When done, Helena's draft appears as the **next feed entry** with inline Accept/Edit/Reject
- Uses existing HelenaTask step tracking via Socket.IO

### Draft review
- Accept/Reject buttons **directly on the feed entry** — no modal
- Edit opens a **small inline editor** within the feed entry
- Matches UI-06: "Draft-Review inline im Feed ohne Seitenwechsel"

### Helena vs Human attribution
- **Subtle distinction**: same card layout for all entries
- Helena entries get a robot icon + "Helena" label instead of user name
- Helena drafts: **brand blue left border** (oklch(45% 0.2 260))
- Helena alerts: **severity-colored left border** (rose for critical, amber for medium, emerald for low) — reuse existing severityBadgeClass pattern from akte-alerts-section.tsx
- Human entries: no colored border (neutral)

### Source display (QA-05)
- **Collapsible sources section** below Helena draft content
- Collapsed: "Quellen: 3 Normen, 2 Urteile, 1 Muster" summary line
- Expanded: actual references with links (§ 622 BGB, BAG 2 AZR 123/20, etc.)
- Compact by default, detailed on demand

### Alert-Center dashboard widget (UI-04)
- Badge count on **sidebar nav item** next to Alerts link
- Sidebar already imports Socket.IO — wire up `helena:alert-badge` event for live count
- No separate header bell icon needed

### QA dashboard
- **Admin-only** /qa-dashboard page (ADMIN role gate)
- Shows goldset results, Recall@k, MRR, hallucination rate
- Regular users don't see QA metrics — only the source display on drafts (QA-05)

### Release gates (QA-06)
- **CLI command / API endpoint** that runs goldset and checks thresholds
- Can be run manually or in CI pipeline
- Thresholds: Recall@5 Normen >= 0.85, Halluzinationsrate <= 0.05, Formale Vollstaendigkeit >= 0.90
- Returns clear pass/fail report with per-metric breakdown
- No automatic runtime blocking of app

### PII protection (QA-07)
- Anonymized query hashes only in **retrieval metrics logs** (separate table)
- Normal application logs ([HELENA] tags) keep full context for debugging
- Retrieval log schema: schriftsatzId, queryHash (SHA-256), retrievalBelege[], promptVersion, modell, recallAt5

### Claude's Discretion
- Exact loading skeleton design for feed
- Feed pagination strategy (infinite scroll vs load-more)
- Goldset query selection (which 20+ Arbeitsrecht scenarios)
- Hallucination check algorithm implementation
- Feed entry expand/collapse animation
- Composer keyboard shortcuts

</decisions>

<specifics>
## Specific Ideas

- Feed should feel like a timeline/activity log — existing AkteHistorie component has a good vertical timeline pattern with icons per action type to extend
- @Helena interaction in feed should feel conversational: user note -> spinner with progress -> Helena draft response
- Draft review should be zero-navigation: Accept/Reject/Edit all inline without leaving the feed
- Source display inspired by "show your work" pattern: collapsed summary, expandable detail

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AkteHistorie` component: vertical timeline with icons per action type, filter chips, cursor pagination — primary pattern to extend for the feed
- `akte-alerts-section.tsx`: severity-based styling (rose/amber/emerald), Socket.IO live updates, dismiss actions — reuse for alert entries in feed
- `draft-card.tsx`: type icons, status badges, Accept/Edit/Reject buttons — reuse for inline draft review
- `draft-detail-modal.tsx`: full draft rendering with markdown — reference for inline edit view
- `at-mention-parser.ts`: existing @helena mention detection — use for composer
- `alert-center.tsx`: full alert list with pagination — reference for alert feed entries
- `draft-pinned-section.tsx`: pinned draft display — may integrate into feed

### Established Patterns
- Socket.IO events: `helena:alert-badge`, `helena:alert-critical` already wired — extend for feed real-time updates
- `glass-card` CSS class: consistent card styling across all components
- `cn()` utility for conditional classes
- Prisma direct queries with `select`/`include` — no repository pattern
- German UI labels, English code
- Filter chips pattern in AkteHistorie (round buttons with active state)

### Integration Points
- `akte-detail-tabs.tsx`: 12-tab structure to restructure into 4 tabs (Feed + Dokumente + Kalender + Finanzen)
- `AktenActivity` model with 8 event types — data source for feed entries
- `/api/akten/[id]/historie` endpoint — extend or parallel endpoint for feed data
- Sidebar nav (`sidebar.tsx`): add alert badge count
- `/ki-chat` page: @Helena in feed is separate from existing chat page (feed is per-Akte context)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-activity-feed-ui-qa-gates*
*Context gathered: 2026-02-28*
