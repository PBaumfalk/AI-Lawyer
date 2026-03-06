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
- 🚧 **v0.8 Intelligence & Tools** — Phases 55-58 (in progress)

## Phases

<details>
<summary>✅ v0.7 UI/UX & Stability (Phases 53-54) — SHIPPED 2026-03-06</summary>

- [x] Phase 53: ui-ux-quick-wins (2/2 plans) — completed 2026-03-06
- [x] Phase 54: stability-crash-audit (2/2 plans) — completed 2026-03-06

</details>

### 🚧 v0.8 Intelligence & Tools (In Progress)

**Milestone Goal:** BI-Dashboard mit KPIs und Export, Helena Intelligence (Falldaten auto-fill, Fallzusammenfassung, globaler KI-Chat), PDF-Tools via Stirling-PDF und bidirektionaler CalDAV-Sync.

**Phase Numbering:**
- Integer phases (55, 56, 57, 58): Planned milestone work
- Decimal phases (55.1, 55.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 55: BI-Dashboard + Export** - KPI analytics with trend charts, filters, and CSV/XLSX/PDF export for all major data domains (completed 2026-03-06)
- [ ] **Phase 56: PDF-Tools** - Merge, split, rotate, reorder, compress, watermark, and redact via Stirling-PDF REST API
- [ ] **Phase 57: Helena Intelligence** - Falldaten auto-fill, Fallzusammenfassung, global KI-Chat, and template suggestions
- [ ] **Phase 58: CalDAV-Sync** - Bidirectional calendar sync with Google and Apple Calendar via tsdav

## Phase Details

### Phase 55: BI-Dashboard + Export
**Goal**: Users can view KPI analytics across Akten, Finanzen, Fristen, and Helena usage, filter by time/Anwalt/Sachgebiet, and export any data domain as CSV/XLSX/PDF
**Depends on**: Phase 54
**Requirements**: BI-01, BI-02, BI-03, BI-04, BI-05, BI-06, BI-07, BI-08, BI-09, EXP-01, EXP-02, EXP-03, EXP-04, EXP-05, EXP-06, EXP-07
**Success Criteria** (what must be TRUE):
  1. User can open a BI-Dashboard page showing KPI tiles for Akten, Finanzen, Fristen, and Helena with month-over-month deltas on each tile
  2. User can filter all KPIs and charts by Zeitraum (Monat/Quartal/Jahr/Custom), Anwalt, and Sachgebiet and see results update immediately
  3. User can view trend charts (Akten-Neuzugang, Umsatz pro Monat, Fristen-Compliance) as line/area visualizations with Recharts
  4. User can export Akten, Kontakte, and Finanzdaten as CSV or formatted XLSX from their respective list pages
  5. User can export the BI-Dashboard as a PDF report with Kanzlei-Briefkopf or as an XLSX with all KPI data tabellarisch
**Plans**: 4 plans

Plans:
- [ ] 55-01-PLAN.md — BI KPI API backend with Redis-cached aggregation queries and trend endpoints
- [ ] 55-02-PLAN.md — Generic CSV/XLSX export library + Akten/Kontakte/Finanzen export endpoints
- [ ] 55-03-PLAN.md — BI Dashboard UI with KPI tiles, filters, and Recharts trend charts
- [ ] 55-04-PLAN.md — BI Dashboard PDF and XLSX report export

### Phase 56: PDF-Tools
**Goal**: Users can perform common PDF operations (merge, split, rotate, reorder, compress, watermark, redact) directly from the DMS without leaving the browser
**Depends on**: Nothing (independent of Phase 55)
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, PDF-06, PDF-07, PDF-08
**Success Criteria** (what must be TRUE):
  1. User can select multiple PDFs from the DMS and merge them into a single document saved back to the Akte
  2. User can split a PDF by page ranges and reorder pages via drag-and-drop thumbnails
  3. User can rotate, compress, and watermark PDFs with operation-specific controls (degree selector, quality level, ENTWURF stamp or Kanzlei-Logo)
  4. User can auto-redact PII from a PDF for DSGVO compliance and verify the redacted result before saving
**Plans**: TBD

Plans:
- [ ] 56-01: TBD
- [ ] 56-02: TBD

### Phase 57: Helena Intelligence
**Goal**: Helena can extract structured data from documents into Falldatenblatt fields, generate case summaries, answer cross-Akte questions in a global chat, and suggest templates at Akte creation
**Depends on**: Nothing (independent of Phases 55-56)
**Requirements**: HEL-01, HEL-02, HEL-03, HEL-04, HEL-05, HEL-06, HEL-07
**Success Criteria** (what must be TRUE):
  1. User can trigger auto-fill on a Falldatenblatt and see per-field suggestions with confidence level (HOCH/MITTEL/NIEDRIG) and source excerpt -- accepting or rejecting each field individually, never auto-saved
  2. User can view a Fallzusammenfassung as a timeline with key facts panel in the Akte detail view
  3. User can open a global KI-Chat at /ki and ask cross-Akte questions that retrieve context from multiple Akten via RAG
  4. When creating a new Akte, Helena suggests matching Falldatenblatt templates based on Sachgebiet
**Plans**: TBD

Plans:
- [ ] 57-01: TBD
- [ ] 57-02: TBD

### Phase 58: CalDAV-Sync
**Goal**: Users can connect external calendars (Google, Apple) and see Fristen/Termine synchronized bidirectionally with conflict-safe rules
**Depends on**: Nothing (independent of Phases 55-57)
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04, CAL-05, CAL-06, CAL-07, CAL-08
**Success Criteria** (what must be TRUE):
  1. User can connect a Google Calendar via OAuth2 or Apple iCloud Calendar via app-specific password from Settings
  2. Fristen appear as read-only events in the external calendar; Termine sync bidirectionally (create, update, delete)
  3. Sync runs automatically every 15 minutes via BullMQ cron with a manual sync button, using ETag/CTag for incremental updates
  4. External calendar events from connected accounts are visible in the Kanzlei Tagesuebersicht alongside internal entries
  5. CalDAV credentials are stored encrypted following the existing EmailKonto pattern
**Plans**: TBD

Plans:
- [ ] 58-01: TBD
- [ ] 58-02: TBD
- [ ] 58-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 55 -> 56 -> 57 -> 58

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
| 55. BI-Dashboard + Export | 4/4 | Complete   | 2026-03-06 | - |
| 56. PDF-Tools | v0.8 | 0/2 | Not started | - |
| 57. Helena Intelligence | v0.8 | 0/2 | Not started | - |
| 58. CalDAV-Sync | v0.8 | 0/3 | Not started | - |

---
*Roadmap created: 2026-03-06 -- v0.8 Intelligence & Tools (4 phases, 39 requirements)*
