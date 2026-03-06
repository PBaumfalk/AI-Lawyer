# Requirements: AI-Lawyer v0.7

**Defined:** 2026-03-06
**Core Value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollständig im Browser verwalten, während eine autonome KI-Agentin aktenübergreifend lernt und als digitale Rechtsanwaltsfachangestellte mitarbeitet.

## v0.7 Requirements

### UX Quick Wins

- [x] **UX-01**: Nutzer sieht reduzierte Tab-Leiste in Akte-Detail mit Overflow-Dropdown statt Scrollbar
- [x] **UX-02**: Nutzer sieht Key-Facts Panel mit strukturierten Akte-Informationen auf einen Blick
- [x] **UX-03**: Chat-KPI-Card wird ausgeblendet wenn kein aktiver Chat vorhanden (Feature nicht produktionsbereit)
- [x] **UX-04**: Nutzer sieht aussagekräftige Empty States in allen 4 Haupt-Tabs (keine leeren Seiten)
- [x] **UX-05**: ActivityFeed zeigt bereinigte Event-Texte ohne MIME-Types und UUID-Ketten

### Stability & Crash Audit

- [ ] **STAB-01**: Reproduzierbare Crashes sind dokumentiert, klassifiziert (P0/P1/P2) und in einer Repro-Suite erfasst
- [ ] **STAB-02**: Alle P0/P1 Crashes sind behoben und mit Regression-Tests gesichert
- [ ] **STAB-03**: Docker Deploy Smoke-Check läuft grün (alle 9 Services healthy nach `docker compose up`)
- [ ] **STAB-04**: Healthchecks sind stabil (App/Worker/Ollama/Redis/MinIO/Meilisearch — kein Flapping)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Prisma v5→v7 Upgrade | Breaking changes, eigener Migrations-Sprint nötig — explizit deferred |
| Next.js 15 Upgrade | CVE-Fixes, aber Breaking Changes — eigener Sprint |
| 317 ESLint unused-vars | Keine Funktionalität, zu groß für dieses Milestone |
| ~80 silent .catch() | Technisches Debt, nicht Crash-kritisch |
| compose-popup Draft-API | Eigene Feature-Arbeit, nicht Stability-Fix |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UX-01 | Phase 53 | Complete |
| UX-02 | Phase 53 | Complete |
| UX-03 | Phase 53 | Complete |
| UX-04 | Phase 53 | Complete |
| UX-05 | Phase 53 | Complete |
| STAB-01 | Phase 54 | Pending |
| STAB-02 | Phase 54 | Pending |
| STAB-03 | Phase 54 | Pending |
| STAB-04 | Phase 54 | Pending |

**Coverage:**
- v0.7 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after v0.7 milestone formalization*
