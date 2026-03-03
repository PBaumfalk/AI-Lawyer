# Phase 45: Mandant-Datenraum - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Mandanten sehen ausschliesslich ihre eigenen Akten mit verstaendlichem Sachstand — keine internen Kanzleidaten sichtbar. Datentrennung, Akte-Wechsel, Sachstand-Timeline, Naechste Schritte, Akte-Uebersicht.

</domain>

<decisions>
## Implementation Decisions

### Data isolation
- Mandant sees only Akten where their linked Kontakt is Beteiligter(rolle=MANDANT)
- Strict server-side enforcement: API routes filter by Kontakt→Beteiligter chain
- No client-side-only filtering — all isolation at query level
- URL manipulation must not bypass isolation (validate akteId against Mandant's permitted Akten)

### Akte-Wechsel
- Portal dashboard shows list of Mandant's Akten (if multiple)
- Mandant selects an Akte to see its detail view (Sachstand, Dokumente, Nachrichten)

### Sachstand-Timeline
- mandantSichtbar Boolean field on AktenActivity controls per-event visibility
- Smart defaults: DOKUMENT (if document freigegeben) + STATUS_CHANGE default true; HELENA_DRAFT, HELENA_ALERT, EMAIL, NOTIZ, BETEILIGTE default false
- Anwalt can override mandantSichtbar on any activity
- Timeline shows events in reverse chronological order (newest first)

### Akte-Uebersicht
- Shows: Sachgebiet, Gegner (name), Gericht (name), Akte-Status
- "Naechste Schritte" text prominently displayed

### Claude's Discretion
- Nächste Schritte implementation: field on Akte model vs. special AktenActivityTyp
- How Anwalt sets mandantSichtbar (bulk toggle vs. per-activity toggle in feed)
- Portal dashboard layout when Mandant has only 1 Akte (skip Akte-Auswahl, go straight to detail?)
- Timeline display format (cards, list items, etc.)
- How to show Gegner/Gericht info (full Kontakt details or just name)

</decisions>

<specifics>
## Specific Ideas

- No internal activities should EVER leak to the Mandant: Helena drafts, internal notes, email subjects, alert details — all must be filtered
- Timeline should be simple and reassuring — "Your case is being handled. Here's what happened."
- Nächste Schritte should be prominent — the #1 thing a Mandant wants to know is "what happens next?"

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AktenActivity` model: 8 event types, meta JSON payload, akteId+createdAt index — add mandantSichtbar Boolean
- Akte model: sachgebiet field, status field — read for Uebersicht
- Beteiligter model: rolle=MANDANT + kontaktId → Kontakt.name for Gegner display

### Established Patterns
- Activity Feed: Existing in Akte-Detail (v0.2) — reverse chronological, card-based, type-filtered
- Data access: `requireAkteAccess(akteId)` pattern for RBAC checks — create portal equivalent `requireMandantAkteAccess(akteId, userId)`

### Integration Points
- prisma/schema.prisma: Add mandantSichtbar Boolean on AktenActivity
- Activity creation helpers: Ensure mandantSichtbar is set based on type defaults when creating activities
- Portal API: New /api/portal/akten and /api/portal/akten/[id]/timeline routes

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 45-mandant-datenraum*
*Context gathered: 2026-03-03*
