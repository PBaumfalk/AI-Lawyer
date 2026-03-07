# Roadmap: AI-Lawyer

## Milestones

- ✅ **v3.4 Full-Featured Kanzleisoftware** — Phases 1-9 (shipped 2026-02-25)
- ✅ **v3.5 Production Ready** — Phases 10-11 (shipped 2026-02-26)
- ✅ **v0.1 Helena RAG** — Phases 12-18 (shipped 2026-02-27)
- ✅ **v0.2 Helena Agent** — Phases 19-27 (shipped 2026-02-28)
- ✅ **v0.3 Kanzlei-Collaboration** — Phases 28-32 (shipped 2026-03-02)
- ✅ **v0.4 Quest & Polish** — Phases 33-42 (shipped 2026-03-03)
- ✅ **v0.5 Mandantenportal** — Phases 43-50 (shipped 2026-03-03)
- ✅ **v0.6 Stabilisierung** — Phase 51 (shipped 2026-03-04)
- ✅ **v0.6.1 Adhoc Bugfixes** — Phase 52 (shipped 2026-03-06)
- ✅ **v0.7 UI/UX & Stability** — Phases 53-54 (shipped 2026-03-06)
- ✅ **v0.8 Intelligence & Tools** — Phases 55-58 (shipped 2026-03-07)

## Phases

<details>
<summary>✅ v0.7 UI/UX & Stability (Phases 53-54) — SHIPPED 2026-03-06</summary>

- [x] Phase 53: ui-ux-quick-wins (2/2 plans) — completed 2026-03-06
- [x] Phase 54: stability-crash-audit (2/2 plans) — completed 2026-03-06

</details>

<details>
<summary>✅ v0.8 Intelligence & Tools (Phases 55-58) — SHIPPED 2026-03-07</summary>

- [x] Phase 55: BI-Dashboard + Export (4/4 plans) — completed 2026-03-06
- [x] Phase 56: PDF-Tools (2/2 plans) — completed 2026-03-06
- [x] Phase 57: Helena Intelligence (3/3 plans) — completed 2026-03-06
- [x] Phase 58: CalDAV-Sync (3/3 plans) — completed 2026-03-07

</details>

### v0.9 Security, Migration & Productivity (In Progress)

**Milestone Goal:** Harden login security with TOTP 2FA, enable one-shot migration from J-Lawyer, and transform the Akte detail page into a clean activity-feed-centric layout with inline composition and at-a-glance key facts.

- [x] **Phase 59: 2FA/TOTP** - Users secure their accounts with TOTP authenticator apps, backup codes, and admin-enforceable 2FA policies (completed 2026-03-07)
- [ ] **Phase 60: J-Lawyer Migration ETL** - Admin imports all cases, contacts, documents, and calendar from J-Lawyer via REST API
- [ ] **Phase 61: Feed Cleanup + Filterchips** - Akte activity feed becomes the default tab with human-readable events and category filters
- [ ] **Phase 62: Composer + Telefonnotiz** - Users create notes, phone notes, and tasks inline at the feed bottom
- [ ] **Phase 63: Tab-Reduktion + Key-Facts-Panel** - Akte detail tabs collapse to 4-5 visible with overflow, sticky key-facts panel above tabs

## Phase Details

### Phase 59: 2FA/TOTP
**Goal**: Users can secure their accounts with a second authentication factor
**Depends on**: Nothing (first phase of v0.9)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. User can enable TOTP in profile settings by scanning a QR code and verifying a 6-digit code
  2. User must enter a TOTP code after password login before accessing the dashboard
  3. User can generate backup codes and use one as a fallback when authenticator is unavailable
  4. Admin can configure per-role 2FA enforcement so that users without 2FA are redirected to setup
**Plans**: 5 plans

Plans:
- [x] 59-01-PLAN.md — Install otplib/qrcode, extend Prisma schema with TOTP fields, create TOTP service library
- [x] 59-02-PLAN.md — Create TOTP API routes (setup, verify-setup, disable, verify, backup-codes)
- [ ] 59-03-PLAN.md — Two-step login flow: init route, TOTP challenge page, auth.ts nonce handling
- [ ] 59-04-PLAN.md — Einstellungen > Sicherheit tab with QR setup UI, backup code management
- [ ] 59-05-PLAN.md — Admin 2FA enforcement via TOTP_REQUIRED_ROLES, middleware redirect, setup-required page

### Phase 60: J-Lawyer Migration ETL
**Goal**: Admin can migrate an entire Kanzlei from J-Lawyer into AI-Lawyer in one operation
**Depends on**: Phase 59
**Requirements**: MIG-01, MIG-02, MIG-03, MIG-04, MIG-05, MIG-06, MIG-07, MIG-08
**Success Criteria** (what must be TRUE):
  1. Admin can configure J-Lawyer REST API connection (URL + credentials) and test connectivity
  2. System imports Akten with metadata, Kontakte with deduplication, Beteiligte with correct role mapping, and Dokumente into MinIO
  3. System imports Kalendereintraege, Fristen, and Wiedervorlagen with correct dates and types
  4. Migration is idempotent -- re-running updates existing records via jlawyer_id without creating duplicates
  5. System displays a completion report showing counts of imported Akten, Kontakte, Dokumente, and errors
**Plans**: 5 plans

Plans:
- [ ] 60-01-PLAN.md — Prisma schema jlawyerId fields + J-Lawyer API client library
- [ ] 60-02-PLAN.md — ETL for Akten, Kontakte, and Beteiligte with idempotent upserts
- [ ] 60-03-PLAN.md — ETL for Dokumente (MinIO upload) and Kalendereintraege/Fristen/Wiedervorlagen
- [ ] 60-04-PLAN.md — Admin API routes: connection config, connectivity test, migration trigger and report
- [ ] 60-05-PLAN.md — Admin UI page: connection form, migration control, completion report

### Phase 61: Feed Cleanup + Filterchips
**Goal**: Akte activity feed is the default view with clean, human-readable events and category filtering
**Depends on**: Phase 60
**Requirements**: FEED-01, FEED-02, FEED-03
**Success Criteria** (what must be TRUE):
  1. Opening an Akte lands on the "Aktivitaeten" tab by default (not a different tab)
  2. All event texts in the feed are human-readable (no raw IDs, enum values, or MIME types visible)
  3. User can filter the feed by category chips (Alle, Fristen, Dokumente, Kommunikation, Zeit, System)
**Plans**: TBD

### Phase 62: Composer + Telefonnotiz
**Goal**: Users can create notes, phone notes, and tasks directly from the activity feed
**Depends on**: Phase 61
**Requirements**: FEED-04, FEED-05
**Success Criteria** (what must be TRUE):
  1. A persistent composer at the bottom of the feed lets users create Notizen, Telefonnotizen, and Aufgaben
  2. Telefonnotiz overlay captures Beteiligter, Ergebnis, Stichworte, and naechster Schritt -- and the entry appears in the feed immediately
**Plans**: TBD

### Phase 63: Tab-Reduktion + Key-Facts-Panel
**Goal**: Akte detail page is streamlined with fewer visible tabs and at-a-glance case facts
**Depends on**: Phase 62
**Requirements**: FEED-06, FEED-07
**Success Criteria** (what must be TRUE):
  1. Akte detail shows 4-5 primary tabs with remaining tabs accessible via an overflow menu
  2. A sticky Key-Facts panel above the tabs displays Gegenstandswert, Gericht, Phase, naechste Frist, and Mandant/Gegner at a glance
**Plans**: TBD

## Progress

**Execution Order:** 59 -> 60 -> 61 -> 62 -> 63

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-9 | v3.4 | 38/38 | Complete | 2026-02-25 |
| 10-11 | v3.5 | 10/10 | Complete | 2026-02-26 |
| 12-18 | v0.1 | 19/19 | Complete | 2026-02-27 |
| 19-27 | v0.2 | 23/23 | Complete | 2026-02-28 |
| 28-32 | v0.3 | 13/13 | Complete | 2026-03-02 |
| 33-42 | v0.4 | 21/21 | Complete | 2026-03-03 |
| 43-50 | v0.5 | 14/14 | Complete | 2026-03-03 |
| 51 | v0.6 | 4/4 | Complete | 2026-03-04 |
| 52 | v0.6.1 | 1/1 | Complete | 2026-03-06 |
| 53-54 | v0.7 | 4/4 | Complete | 2026-03-06 |
| 55-58 | v0.8 | 12/12 | Complete | 2026-03-07 |
| 59 | 5/5 | Complete    | 2026-03-07 | - |
| 60 | 3/5 | In Progress|  | - |
| 61 | v0.9 | 0/? | Not started | - |
| 62 | v0.9 | 0/? | Not started | - |
| 63 | v0.9 | 0/? | Not started | - |

---
*Last updated: 2026-03-07 after phase 59 planning*
