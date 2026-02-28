# Phase 24: Scanner + Alerts - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Helena proactively scans all open cases nightly and surfaces critical issues as prioritized alerts. Covers: background scanner cron with 3 check types, alert deduplication, progressive escalation, Alert-Center page, and Socket.IO push for critical alerts. Does NOT include: Activity Feed integration (Phase 26), QA-Gates (Phase 26), or Helena Memory (Phase 25).

</domain>

<decisions>
## Implementation Decisions

### Scanner checks & scope
- 3 active checks: FRIST_KRITISCH, AKTE_INAKTIV, Missing Data (BETEILIGTE_FEHLEN, DOKUMENT_FEHLT)
- NEUES_URTEIL check deferred — other 3 checks cover the critical path; add later when Urteile-RAG usage patterns are clearer
- WIDERSPRUCH check deferred — would require LLM-based contradiction scanning; too complex for deterministic scanner

### Frist-Check behavior
- Critical escalation only: scanner creates FRIST_KRITISCH alerts for Fristen < 48h that are still unacknowledged (not quittiert, not erledigt)
- frist-reminder.ts keeps handling normal Vorfristen and overdue escalation — no duplication
- Scanner complements, does not replace, the existing frist-reminder system

### Inaktivitaets-Check
- 14-day threshold: no new documents, emails, or notes in 14 days on an open Akte = AKTE_INAKTIV
- Only checks open/active Akten (not archiviert)

### Anomalie-Check (Missing Data)
- Structural completeness checks only — no LLM needed
- BETEILIGTE_FEHLEN: Akte has no Mandant or no Gegner assigned
- DOKUMENT_FEHLT: configurable per check (e.g., Vollmacht missing) — details at Claude's discretion

### Alert deduplication
- Same alert type + same Akte within 24h = suppressed (no duplicate creation)

### Alert auto-resolve
- Scanner checks existing unresolved alerts and marks them resolved when condition is fixed (e.g., Frist erledigt, Mandant added)
- Auto-resolved alerts keep a history entry (resolvedAt timestamp + reason) for audit trail

### Progressive escalation
- After 3 days unresolved: bump severity +2
- After 7 days unresolved: escalate to Admin via notification
- Ensures nothing gets forgotten even if user ignores alerts

### Dismiss flow
- One-click dismiss (gelesen = true) with optional comment field for audit trail
- No required comment, even for critical alerts

### Alert-Center access
- New "Alerts" sidebar nav item with unread count badge (reuses NavItem.badgeKey pattern from Phase 23)
- Clicking opens dedicated /alerts page

### Alert-Center layout
- Flat chronological list, newest first
- Filter chips at top: by type (FRIST_KRITISCH, AKTE_INAKTIV, etc.), by Akte, gelesen/ungelesen
- "Alle gelesen" bulk action button at top — no individual checkboxes

### Akte integration
- Alerts appear in both /alerts page AND in Akte detail view (existing tabs/sections)
- When Phase 26 Activity Feed ships, alerts will integrate there

### Socket.IO push
- Only FRIST_KRITISCH triggers real-time Socket.IO push to the user
- Other alert types are visible in Alert-Center on next page load — avoids notification fatigue
- Badge count update pushed via Socket.IO for all types

### Notification routing
- Reuse Vertreter routing pattern from frist-reminder.ts: when Verantwortlicher is on vacation, route to Vertreter + notify both
- Consistent behavior across frist-reminder and scanner systems

### Claude's Discretion
- Email notification for FRIST_KRITISCH: evaluate overlap with frist-reminder email and decide whether scanner should also email or rely on frist-reminder's existing email channel
- Admin escalation mechanism: notification vs separate HelenaAlert — pick cleanest approach given existing patterns
- Who can dismiss alerts: Verantwortlicher + Admin vs anyone with Akte access — pick based on existing RBAC patterns
- DOKUMENT_FEHLT specific rules: which documents are "expected" per Sachgebiet
- Scanner cron schedule: existing aiProactiveQueue has 4h pattern, roadmap says "nightly" — decide appropriate schedule

</decisions>

<specifics>
## Specific Ideas

- Scanner should be fast and deterministic — all 3 checks are rule-based, no LLM calls needed
- Reuse existing patterns: frist-reminder.ts for dedup + notification + Vertreter routing, health/alerts.ts for cooldown pattern, aiProactiveQueue for cron scheduling
- HelenaAlert model already has all needed fields (typ, titel, inhalt, severity, prioritaet, gelesen, gelesenAt, meta JSON)
- create-alert.ts tool already creates HelenaAlerts but lacks dedup and Socket.IO — scanner service should be separate from the agent tool

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HelenaAlert` Prisma model: 6 alert types, severity/prioritaet, gelesen/gelesenAt, meta JSON — ready to use
- `create-alert.ts` (Helena tool): creates alerts directly (not as drafts) — scanner will use similar Prisma calls but with dedup
- `frist-reminder.ts`: mature dedup via Notification table, Vertreter routing, catch-up logic, email pattern — reference for scanner processor
- `health/alerts.ts`: in-memory cooldown tracker, email to admins pattern — reference for escalation
- `aiProactiveQueue` + `registerAiProactiveJob()`: queue and cron registration already exist in queues.ts (4h pattern)
- `NavItem.badgeKey`: generic sidebar badge support added in Phase 23 — use for alert count badge
- `createNotification()`: existing notification service for in-app notifications
- Socket.IO: already used for draft notifications (`notifyDraftCreated` pattern)

### Established Patterns
- BullMQ cron via `upsertJobScheduler()` with Europe/Berlin timezone — used by frist-reminder, gesetze-sync, urteile-sync
- Processor files in `src/workers/processors/` or `src/lib/queue/processors/` — scanner processor goes here
- Worker registration in `src/worker.ts` — new processor registered there
- Settings via `getSettingTyped()` — configurable thresholds stored in SystemSetting table

### Integration Points
- `src/worker.ts`: register scanner processor
- `src/lib/queue/queues.ts`: aiProactiveQueue already exists, may reuse or create dedicated scanner queue
- Sidebar nav config: add "Alerts" nav item with badgeKey
- `/app/(dashboard)/alerts/page.tsx`: new page route
- Socket.IO server: new event type for alert push

</code_context>

<deferred>
## Deferred Ideas

- NEUES_URTEIL check (keyword/semantic matching of new Urteile against open Akten) — add when Urteile-RAG usage patterns are clearer
- WIDERSPRUCH check (LLM-based contradiction scanning between documents) — too complex for deterministic scanner, consider as separate Helena agent capability
- Dashboard widget for Alert-Center summary — Phase 26 scope

</deferred>

---

*Phase: 24-scanner-alerts*
*Context gathered: 2026-02-28*
