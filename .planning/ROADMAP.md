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

- [x] **Phase 10: Docker Build Fix** - Webpack-Fehler beheben, production Docker Build lauffaehig machen -- completed 2026-02-25
- [ ] **Phase 11: Glass UI Migration** - Verbleibende Seiten auf Glass-Komponenten migrieren
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
**Plans**: 2 plans
- [x] 10-01-PLAN.md -- Fix Next.js production build (logger, next.config, Dockerfile)
- [x] 10-02-PLAN.md -- Harden Docker entrypoint and verify full stack

### Phase 11: Glass UI Migration
**Goal**: Every user-facing page uses the Glass design system for visual consistency
**Depends on**: Phase 10 (stable build needed to verify UI changes)
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. All dashboard-level pages (Akten-Liste, Kontakte-Liste, Dokumente-Liste, E-Mail-Inbox, Kalender, KI-Entwuerfe, Tickets) use glass-card, glass-panel, or glass-kpi-card components
  2. All form pages (Akte anlegen/bearbeiten, Kontakt anlegen/bearbeiten, Einstellungen) use consistent Glass-styled inputs, labels, and panels
  3. All list/table pages render data inside Glass-Panels with consistent spacing, borders, and backdrop styling
  4. No page in the main navigation uses raw div/card elements that break the Glass design language
**Plans**: TBD

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
| 10. Docker Build Fix | v3.5 | 2/2 | Complete | 2026-02-25 |
| 11. Glass UI Migration | v3.5 | 0/? | Not started | - |
| 12. Falldatenblaetter | v3.5 | 0/? | Not started | - |
| 13. BI-Dashboard | v3.5 | 0/? | Not started | - |
| 14. Export | v3.5 | 0/? | Not started | - |

---
*Last updated: 2026-02-25 after v3.5 roadmap creation*
