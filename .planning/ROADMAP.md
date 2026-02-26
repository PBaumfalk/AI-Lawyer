# Roadmap: AI-Lawyer

## Milestones

- ✅ **v3.4 Full-Featured Kanzleisoftware** — Phases 1-9 (shipped 2026-02-25)
- **v3.5 Production Ready** — Phases 10-14 (in progress)

## Phases

<details>
<summary>v3.4 Full-Featured Kanzleisoftware (Phases 1-9) -- SHIPPED 2026-02-25</summary>

- [x] Phase 1: Infrastructure Foundation (3/3 plans) -- completed 2026-02-24
- [x] Phase 2: Deadline Calculation + Document Templates (6/6 plans) -- completed 2026-02-24
- [x] Phase 2.1: Wire Frist-Reminder Pipeline + Settings Init (1/1 plan) -- completed 2026-02-24
- [x] Phase 2.2: Fix API Routes + UI Paths (1/1 plan) -- completed 2026-02-24
- [x] Phase 3: Email Client (4/4 plans) -- completed 2026-02-24
- [x] Phase 3.1: Wire Email Real-Time + Compose Integration (1/1 plan) -- completed 2026-02-24
- [x] Phase 4: Document Pipeline (OCR + RAG Ingestion) (3/3 plans) -- completed 2026-02-24
- [x] Phase 4.1: Wire Akte Real-Time + Email Compose + Admin Pipeline (1/1 plan) -- completed 2026-02-24
- [x] Phase 5: Financial Module (6/6 plans) -- completed 2026-02-24
- [x] Phase 6: AI Features + beA (5/5 plans) -- completed 2026-02-25
- [x] Phase 7: Rollen/Sicherheit + Compliance + Observability (3/3 plans) -- completed 2026-02-25
- [x] Phase 8: Integration Hardening (3/3 plans) -- completed 2026-02-25
- [x] Phase 9: Final Integration Wiring + Tech Debt (1/1 plan) -- completed 2026-02-25

**Total: 13 phases, 38 plans, 105 tasks, 64/64 requirements**

See: `milestones/v3.4-ROADMAP.md` for full phase details.

</details>

### v3.5 Production Ready

**Milestone Goal:** Die bestehende Software produktionsreif machen -- Docker Build fixen, visuell konsistente Glass UI, Falldatenblatt-Framework, BI-Dashboard-KPIs und Daten-Export.

- [ ] **Phase 10: Docker Build Fix** - Webpack-Fehler beheben, production Docker Build lauffaehig machen -- gap closure in progress
- [ ] **Phase 11: Glass UI Migration** - Komplettes Redesign auf Apple Sequoia-Style Liquid Glass Design System
- [ ] **Phase 12: Falldatenblaetter** - Generisches Framework fuer Rechtsgebiet-spezifische Felder
- [ ] **Phase 13: BI-Dashboard** - KPI-Kacheln fuer Kanzlei-Kennzahlen auf der Dashboard-Seite
- [ ] **Phase 14: Export** - CSV- und XLSX-Export fuer Akten, Kontakte und Finanzdaten

## Phase Details

### Phase 10: Docker Build Fix
**Goal**: Application compiles and runs in production Docker containers without errors
**Depends on**: Nothing (first phase of v3.5, unblocks all other work)
**Requirements**: BUILD-01, BUILD-02
**Success Criteria** (what must be TRUE):
  1. `docker compose build` completes without webpack errors in the financial module or any other module
  2. `docker compose up` starts all 8 services (app, worker, postgres, redis, minio, meilisearch, stirling-pdf, onlyoffice) and they pass health checks
  3. The application is reachable in the browser at localhost and login works in the Docker-built production image
**Plans**: 3 plans
- [x] 10-01-PLAN.md -- Fix Next.js production build (logger, next.config, Dockerfile)
- [x] 10-02-PLAN.md -- Harden Docker entrypoint and verify full stack
- [ ] 10-03-PLAN.md -- Gap closure: Fix vector-store column names + rebuild Docker image

### Phase 11: Glass UI Migration
**Goal**: Complete redesign to Apple Sequoia-style liquid glass design system — new token foundation, dark mode, Motion/React animations, glass sidebar, and consistent application across all pages
**Depends on**: Phase 10 (stable build needed to verify UI changes)
**Requirements**: UI-01, UI-02, UI-03
**Design Reference**: /Users/patrickbaumfalk/Projekte/GVZ-Claude (glass component library to adopt)
**Key Decisions** (confirmed 2026-02-26):
  - Sidebar: Glass sidebar (backdrop-blur-xl, oklch transparent) — replaces dark Slate-900
  - Fonts: SF Pro Display → Inter → system-ui stack — replaces DM Serif Display / DM Sans
  - Animations: Motion/React v11 spring physics — replaces CSS transitions only
  - Theme: Full Light/Dark mode with .dark class strategy — new capability
  - Colors: Keep brand blue oklch(45% 0.2 260), adopt oklch throughout
  - Glass levels: 4 blur tiers (8px input, 16px card, 24px panel, 40px modal/sidebar)
**Success Criteria** (what must be TRUE):
  1. Design token system upgraded: globals.css uses oklch variables, 4 glass utility tiers, gradient mesh background, macOS scrollbars, dark mode CSS structure
  2. Motion/React installed and used for sidebar collapse, modal entry, button interactions, toast entry
  3. Sidebar migrated to glass-sidebar (transparent, backdrop-blur-xl) with dark mode toggle button
  4. All dashboard-level pages (Akten-Liste, Kontakte-Liste, Dokumente-Liste, E-Mail-Inbox, Kalender, KI-Entwuerfe, Tickets) use upgraded glass components
  5. All form pages use consistent glass-input styled inputs, labels, and glass-panel containers
  6. Dark mode toggle works app-wide; both modes look intentional and polished
  7. No page uses raw div/card that breaks the glass design language
**Plans**: 6 plans
- [ ] 11-01-PLAN.md -- Foundation: globals.css oklch tokens, 4 glass tiers, ThemeProvider, Prisma theme field, Motion/React install
- [ ] 11-02-PLAN.md -- Layout shell: glass sidebar with Motion animation, dark mode toggle, profile chip, glass header
- [ ] 11-03-PLAN.md -- Core components: glass-card/kpi-card/panel upgrades, Button Motion spring, glass-input form primitives, skeleton shimmer
- [ ] 11-04-PLAN.md -- Dashboard + Akten pages: glass-panel sections, stagger list animation, form wrappers
- [ ] 11-05-PLAN.md -- Kontakte + Dokumente + Email + KI pages: glass-panel containers, consistent form styling
- [ ] 11-06-PLAN.md -- Finanzen + Kalender + Tickets + beA + Admin + Settings pages: full coverage sweep

### Phase 12: Falldatenblaetter
**Goal**: Admins can define per-Rechtsgebiet field schemas, and those fields appear dynamically on Akte forms and detail pages
**Depends on**: Phase 10 (Prisma schema changes require stable build)
**Requirements**: FD-01, FD-02, FD-03, FD-04
**Success Criteria** (what must be TRUE):
  1. An admin can create/edit a field schema for a Rechtsgebiet (defining field name, type, and required/optional) via a settings UI
  2. When creating or editing an Akte, the form dynamically renders the fields defined for that Akte's Rechtsgebiet
  3. Saved Falldaten values appear on the Akte detail page in a dedicated section
  4. At least 3 pre-configured example schemas exist (Arbeitsrecht, Familienrecht, Verkehrsrecht) with realistic fields
  5. Falldaten are stored in the database with a proper Prisma model (not ad-hoc JSON blobs without schema)
**Plans**: TBD

### Phase 13: BI-Dashboard
**Goal**: Decision-makers see key business metrics at a glance on the dashboard
**Depends on**: Phase 10 (stable build); reads existing Prisma models (Akte, Rechnung, Frist)
**Requirements**: BI-01, BI-02, BI-03, BI-04, BI-05
**Success Criteria** (what must be TRUE):
  1. Dashboard shows a KPI tile for "Neue Akten pro Monat" with the current month count and a trend indicator vs. previous month
  2. Dashboard shows a KPI tile for "Offene Posten" displaying the total sum of unpaid invoices
  3. Dashboard shows a KPI tile for "Faellige Fristen" with the count of deadlines due in the next 7 days
  4. Dashboard shows a KPI tile for "Umsatz pro Monat" with the current month revenue figure
  5. The BI dashboard section is only visible to users with ADMIN or ANWALT role (RBAC-enforced on both API and UI)
**Plans**: TBD

### Phase 14: Export
**Goal**: Users can export core data as CSV or XLSX files for external analysis, reporting, and compliance
**Depends on**: Phase 10 (stable build); reads existing data models
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04
**Success Criteria** (what must be TRUE):
  1. User can export the Akten list as CSV, with currently active filters applied to the export
  2. User can export the Kontakte list as CSV
  3. User can export financial data (Rechnungen, Aktenkonto entries) as CSV
  4. User can choose XLSX as an alternative format for all three export areas (Akten, Kontakte, Finanzen)
  5. Exported files contain correct German column headers and properly encoded umlauts (UTF-8 BOM for CSV)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 10 -> 11 -> 12 -> 13 -> 14
(Phases 11, 12, 13, 14 all depend on Phase 10 but are otherwise independent. After Phase 10, they can execute in any order.)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|---------------|--------|-----------|
| 1. Infrastructure Foundation | v3.4 | 3/3 | Complete | 2026-02-24 |
| 2. Deadline Calc + Templates | v3.4 | 6/6 | Complete | 2026-02-24 |
| 2.1 Frist-Reminder Pipeline | v3.4 | 1/1 | Complete | 2026-02-24 |
| 2.2 Fix API Routes + UI | v3.4 | 1/1 | Complete | 2026-02-24 |
| 3. Email Client | v3.4 | 4/4 | Complete | 2026-02-24 |
| 3.1 Email Real-Time + Compose | v3.4 | 1/1 | Complete | 2026-02-24 |
| 4. Document Pipeline (OCR+RAG) | v3.4 | 3/3 | Complete | 2026-02-24 |
| 4.1 Akte RT + Email + Pipeline | v3.4 | 1/1 | Complete | 2026-02-24 |
| 5. Financial Module | v3.4 | 6/6 | Complete | 2026-02-24 |
| 6. AI Features + beA | v3.4 | 5/5 | Complete | 2026-02-25 |
| 7. Rollen/Sicherheit/Compliance | v3.4 | 3/3 | Complete | 2026-02-25 |
| 8. Integration Hardening | v3.4 | 3/3 | Complete | 2026-02-25 |
| 9. Final Integration + Tech Debt | v3.4 | 1/1 | Complete | 2026-02-25 |
| 10. Docker Build Fix | v3.5 | 2/3 | In Progress | 2026-02-25 |
| 11. Glass UI Migration | 2/6 | In Progress|  | - |
| 12. Falldatenblaetter | v3.5 | 0/? | Not started | - |
| 13. BI-Dashboard | v3.5 | 0/? | Not started | - |
| 14. Export | v3.5 | 0/? | Not started | - |

---
*Last updated: 2026-02-26 after Phase 11 planning*
