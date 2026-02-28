# Phase 21: @Helena Task-System - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can trigger Helena tasks by typing `@Helena [Aufgabe]` in any text field across the app. Tasks queue via BullMQ, show real-time progress via Socket.IO, store complete agent traces, support user-adjustable priority and abort. Task list lives under KI-Entwürfe. Results are delivered back to the originating context AND in the task detail.

</domain>

<decisions>
## Implementation Decisions

### @-Mention Parsing
- `@Helena` works in ALL text input fields across the app (notes, comments, chat, everywhere)
- `@` keystroke triggers autocomplete dropdown (like Slack) — no keyword detection without `@`
- Autocomplete shows `@Helena` as primary option. After selecting, typing `/` shows nested template sub-menu
- `@Helena` is stripped from saved text; side annotation (small icon on right margin of note row) shows task was created
- Both modes: explicit task description after `@Helena` OR `@Helena` alone = infer from note text + Akte context (beteiligte, fristen, dokumente)
- One task per `@Helena` mention (multiple mentions = multiple tasks)
- All RBAC roles can use `@Helena` (ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT)
- Helena runs with requesting user's RBAC permissions (not elevated)
- No Akte context = global tools only (search-alle-akten, gesetze, urteile, muster). No guessing/prompting.
- Client-side detection (browser parses `@Helena`, sends structured API call)
- Queue immediately after autocomplete selection — no confirmation step
- Toast notification after task creation: "Helena-Task erstellt" with link to task detail
- Ship shared @-mention hook for ALL text inputs at once (not progressive rollout)

### Task Templates
- Slash commands after `@Helena`: `/frist-check`, `/schriftsatz`, `/zusammenfassung`, `/recherche`, `/kosten-check` (5+ templates at launch)
- Nested menu: `@Helena` → select → type `/` → template list appears
- Free-form instruction always available alongside templates

### Chat Integration
- `@Helena` in ki-chat sidebar also creates tasks
- User chooses per message: "Aufgabe sofort bearbeiten (Chat) oder als Hintergrund-Task?"
- Chat synchronous mode = streamed response as usual; Background mode = task queue

### Task Progress UX
- Chat-like stream: Helena's thoughts in natural language ("Ich lese die Akte...", "3 relevante Gesetze gefunden", "Erstelle Schriftsatz-Entwurf...")
- Full German progress messages (no English tool names)
- Progress visible in BOTH ki-chat sidebar (collapsible cards per task) AND task detail page
- Show elapsed time per step: "Suche relevante Normen... (3s)"
- Show brief tool results: "3 Normen gefunden", "Akte gelesen: 5 Dokumente, 2 Fristen"
- Multiple running tasks: all visible with individual progress streams (collapsible in chat)
- Full notification on completion: toast + badge + alert center entry
- Notify only on completion (no auto-navigate to draft). User clicks link when ready.

### Task Detail & History
- Task list as new tab under existing /ki/entwuerfe page
- Summary at top + expandable "Trace anzeigen" for full step-by-step history
- Full filters: status, Akte, priority, source (manual/scanner). Sortable by date, priority.
- Source badge on each task: "👤 Manuell" or "🔍 Scanner"

### Results Delivery
- Completed task result appears in BOTH task detail AND as reply in originating context (note/comment thread)
- Draft results (Schriftsatz, Frist) show rich preview card (title, type, first lines) — click to open full draft

### Abort & Error UX
- Subtle X icon (corner of task card) to abort — not prominent red button
- Abort requires confirmation dialog: "Task abbrechen? Teilresultate gehen verloren."
- On failure: show error + 3 options: [Erneut versuchen] | [Von Anfang] | [Verwerfen]
- Auto-retry once on transient errors (Ollama timeout, network). If fails again → show error + options
- Retry always restarts from beginning (no step resume)
- Aborted/failed tasks keep partial trace (all completed steps visible in task detail)
- "Verwerfen" marks task as FAILED (stays in list for audit trail, not deleted)
- Failed tasks get same full notification as completed tasks (toast + badge + alert center)

### Priority & Queuing
- Show queue position: "Wartend (Position 3 von 7)"
- User-adjustable priority: Niedrig/Normal/Hoch/Dringend (default: Normal for manual, Niedrig for scanner)
- Concurrency: 1 task at a time (strict sequential queue)

### Claude's Discretion
- Exact autocomplete component implementation (cmdk, radix, custom)
- Glass UI styling for progress stream, task cards, task list
- Socket.IO event schema and channel naming
- BullMQ job data structure
- Human-friendly message mapping (which tool → which German sentence)
- Template task definitions (exact tool sequences per template)

</decisions>

<specifics>
## Specific Ideas

- Autocomplete UX like Slack's @-mention with nested slash commands like GitHub
- Progress stream feels like Helena is "thinking out loud" — conversational, not technical
- Side annotation on notes is subtle (not inline chip) — keeps note text clean
- Collapsible task cards in chat sidebar like notification cards
- Rich draft preview cards when results are documents

</specifics>

<deferred>
## Deferred Ideas

- @User mentions (tagging team members with notifications) — future phase, but autocomplete should be designed extensibly for this
- Task scheduling ("@Helena morgen um 9:00 Frist prüfen") — future capability

</deferred>

---

*Phase: 21-helena-task-system*
*Context gathered: 2026-02-27*
