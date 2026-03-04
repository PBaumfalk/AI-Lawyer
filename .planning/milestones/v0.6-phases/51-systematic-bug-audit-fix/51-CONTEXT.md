# Phase 51: Systematic Bug Audit & Fix - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning
**Source:** Systematic Health Audit (.planning/debug/systematic-health-audit.md)

<domain>
## Phase Boundary

Fix all issues found in the systematic health audit. 16 issues across 4 severity levels: 1 critical, 6 high, 5 medium, 4 low. Focus on P0 and P1 fixes. P2 where practical. P3 deferred.

</domain>

<decisions>
## Implementation Decisions

### P0 — Fix Immediately

1. **React Hooks Violation** — `src/app/(dashboard)/admin/rollen/page.tsx:82`: Move `useCallback` before all early returns. Rules of Hooks must be satisfied.

2. **TypeScript Type Mismatch in falldaten-tab** — `src/components/akten/falldaten-tab.tsx:309-310`: `TemplateField.typ` is `string` but `FalldatenForm` expects `FalldatenFeldTypDB` union type. Also `beschreibung: string | null` vs `string | undefined`. Fix by aligning the type properly (cast or update the TemplateField type).

3. **Non-Route Export in special-quests** — `src/app/api/gamification/special-quests/route.ts:29`: exports `CONDITION_TEMPLATES` which is not a route handler export. Move to a separate file (e.g., `src/lib/gamification/condition-templates.ts`).

4. **Stirling PDF Health Check Wrong Port** — `src/lib/health/checks.ts:48`: Fallback URL `http://localhost:8090` should be `http://localhost:8081` to match docker-compose mapping `8081:8080`.

### P1 — Fix This Sprint

5. **Ollama URL Env Var Standardization** — Standardize to `OLLAMA_URL` everywhere (8 files). Update `.env`, `docker-compose.yml`, and all code references. Single fallback: `http://localhost:11434` for local, `http://ollama:11434` for Docker.
   - Files using `OLLAMA_BASE_URL`: `src/lib/ai/ollama.ts`, `src/lib/ai/provider.ts`, `src/lib/helena/complexity-classifier.ts`, `src/lib/settings/defaults.ts`
   - Files using `OLLAMA_URL`: `src/lib/health/checks.ts`, `src/lib/pii/ner-filter.ts`, `src/lib/embedding/embedder.ts`, `src/lib/ai/reranker.ts`

6. **Error Boundaries** — Add `error.tsx` for root layout, `(dashboard)` group, and `(portal)` group. Add `loading.tsx` for dashboard and portal. Add `not-found.tsx` for root.

7. **ESLint Config Fix** — Either install `@typescript-eslint/eslint-plugin` and configure the rule, OR remove the 8 `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments. Simpler: just remove the disable comments since the rule isn't active anyway.

8. **compose-popup.tsx Stale Closure** — Add `saveDraft` to the useEffect dependency array at line 153. Also fix missing `kontoId` dependency at line 118.

### P2 — Fix This Milestone

9. **Add test script to package.json** — Add `"test": "vitest run"` and `"test:watch": "vitest"`.

10. **Fix tools.test.ts Mock** — `src/lib/helena/__tests__/tools.test.ts:450`: `result.data` is undefined in `create_draft_dokument` test. Fix mock setup.

11. ~~**Clean Up Major Lint Warnings**~~ — Deferred. Full lint cleanup (317 warnings across 80+ files) is too broad for this stabilization phase. No partial cleanup either — focus on actual bugs.

12. **Enable Build Error Checking** — After fixing TS errors: set `ignoreBuildErrors: false` in next.config.mjs. Keep `ignoreDuringBuilds: true` for now (lint warnings too numerous).

### P3 — Deferred (NOT in this phase)

- Prisma major upgrade (5 -> 7)
- Silent catch block audit
- `<img>` to `<Image />` migration
- Next.js version upgrade for CVE fixes
- Falldaten UAT tests

### Claude's Discretion

- Exact error boundary UI design (use glass UI style consistent with app)
- Whether to use `useCallback` wrapper or restructure the hooks order in rollen/page.tsx
- How to handle the Ollama URL fallback logic (single env var with smart default vs explicit Docker/local handling)

</decisions>

<specifics>
## Specific References

- Full audit report: `.planning/debug/systematic-health-audit.md`
- All file paths and line numbers documented in audit report
- Docker compose: `docker-compose.yml` for service port mappings
- `.env` for environment variable definitions
- `next.config.mjs` for build configuration

</specifics>

<deferred>
## Deferred Ideas

- Next.js 15 upgrade (breaking changes, separate milestone)
- Prisma 7 upgrade (major version, separate milestone)
- Full lint cleanup (317 warnings — too large for this phase)
- npm audit fix for Next.js CVEs (requires version upgrade)
- Falldaten UAT test execution

</deferred>

---

*Phase: 51-systematic-bug-audit-fix*
*Context gathered: 2026-03-04 via Systematic Health Audit*
