# Phase 36: Quick Wins - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish the Akte detail view and document management so there are no dead-end states. Clickable KPI cards navigate to relevant tabs. Failed OCR documents offer recovery options. Empty tabs show helpful content with role-appropriate CTAs. Minor label corrections for consistency.

</domain>

<decisions>
## Implementation Decisions

### KPI card click behavior
- Click a KPI card to switch to the corresponding tab within the same page
- Add subtle hover effect (cursor: pointer + slight background brightness shift) consistent with glass-card interactive patterns
- Tab mapping: Dokumente → dokumente, Termine/Fristen → termine, E-Mails → email (if tab exists), Zeiterfassung → finanzen tab + auto-scroll to Zeiterfassung section, Chat → nachrichten
- Beteiligte KPI: switch to Aktivitaeten tab (participants appear in activity feed and header)
- StatMini component needs onClick prop and hover styles added

### OCR recovery banner
- Show recovery banner in document detail view only (right panel, top of metadata area)
- All 3 recovery options shown as buttons simultaneously: Retry OCR, Vision-Analyse, Manuelle Texteingabe
- Vision-Analyse: use existing AI SDK (Ollama/OpenAI) with vision capability to extract text from document image, create chunks from LLM text extraction
- Manual text entry: inline expanding textarea below the banner (not a modal), user pastes/types text → clicks Speichern → text gets chunked and indexed like OCR output
- Banner replaces/extends the existing OcrStatusBadge for FEHLGESCHLAGEN status in document detail
- Document list continues showing OcrStatusBadge with existing retry behavior

### Empty state design
- Create a shared reusable EmptyState component (icon, title, description, optional CTA slots)
- Follow EmailEmptyState pattern: centered container, rounded icon circle, title, description, optional button
- Professional-friendly tone: concise German text explaining the state + helpful suggestion
- Role-based CTAs: show actions matching what each role can actually do (ANWALT sees "Dokument erstellen", SEKRETARIAT sees "Dokument hochladen", etc.)
- Tabs needing empty states: Dokumente, Termine & Fristen, Nachrichten/Chat, Zeiterfassung (in Finanzen tab)

### Label corrections
- Rename "Nachrichten" → "Chat" in both KPI card label AND tab trigger for consistency
- Zeiterfassung: null kategorie displays as "Keine Kategorie" in muted gray text, clickable to open inline category dropdown
- Zeiterfassung: empty beschreibung displays as "Beschreibung hinzufuegen" as clickable inline edit (click → input field → save on blur/enter)

### Claude's Discretion
- Exact empty state icons per tab (appropriate Lucide icon selection)
- Loading skeleton design for recovery operations
- Exact spacing and typography within the recovery banner
- Error handling when Vision-Analyse fails
- Zeiterfassung category dropdown implementation details

</decisions>

<specifics>
## Specific Ideas

- Recovery banner should feel non-alarming — the document is still there, just needs text extraction help
- Empty states should encourage action, not feel like error pages
- KPI hover effect should be subtle enough to not compete with the glass morphism design but clear enough to signal clickability

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StatMini` (inline in `src/app/(dashboard)/akten/[id]/page.tsx`): Current KPI card component — needs onClick + hover, or refactor to use GlassKpiCard
- `GlassKpiCard` (`src/components/ui/glass-kpi-card.tsx`): More feature-rich KPI card with animated counters, color variants — could replace StatMini
- `OcrStatusBadge` (`src/components/dokumente/ocr-status-badge.tsx`): Existing OCR retry with toast feedback — recovery banner extends this for FEHLGESCHLAGEN state
- `EmailEmptyState` (`src/components/email/email-empty-state.tsx`): Pattern for centered empty states with icon, title, description, button
- `AkteDetailTabs` (`src/components/akten/akte-detail-tabs.tsx`): Tab system with `handleTabChange` callback and `activeTab` state — supports programmatic tab switching

### Established Patterns
- Glass card styling: `glass-card rounded-xl` (bg-white/50, backdrop-blur-md, border-white/20)
- Status badges: success/default/muted/danger variants
- Toast notifications: `toast.success()` / `toast.error()` for async operations
- Inline editing: not yet established — this phase introduces the pattern for Zeiterfassung

### Integration Points
- KPI clicks: `setActiveTab` in AkteDetailTabs or lift state to page.tsx
- OCR recovery: existing `/api/dokumente/[id]/ocr` POST endpoint for retry, needs new endpoint for vision-analyse and manual text save
- Empty states: inserted into each tab's conditional rendering (when data array is empty)
- Zeiterfassung inline edit: PATCH to `/api/finanzen/zeiterfassung/[id]`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 36-quick-wins*
*Context gathered: 2026-03-02*
