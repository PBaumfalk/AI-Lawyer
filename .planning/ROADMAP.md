# Roadmap: AI-Lawyer

## Milestones

- ✅ **v3.4 Full-Featured Kanzleisoftware** — Phases 1–9 (shipped 2026-02-25)
- ✅ **v3.5 Production Ready** — Phases 10–11 (shipped 2026-02-26)
- ✅ **v0.1 Helena RAG** — Phases 12–18 (shipped 2026-02-27)
- ✅ **v0.2 Helena Agent** — Phases 19–27 (shipped 2026-02-28)
- ✅ **v0.3 Kanzlei-Collaboration** — Phases 28–32 (shipped 2026-03-02)
- ✅ **v0.4 Quest & Polish** — Phases 33–42 (shipped 2026-03-03)
- ✅ **v0.5 Mandantenportal** — Phases 43–50 (shipped 2026-03-03)
- ✅ **v0.6 Stabilisierung** — Phase 51 (shipped 2026-03-04)
- ✅ **v0.6.1 Adhoc Bugfixes** — Phase 52 (shipped 2026-03-06)
- 🚧 **v0.7 UI/UX & Stability** — Phases 53–54 (Phase 53 complete, Phase 54 in planning)

## Phases

<details>
<summary>✅ v0.6.1 Adhoc Bugfixes (Phase 52) — SHIPPED 2026-03-06</summary>

- [x] Phase 52: adhoc-bugfixes (1/1 plans) — completed 2026-03-06

</details>

### 📋 v0.7 UI/UX & Stability (Planned)

**Milestone Goal:** Stabilität verbessern und zentrale Funktionen schneller erreichbar machen.

#### Phase 53: ui-ux-quick-wins
**Goal**: Weniger Klicks in Akte‑Detail, bessere Key‑Facts, Shortcuts
**Depends on**: Phase 52
**Requirements**: (aus v0.7)
**Success Criteria** (what must be TRUE):
  1. Akte‑Detail Tabs reduziert + Aktivitäten fokussiert
  2. Key‑Facts Panel + Quick Actions sichtbar
  3. E‑Mail Zugang aus Akte prominent erreichbar
**Plans**: 2 plans

Plans:
- [x] 53-01: Akte-Detail UX Improvements (Tab-Reduktion, Key-Facts-Panel, Chat-KPI-Hide, Empty States) — completed 2026-03-06
- [x] 53-02: ActivityFeed Event-Texte Bereinigung (MIME-Types, UUID-Ketten) — completed 2026-03-06

#### Phase 54: stability-crash-audit
**Goal**: Crash‑Audit, P0/P1 Fixes, Smoke‑Checks
**Depends on**: Phase 53
**Requirements**: (aus v0.7)
**Success Criteria** (what must be TRUE):
  1. Reproduzierbare Crashes dokumentiert & behoben
  2. Docker Deploy Smoke‑Check grün
  3. Healthchecks stabil (App/Worker/Ollama)
**Plans**: 2 plans

Plans:
- [ ] 54-01-PLAN.md — Crash-Audit: Triage aller Crash-Vektoren + Smoke-Test-Suite erstellen
- [ ] 54-02-PLAN.md — P0/P1 Fixes: Worker-Healthcheck, Redis-Cooldown, OnlyOffice-Auth, NER-Provider + Docker Smoke-Check

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–9 | v3.4 | 38/38 | Complete | 2026-02-25 |
| 10–11 | v3.5 | 10/10 | Complete | 2026-02-26 |
| 12–18 | v0.1 | 19/19 | Complete | 2026-02-27 |
| 19–27 | v0.2 | 23/23 | Complete | 2026-02-28 |
| 28–32 | v0.3 | 13/13 | Complete | 2026-03-02 |
| 33–42 | v0.4 | 21/21 | Complete | 2026-03-03 |
| 43–50 | v0.5 | 14/14 | Complete | 2026-03-03 |
| 51 | v0.6 | 4/4 | Complete | 2026-03-04 |
| 52 | v0.6.1 | 1/1 | Complete | 2026-03-06 |
| 53 | v0.7 | 2/2 | Complete | 2026-03-06 |
| 54 | 1/2 | In Progress|  | - |

---
*Roadmap updated: 2026-03-06 — Phase 54 plans created (54-01: Crash-Audit, 54-02: P0/P1 Fixes + Smoke-Check)*
