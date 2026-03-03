---
phase: 45-mandant-datenraum
verified: 2026-03-03T13:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 45: Mandant-Datenraum Verification Report

**Phase Goal:** Mandant data room — Akte listing, Akte detail with timeline and naechste Schritte, strict data isolation (Mandant only sees own Akten), Anwalt-side controls for mandantSichtbar and naechste Schritte
**Verified:** 2026-03-03T13:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Portal API returns only Akten where the logged-in Mandant's linked Kontakt is Beteiligter(rolle=MANDANT) | VERIFIED | `getMandantAkten()` in `portal-access.ts` queries `prisma.akte.findMany` via `beteiligte.some { kontaktId: user.kontaktId, rolle: "MANDANT" }` — server-side isolation, no client filtering |
| 2  | URL manipulation of akteId in portal API routes returns 404 for non-permitted Akten | VERIFIED | `requireMandantAkteAccess()` returns `NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })` when Beteiligter not found — not 403, hiding Akte existence |
| 3  | Portal timeline API returns only activities with mandantSichtbar=true, never internal events by default | VERIFIED | Timeline route has `mandantSichtbar: true` in Prisma where clause (line 41); NO user info or meta fields selected (comment on line 52 confirmed) |
| 4  | Anwalt can set naechsteSchritte text on an Akte via API | VERIFIED | `PUT /api/akten/[id]/naechste-schritte` route exists, calls `requireAkteAccess`, updates `prisma.akte.update({ data: { naechsteSchritte: text || null } })` and creates mandantSichtbar=true activity |
| 5  | Portal Akte detail API returns sachgebiet, status, Gegner name, Gericht name, and naechsteSchritte | VERIFIED | Route returns `{ id, aktenzeichen, kurzrubrum, wegen, sachgebiet, status, naechsteSchritte, gegner, gerichte }` — anwaltId, kanzleiId, meta are absent from select |
| 6  | Mandant sees a dashboard listing only their own Akten with Aktenzeichen, Kurzrubrum, Sachgebiet, and Status | VERIFIED | Dashboard calls `getMandantAkten()` and passes result to `<AkteAuswahl>` which renders cards with all four fields |
| 7  | Mandant with multiple Akten can click to switch between them | VERIFIED | `AkteAuswahl` renders `<Link href="/portal/akten/${akte.id}">` cards in a responsive grid |
| 8  | Mandant with only one Akte is taken directly to the Akte detail view | VERIFIED | Dashboard page has `if (akten.length === 1) { redirect(\`/portal/akten/${akten[0].id}\`) }` |
| 9  | Mandant sees a simplified timeline with key events (newest first) — no internal Helena/email/notiz events visible | VERIFIED | Timeline route filters `mandantSichtbar: true`, ordered by `createdAt: "desc"`. Internal types (HELENA_DRAFT, EMAIL, NOTIZ) default to `mandantSichtbar=false` per schema |
| 10 | Mandant sees Akte overview with Sachgebiet, Gegner name, Gericht name, and Status | VERIFIED | `AkteUebersicht` renders four info rows: Sachgebiet, Status (colored badge), Gegner, Gericht — with "Nicht angegeben" fallback |
| 11 | Mandant sees naechste Schritte prominently displayed on the Akte detail page | VERIFIED | `NaechsteSchritteCard` uses `border-2 border-primary/20 bg-primary/[0.03]` for visual prominence; placed in right sidebar above AkteUebersicht scroll |
| 12 | Anwalt can set naechste Schritte text from the internal Akte detail page | VERIFIED | `NaechsteSchritteEditor` wired into `src/app/(dashboard)/akten/[id]/page.tsx` with role gate (`ADMIN || ANWALT || SACHBEARBEITER`), calls `PUT /api/akten/${akteId}/naechste-schritte` |

**Score:** 12/12 truths verified

---

### Required Artifacts

#### Plan 45-01 Artifacts

| Artifact | min_lines | Actual Lines | Status | Details |
|----------|-----------|--------------|--------|---------|
| `prisma/schema.prisma` | — | 2200+ | VERIFIED | `mandantSichtbar Boolean @default(false)` at line 2170; composite index at line 2176; `naechsteSchritte String? @db.Text` at line 850 |
| `src/lib/portal-access.ts` | — | 99 | VERIFIED | Exports `getMandantAkten` and `requireMandantAkteAccess` with full Prisma query implementations |
| `src/app/api/portal/akten/route.ts` | — | 30 | VERIFIED | Exports `GET`, role check MANDANT, calls `getMandantAkten`, returns `{ akten }` |
| `src/app/api/portal/akten/[id]/route.ts` | — | 108 | VERIFIED | Exports `GET`, calls `requireMandantAkteAccess`, returns Akte with Gegner/Gericht detail, no internal fields |
| `src/app/api/portal/akten/[id]/timeline/route.ts` | — | 81 | VERIFIED | Exports `GET`, `mandantSichtbar: true` filter, cursor pagination, no user/meta exposed |
| `src/app/api/akten/[id]/naechste-schritte/route.ts` | — | 60 | VERIFIED | Exports `PUT`, uses `requireAkteAccess`, updates Akte, creates mandantSichtbar=true activity |

#### Plan 45-02 Artifacts

| Artifact | min_lines | Actual Lines | Status | Details |
|----------|-----------|--------------|--------|---------|
| `src/app/(portal)/dashboard/page.tsx` | 30 | 44 | VERIFIED | Server component, auth check, 3-path logic (0/1/2+ Akten), renders AkteAuswahl |
| `src/app/(portal)/akten/[id]/page.tsx` | 40 | 133 | VERIFIED | Server component, requireMandantAkteAccess, direct Prisma query, two-column layout, all three sub-components |
| `src/components/portal/akte-auswahl.tsx` | 25 | 105 | VERIFIED | Client component, responsive grid, glass-card styling, badges, naechsteSchritte preview, Link to detail |
| `src/components/portal/akte-uebersicht.tsx` | 30 | 101 | VERIFIED | Stateless display, four info rows, status badge with oklch colors, Gegner/Gericht fallback |
| `src/components/portal/sachstand-timeline.tsx` | 40 | 189 | VERIFIED | Client component, cursor pagination, useEffect fetch, type icons, German date formatter, "Mehr laden" button |
| `src/components/portal/naechste-schritte-card.tsx` | 15 | 32 | VERIFIED | Accent border `border-2 border-primary/20`, empty state message, renders `naechsteSchritte` text |
| `src/components/akten/naechste-schritte-editor.tsx` | 30 | 94 | VERIFIED | Collapsible textarea, PUT fetch, sonner toast on success/error, helper text for Anwalt |

---

### Key Link Verification

#### Plan 45-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/api/portal/akten/route.ts` | `src/lib/portal-access.ts` | `getMandantAkten(session.user.id)` | WIRED | Import confirmed line 3; called line 21 |
| `src/app/api/portal/akten/[id]/route.ts` | `src/lib/portal-access.ts` | `requireMandantAkteAccess(akteId, session.user.id)` | WIRED | Import confirmed line 3; called line 30 |
| `src/app/api/portal/akten/[id]/timeline/route.ts` | `prisma.aktenActivity` | `mandantSichtbar: true` filter | WIRED | Line 41 in where clause; filter is critical safety gate |

#### Plan 45-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/(portal)/dashboard/page.tsx` | `getMandantAkten` (portal-access.ts) | Direct server-side call | WIRED | Import line 3; call line 16 — uses direct Prisma pattern, not /api/portal/akten fetch |
| `src/app/(portal)/akten/[id]/page.tsx` | `requireMandantAkteAccess` | Direct server-side call | WIRED | Import lines 4-6; called line 31 |
| `src/components/portal/sachstand-timeline.tsx` | `/api/portal/akten/[id]/timeline` | `fetch` in `useEffect` | WIRED | Line 54: `` `/api/portal/akten/${akteId}/timeline?${params.toString()}` `` with cursor pagination |
| `src/components/akten/naechste-schritte-editor.tsx` | `/api/akten/[id]/naechste-schritte` | `PUT fetch` on save | WIRED | Line 25: `` `/api/akten/${akteId}/naechste-schritte` `` with method: "PUT" |

Note: The plan's key_link for dashboard listed `/api/portal/akten` as the target, but the implementation uses a direct server-side `getMandantAkten()` call — a valid and superior pattern for server components. The isolation chain is identical; there is no security gap.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| PORTAL-03 | 45-01, 45-02 | Mandant sieht nur eigene Akten (strikte Datentrennung, DSGVO) | SATISFIED | Server-side isolation via Kontakt->Beteiligter(MANDANT)->Akte chain in portal-access.ts; 404-as-403 on unauthorized akteId; mandantSichtbar filter on timeline |
| PORTAL-04 | 45-01, 45-02 | Mandant kann zwischen mehreren eigenen Akten wechseln | SATISFIED | Dashboard with AkteAuswahl grid for 2+ Akten; auto-redirect for single Akte; Link cards navigate to detail page |
| SACH-01 | 45-01, 45-02 | Mandant sieht vereinfachte Timeline mit Key Events seiner Akte | SATISFIED | SachstandTimeline fetches mandantSichtbar=true activities with reverse chronological order, type icons, German dates, cursor pagination |
| SACH-02 | 45-01, 45-02 | Anwalt kann "Naechste Schritte" Text fuer Mandant setzen | SATISFIED | PUT /api/akten/[id]/naechste-schritte; NaechsteSchritteEditor role-gated to ANWALT/SACHBEARBEITER/ADMIN; sonner toast feedback |
| SACH-03 | 45-01, 45-02 | Mandant sieht Akte-Uebersicht (Sachgebiet, Gegner, Gericht, Status) | SATISFIED | AkteUebersicht renders all four fields; portal Akte detail API returns all four; Gegner/Gericht extracted from Beteiligter with rolle=GEGNER/GERICHT |

All 5 requirements fully satisfied. No orphaned requirements detected.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/akten/naechste-schritte-editor.tsx` | 74 | `placeholder="..."` on textarea | Info | This is an HTML textarea placeholder attribute for UX guidance, not a code placeholder stub. Not a concern. |

No blockers. No warnings.

---

### Human Verification Required

#### 1. Mandant Portal End-to-End Flow

**Test:** Log in as a MANDANT user, navigate to /portal/dashboard. Verify only own Akten appear. Click an Akte card. Verify overview sidebar shows correct Sachgebiet, Gegner, Gericht, Status. Verify NaechsteSchritteCard is visually prominent.
**Expected:** Dashboard shows only Mandant's Akten; Akte detail shows all overview fields correctly
**Why human:** Requires actual MANDANT session and populated database

#### 2. Timeline Mandant-Visibility Filter

**Test:** Create an AktenActivity with mandantSichtbar=false (e.g., a NOTIZ). Log in as MANDANT. Verify that activity does NOT appear in the portal timeline.
**Expected:** Only mandantSichtbar=true activities visible; NOTIZ, EMAIL, HELENA_DRAFT do not appear
**Why human:** Requires database state and live session — cannot grep-verify runtime filter behavior

#### 3. NaechsteSchritteEditor Role Gate

**Test:** Log in as SEKRETARIAT. Navigate to internal Akte detail. Verify NaechsteSchritteEditor is NOT rendered.
**Expected:** SEKRETARIAT sees no naechste Schritte editor
**Why human:** Requires live session with SEKRETARIAT role

#### 4. Visual Prominence of NaechsteSchritteCard

**Test:** View the portal Akte detail page with naechsteSchritte set. Verify the card is visually the most prominent element.
**Expected:** `border-2 border-primary/20 bg-primary/[0.03]` renders as a clearly distinct accent card
**Why human:** Visual appearance cannot be verified programmatically

---

### Commits Verified

All four commits documented in SUMMARY files confirmed present in git history:

- `76245ae` — feat(45-01): add schema fields and portal access library
- `b6865b1` — feat(45-01): add portal API routes and naechste-schritte endpoint
- `904ba43` — feat(45-02): portal dashboard with Akte-Auswahl component
- `cd1417f` — feat(45-02): portal Akte detail page with overview, timeline, naechste Schritte + Anwalt editor

---

### Summary

Phase 45 fully achieves its goal. All 12 observable truths are verified against the actual codebase. The Mandant data room is implemented end-to-end:

- **Data isolation** is enforced server-side at query level via the `User.kontaktId -> Beteiligter(rolle=MANDANT) -> Akte` chain in `portal-access.ts`. There is no client-side filtering. URL manipulation returns 404 to hide Akte existence.
- **Portal UI** provides a three-path dashboard (empty state / single-Akte redirect / multi-Akte grid) and a complete Akte detail view with two-column layout.
- **Timeline** filters strictly on `mandantSichtbar: true` — the filter is in the Prisma where clause, not post-query. Cursor pagination is fully implemented.
- **Naechste Schritte** is prominent on the portal detail page (accent border styling) and editable from the internal dashboard by ANWALT, SACHBEARBEITER, and ADMIN roles.
- All 5 requirement IDs (PORTAL-03, PORTAL-04, SACH-01, SACH-02, SACH-03) are satisfied with implementation evidence.
- No internal fields (anwaltId, kanzleiId, meta, gegenstandswert, falldaten) appear in portal API responses.
- No stub anti-patterns found. The `return []` in portal-access.ts is a valid early-exit guard, not a stub.

Four human verification items are noted for runtime behavior (session-dependent), visual appearance, and database-state-dependent filtering.

---

_Verified: 2026-03-03T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
