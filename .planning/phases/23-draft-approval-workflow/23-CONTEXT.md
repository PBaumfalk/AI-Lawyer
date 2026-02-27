# Phase 23: Draft-Approval Workflow - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Every Helena AI output goes through explicit human approval before becoming a real record (Dokument, Frist, or Notiz) in the Akte. BRAK-compliant enforcement at the Prisma middleware level ensures Helena-created entries always have status=ENTWURF. Includes a global draft inbox, Socket.IO notifications, real-time locking, and a rejection-feedback pipeline that feeds back into Helena's context for improvement.

</domain>

<decisions>
## Implementation Decisions

### Draft Presentation in Akte Feed
- Distinct card style — different background or subtle dashed border to clearly stand apart from regular feed entries
- Each draft shows its type icon (document/calendar/note) and label like "Entwurf: Frist"
- Compact info: type, title, timestamp, status badge ("ausstehend"), origin conversation link ("Aus Chat: Klageerwiderung vorbereiten")
- Show which user triggered the Helena interaction that created the draft
- For Frist drafts: proposed deadline date shown prominently on the card
- For Dokument drafts: title only, no preview thumbnail
- Pending drafts pinned to top of Akte feed, grouped by type (e.g., "3 Dokument-Entwürfe") with expand/collapse
- Pinned section is collapsible (user can hide temporarily)
- No bulk actions — each draft must be reviewed individually (BRAK compliance)
- Rejected drafts collapse/hide (move to "Verlauf" section) — keeps feed clean
- Accepted drafts leave a trace entry ("✓ Helena-Entwurf angenommen") in the feed timeline
- Badge count on Akte detail page (inside Akte only, not in Akten-Übersicht list)
- No aging indicator — all pending drafts look the same regardless of age

### Draft Versioning
- Revisions appear as new linked cards ("Revision von [Original]") — both original and revision visible
- Inline diff available ("Vergleichen" button) between original and revised draft
- Cap at 3 revisions — after 3 rejections, draft is marked "Manuell bearbeiten"

### Global Draft Inbox
- Dedicated "Entwürfe" sidebar item with badge count (total count only, no breakdown)
- Filter by Akte and draft type (Dokument/Frist/Notiz), sorted by newest first
- Show triggering user per draft

### Approval Interaction
- Action buttons (Annehmen/Bearbeiten/Ablehnen) always visible on the card — no hover discovery
- One-click accept — no confirmation dialog, immediately creates the real record
- Accept uses Helena's proposed defaults (category, location) — no target customization at accept time
- 5-second undo toast after accepting — safety net for accidental accepts
- Minimal accept feedback ("✓ Angenommen") — no detailed message
- Detail view opens in a centered modal with full rendered draft content
- Keyboard shortcuts in modal: A (Annehmen), B (Bearbeiten), R (Ablehnen)
- Arrow key navigation between drafts in modal — left/right to cycle through pending drafts
- Real-time hard lock via Socket.IO when someone opens a draft — others see "Wird von [Name] geprüft" and cannot act

### Edit Behavior (per type)
- Dokument drafts: "Bearbeiten" opens the WYSIWYG editor (OnlyOffice/TipTap)
- Frist drafts: "Bearbeiten" opens a Frist-specific form (date picker, description, reminder settings)
- Notiz drafts: "Bearbeiten" opens a simple text area modal
- After editing any type: draft returns to "ausstehend" for another review (not auto-accept)

### Rejection Feedback
- Rejection reason is optional (not mandatory) — fast rejections possible
- Content-focused categories available (multi-select): "Inhaltlich falsch", "Unvollständig", "Ton/Stil unpassend", "Formatierung"
- Free text field for elaboration — no character limit
- "Nicht überarbeiten" discard option available — stops auto-revise loop for this draft
- Rejection with feedback triggers auto-revise: Helena automatically generates a revised draft
- Notification fires when revision is ready (no loading state on card)
- Revision card shows feedback context it was based on ("Revision basiert auf: Ton/Stil — zu formell")
- Global user preferences extracted from rejection patterns across all Akten — Helena learns cross-case

### RBAC for Draft Approval
- ANWALT role always has approval rights (non-removable, BRAK requirement)
- Akte owner can configure additional approval rights (e.g., add SACHBEARBEITER)

### Notification UX
- New draft notification: Toast + bell badge (dual notification)
- Toast is clickable — navigates directly to the draft detail modal
- Toast auto-dismisses after 5 seconds
- No notification sound — visual only
- Recipients: triggering user + Akte owner (if different)
- Revision-ready notifications use same style as new draft notifications
- Bell dropdown groups notifications by Akte ("Akte Müller: 3 neue Entwürfe")
- Same treatment for self-triggered vs other-triggered drafts (no personalized wording)
- In-app notifications only — no browser push notifications
- Draft-specific mute toggle in user profile/settings — suppresses all (toast + badge)
- Live feed update: "1 neuer Entwurf" banner indicator (user clicks to load) — not auto-insert

### Claude's Discretion
- Exact card styling (colors, shadows, border treatment) within the distinct card style decision
- Loading skeleton and transition animations
- Error state handling for failed accept/reject operations
- Toast positioning and animation style
- Exact lock timeout duration and cleanup behavior
- Prisma middleware implementation details for ENTWURF gate

</decisions>

<specifics>
## Specific Ideas

- Draft pinned section follows Twitter's "new tweets" pattern — banner indicator for new arrivals, not auto-insert
- Modal with keyboard shortcuts + arrow navigation = power-user review flow
- Real-time hard lock prevents conflicting approval actions — no optimistic concurrency issues
- Rejection categories are content-focused (what's wrong) not action-focused (what to do) — Helena infers the action from the feedback

</specifics>

<deferred>
## Deferred Ideas

- Helena-Einstellungen page — UI for viewing and managing Helena's learned preferences from rejection patterns. The data is stored in this phase, the management UI belongs in a future phase.
- General DND (Do Not Disturb) notification mode — a system-wide notification mute that goes beyond draft-specific. Belongs in a general notification settings phase.
- Browser/OS push notifications — in-app only for now, push notifications are a separate feature.

</deferred>

---

*Phase: 23-draft-approval-workflow*
*Context gathered: 2026-02-27*
