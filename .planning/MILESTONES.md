# Milestones

## v3.4 Full-Featured Kanzleisoftware (Shipped: 2026-02-25)

**Delivered:** AI-Lawyer transformed from an MVP case management system into a full-featured Kanzleisoftware with 64 capabilities across infrastructure, deadline calculation, email, document pipeline, finance, AI, beA, and security — all operational in 2 days.

**Phases:** 13 (9 planned + 4 gap-closure insertions)
**Plans:** 38 completed
**Tasks:** 105 executed
**Lines of Code:** 90,375 LOC TypeScript (461 files)
**Commits:** 201
**Git range:** `feat(01-01)` → `feat(09-01)`
**Timeline:** 2026-02-24 → 2026-02-25 (2 days)

**Key accomplishments:**
1. Redis + BullMQ + Socket.IO infrastructure with real-time notifications and admin monitoring
2. BGB-compliant Fristenberechnung (50+ unit tests), Vorlagen with auto-placeholders, Briefkopf, OnlyOffice co-editing with Track Changes
3. Full IMAP IDLE + SMTP email client with three-pane inbox, compose, Veraktung, and ticket creation
4. Auto-OCR document pipeline (Stirling-PDF), PDF viewer, RAG ingestion with German legal chunking + pgvector
5. Complete financial module: RVG calculator (KostBRaeG 2025), invoicing, E-Rechnung (XRechnung + ZUGFeRD), Aktenkonto with Fremdgeld compliance, DATEV/SEPA export, Zeiterfassung
6. Multi-provider AI (Ollama/OpenAI/Anthropic) with RAG document chat, proactive Helena agent, auto-Fristenerkennung, beA integration via bea.expert
7. RBAC enforcement with Dezernate, DSGVO compliance (anonymization, Auskunftsrecht), system-wide Audit-Trail, Versand-Gate, health checks

**Known tech debt (minor, non-blocking):**
- Bull Board PUT handler returns 501 (stub)
- Briefkopf OnlyOffice editing mode deferred (form mode works)
- bea.expert JS library requires commercial registration (user setup)
- middleware.ts excludes /api/ki routes from session enforcement (auth handled internally)

**Archives:**
- `milestones/v3.4-ROADMAP.md`
- `milestones/v3.4-REQUIREMENTS.md`
- `milestones/v3.4-MILESTONE-AUDIT.md`

---


## v3.5 Production Ready (Shipped: 2026-02-26)

**Delivered:** Docker production build fixed and complete Apple Sequoia-style Glass UI migration — all 9 services running healthy in Docker, entire frontend redesigned to liquid glass aesthetic with oklch design tokens, Motion/React animations, and full dark mode support.

**Phases:** 2 (10–11)
**Plans:** 10 completed
**Files changed:** 234 | **Insertions:** 26,707 | **Deletions:** 1,020
**Lines of Code:** ~91,300 LOC TypeScript
**Timeline:** 2026-02-25 → 2026-02-26 (2 days)
**Git range:** `fix(10-01)` → `feat(11-07)`

**Key accomplishments:**
1. Docker production build fixed — Next.js compiles clean, pino-roll build-safe, hardened next.config.mjs
2. All 9 Docker services run healthy — production entrypoint (prisma migrate deploy + conditional seed), IPv4 Alpine healthchecks, date-fns Docker copy, Ollama as core service
3. Complete oklch glass design system — 4 blur tiers (8px/16px/24px/40px), gradient mesh background, macOS scrollbars, full dark mode CSS token structure
4. Animated glass sidebar — Motion/React v11 spring physics, backdrop-blur-xl, dark mode toggle, profile chip; all with prefers-reduced-motion support
5. Glass component library — GlassCard (variants), GlassPanel (elevation tiers), GlassKpiCard (count-up animation), glass-input primitives, glass-shimmer skeleton, Button motion spring
6. All 26 dashboard pages migrated to glass design — 0 `font-heading` in any page file, UI/form/list requirements all satisfied

**Known Gaps (intentionally deferred to TODO):**
- FD-01–FD-04: Falldatenblaetter per-Rechtsgebiet Feldschemas
- BI-01–BI-05: BI-Dashboard KPI-Kacheln
- EXP-01–EXP-04: CSV/XLSX Export für Akten, Kontakte, Finanzen

**Tech debt (non-blocking):**
- 62× `font-heading` in sub-components (dialogs, tab components) — outside page-scope SC
- 77× `.glass` alias in sub-components — renders correctly via @apply glass-card

**Archives:**
- `milestones/v3.5-ROADMAP.md`
- `milestones/v3.5-REQUIREMENTS.md`
- `milestones/v3.5-MILESTONE-AUDIT.md`

---

