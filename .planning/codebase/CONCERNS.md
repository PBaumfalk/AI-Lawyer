# Codebase Concerns

**Analysis Date:** 2026-03-06

---

## Tech Debt

**Hardcoded email address in compose view:**
- Issue: Sender email is hard-coded as `"info@kanzlei-baumfalk.de"` with a comment marking it as TODO
- Files: `src/components/email/email-compose-view.tsx:150`
- Impact: Every firm that uses the app sends emails from the wrong address; this is a data-integrity and branding defect
- Fix approach: Read sender from the authenticated user's assigned `EmailKonto.emailAdresse` at compose time

**NER PII model hard-coded (ignores provider setting):**
- Issue: `NER_MODEL = "qwen3.5:35b"` is a module-level constant; it is not driven by `SystemSettings` or the configured AI provider
- Files: `src/lib/pii/ner-filter.ts:20`
- Impact: When the kanzlei switches providers (e.g. to OpenAI or Anthropic), the DSGVO/BRAO NER gate still fires Ollama requests regardless; if Ollama is offline, embeddings are blocked entirely
- Fix approach: Read model from `SystemSettings` via `getSettingTyped`, or extract it from the same `getModel()` factory

**AiConversation messages stored as opaque JSON blob:**
- Issue: `AiConversation.messages` is typed `Json` in the Prisma schema; the application casts it to `any[]` at every read site
- Files: `prisma/schema.prisma:1610`, `src/app/api/ki-chat/conversations/route.ts:60`, `src/app/api/ki-chat/route.ts:970`
- Impact: No type safety, no size limits enforced at the DB layer; long conversations cause unbounded row growth. A single 1000-turn conversation becomes a very large JSON cell
- Fix approach: Define a `ConversationMessage` Zod schema and validate on read; add an application-layer limit (e.g. keep last N messages in the JSON and archive the rest)

**Schema migration run at worker startup via `$executeRawUnsafe`:**
- Issue: `worker.ts` runs `ALTER TABLE akten ADD COLUMN IF NOT EXISTS "summaryEmbedding"` and creates HNSW indexes at boot time inside the worker process
- Files: `src/worker.ts:960-980`
- Impact: Schema changes should be in Prisma migrations, not worker startup scripts; this creates a race if two workers start simultaneously and is invisible in the migration history
- Fix approach: Move the column additions and index creation into a proper Prisma migration; remove the DDL block from `worker.ts`

**`session.user as any` used in 68+ files:**
- Issue: `session.user as any` is the only way to access `role`, `kanzleiId`, and `kontaktId` because NextAuth's session type is not extended to carry these fields
- Files: `src/lib/auth.config.ts`, and 67+ downstream files (see rbac.ts, portal routes, admin routes)
- Impact: Removes type-checking for the most critical access-control properties; a typo in a role check silently compiles
- Fix approach: Extend NextAuth's `Session` and `JWT` types via declaration merging in `next-auth.d.ts` to include `role`, `kanzleiId`, and `kontaktId`

**In-memory rate limiter in Next.js serverless route:**
- Issue: `src/app/api/openclaw/process/route.ts` uses a module-level `Map<string, number[]>` as a sliding-window rate limiter
- Files: `src/app/api/openclaw/process/route.ts:18-59`
- Impact: In a Next.js deployment with multiple server instances (Vercel, Kubernetes), each instance has its own Map; the rate limit is per-process, not per-user globally. A user hitting two instances gets 2x the allowed quota
- Fix approach: Use the Redis-backed `checkRateLimit` pattern already implemented in `src/lib/helena/rate-limiter.ts`

**Health-alert cooldown is in-memory and non-persistent:**
- Issue: `src/lib/health/alerts.ts` uses a module-level `Map<string, number>` for the 60-minute alert cooldown; this state resets on every server restart
- Files: `src/lib/health/alerts.ts:12`
- Impact: After a crash-loop or deploy, every admin receives repeated health-alert emails for services that were already reported
- Fix approach: Move the cooldown timestamp into a Redis key with a 60-minute TTL (same pattern as helena rate limiter)

**`Benachrichtigungen` settings tab is a stub:**
- Issue: The notifications settings tab documents itself as "stub" and contains toggle logic that fires a settings-import API but no meaningful server-side behavior is wired
- Files: `src/components/einstellungen/benachrichtigungen-tab.tsx:19-20`
- Impact: Users who toggle the Frist notification setting see no change in behavior; the toggle is cosmetic
- Fix approach: Wire `benachrichtigungen_frist_aktiv` into the `processFristReminders` processor gating logic

**LanguageTool Docker service exists but is unwired:**
- Issue: The `languagetool` container is defined in `docker-compose.yml` under the `full` profile but there is no TypeScript client or integration point anywhere in `src/`
- Files: `docker-compose.yml:227-240`
- Impact: Grammar and spell-checking is not available in the editor or document generation pipeline despite the infrastructure being present; this is listed as a pending feature
- Fix approach: Create `src/lib/languagetool-client.ts` and integrate into the ONLYOFFICE editor or document compose flow

---

## Security Considerations


**Default credentials + dev secrets in docker-compose:**
- Risk: `docker-compose.yml` ships hard-coded default logins (Postgres, MinIO, Meilisearch, OnlyOffice, NextAuth secret) and the README documents `admin@kanzlei.de / password123` as the seed login
- Files: `docker-compose.yml`, `README.md`
- Impact: If the compose file is used unchanged in any non-local environment, it exposes the stack to trivial credential stuffing and session forgery
- Recommendations: Require an `.env` with overrides (no defaults) for all secrets; fail fast if `NEXTAUTH_SECRET` or admin seed password remain at dev defaults; add a startup check that refuses to boot in `NODE_ENV=production` with dev credentials


**ONLYOFFICE callback endpoint accepts unauthenticated requests when no JWT is present:**
- Risk: The callback handler at `POST /api/onlyoffice/callback` only validates the JWT when `Authorization` or `body.token` is present; if neither is sent, the endpoint proceeds without any auth check and will process any `dokumentId` passed in the query string
- Files: `src/app/api/onlyoffice/callback/route.ts:49-63`
- Current mitigation: ONLYOFFICE is on a private Docker network; the callback URL is only reachable within the stack
- Recommendations: Add a mandatory JWT check: if neither `Authorization` nor `body.token` is present, return `{ error: 1 }` immediately; do not fall through to document processing

**Fixed salt in email credential encryption:**
- Risk: `SALT = "ai-lawyer-email-cred-v1"` is a hard-coded, known string used as the scrypt salt for deriving the AES-256 key from `EMAIL_ENCRYPTION_KEY`
- Files: `src/lib/email/crypto.ts:14`
- Current mitigation: The master key itself must be 32+ characters; AES-256-GCM with a random IV per ciphertext is used correctly
- Recommendations: For stronger key derivation, use a random per-installation salt stored in an environment variable or a database record; the current approach is acceptable given server-side-only usage but is a known cryptographic shortcut

**ADMIN role sees data across all kanzleien without cross-tenant filter:**
- Risk: `buildAkteAccessFilter` returns an empty WHERE clause `{}` for ADMIN users; `User.kanzleiId` exists on the schema but is not used in most query filters
- Files: `src/lib/rbac.ts:265-268`, `src/app/api/akten/route.ts:35`
- Current mitigation: The app is currently single-tenant; there is only one Kanzlei record in production
- Recommendations: If multi-tenancy is planned, all admin-visible queries must be scoped to `kanzleiId`; flag all sites where `buildAkteAccessFilter` returns `{}` and add `where: { kanzleiId: session.user.kanzleiId }` constraints

**Portal route role check uses `as any` cast:**
- Risk: `(session.user as any).role !== "MANDANT"` in portal API routes means the role check is dynamically typed; a future session-shape change will compile silently
- Files: `src/app/api/portal/akten/[id]/route.ts:22`, and all other portal routes that repeat this pattern
- Current mitigation: The role is set by NextAuth at login and validated at credential authorization
- Recommendations: Fix session type declarations (see tech debt item above); once typed, role checks will fail at compile time if the property is renamed

---

## Performance Bottlenecks

**Large single-file worker (1,186 lines):**
- Problem: `src/worker.ts` registers all BullMQ workers, runs startup migrations, seeds data, and starts IMAP connections in one file; startup time is sequential
- Files: `src/worker.ts`
- Cause: No modularization of worker registration; each new feature adds more code to the same file
- Improvement path: Extract startup sequences into `src/workers/startup/` modules; allow parallel initialization where services are independent

**`ki-chat` route is 1,028 lines with 23 console.log calls:**
- Problem: The main streaming chat endpoint mixes RAG pipeline, Schriftsatz routing, conversation persistence, and prompt assembly in a single handler
- Files: `src/app/api/ki-chat/route.ts`
- Cause: All feature additions were appended to the same route handler over multiple milestones
- Improvement path: Extract into `src/lib/ki-chat/` sub-modules: `rag-pipeline.ts`, `schriftsatz-router.ts`, `conversation-store.ts`

**Portal messaging uses 10-second polling:**
- Problem: Portal chat (`/portal/akten/[id]/nachrichten`) polls the server every 10 seconds for new messages
- Files: Per-memory notes; Socket.IO is excluded from portal by design
- Cause: Architectural decision: Socket.IO is not available in the portal context
- Improvement path: Investigate Server-Sent Events (SSE) as a lower-overhead alternative to polling; SSE works without Socket.IO and avoids the repeated session + DB overhead of polling

**`dokumente-tab.tsx` is 1,190 lines with complex in-component state:**
- Problem: The Dokumente tab contains folder tree state, upload state, drag-and-drop, filter state, and document actions all in one component
- Files: `src/components/dokumente/dokumente-tab.tsx`
- Cause: Incremental feature additions without refactoring into sub-components
- Improvement path: Extract `DokumenteFolderTree`, `DokumenteFilterBar`, and `DokumenteList` as separate components; move server state to SWR hooks

**Multiple `console.log` calls in hot paths:**
- Problem: 187 `console.log/warn/error` calls are spread across the codebase including in the frequently-called OnlyOffice callback and ki-chat route
- Files: `src/app/api/onlyoffice/callback/route.ts` (15 occurrences), `src/app/api/ki-chat/route.ts` (23 occurrences)
- Cause: Debug logging added during development was not replaced with the `createLogger` structured logger
- Improvement path: Replace `console.log` calls in API routes with `createLogger("route-name")` calls; this enables log-level filtering in production

---

## Fragile Areas

**OnlyOffice version snapshot saves the NEW content as the version, not the OLD content:**
- Files: `src/app/api/onlyoffice/callback/route.ts:118-132`
- Why fragile: The comment at line 122 says "Save the new content as version snapshot too" — meaning the "previous version" snapshot actually contains the new content, not the content before the edit. Version history will show the same content for both the new and the "snapshot" entries
- Safe modification: Before downloading the new buffer, first fetch the existing file from MinIO at `dokument.dateipfad`, then upload that as the version snapshot
- Test coverage: No test covers the version snapshot logic

**SMTP transporter cache is never invalidated on credential change via UI:**
- Files: `src/lib/email/smtp/transport-factory.ts:34-36`
- Why fragile: `createSmtpTransport` returns a cached `Transporter` if the `kontoId` is found in the map; if an admin changes SMTP credentials through the settings UI, the stale cached transporter continues to be used until the worker process restarts
- Safe modification: The `invalidateTransport(kontoId)` helper exists but is not called by the email account update route; call it from `PUT /api/email-konten/[id]/route.ts` on credential updates
- Test coverage: No test covers cache invalidation

**Prisma `$extends` ENTWURF gate can be bypassed via `updateMany`:**
- Files: `src/lib/db.ts:24-46`
- Why fragile: The `$extends` hook overrides `dokument.update` but not `dokument.updateMany`; a bulk update that changes the status of AI-created documents would bypass the human-approval gate
- Safe modification: Add `updateMany` to the query extensions in `createExtendedPrisma`
- Test coverage: No test for `updateMany` bypass

**`eslint-disable react-hooks/exhaustive-deps` in multiple components:**
- Files: `src/components/search/search-page.tsx`, `src/components/email/email-list.tsx`, `src/components/email/email-filters.tsx`, `src/components/bea/bea-inbox.tsx`, `src/components/gamification/xp-progress-bar.tsx`, `src/components/ui/glass-kpi-card.tsx`
- Why fragile: Intentionally missing dependency array entries mean these effects may not re-run when data changes, or may cause stale closure bugs; each suppression masks a potential bug
- Safe modification: Audit each suppression; for stale data cases, replace with `useRef` for mutable values or restructure the effect

**Worker startup schema migrations are not idempotent if concurrent:**
- Files: `src/worker.ts:960-980`
- Why fragile: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is idempotent individually, but two worker instances starting simultaneously both try to create the HNSW index; one will fail with a "relation already exists" error and log it as a warning; the `catch` suppresses the error
- Safe modification: Move migrations to Prisma schema; the current approach works only because the warning is non-fatal

---

## Test Coverage Gaps

**API route handlers have zero test coverage:**
- What's not tested: All ~170 Next.js API route handlers under `src/app/api/` have no unit or integration tests
- Files: Entire `src/app/api/` directory
- Risk: RBAC bypasses, validation gaps, Prisma query errors, and edge-case status codes go undetected until production
- Priority: High — particularly the portal routes where data isolation is critical

**Portal data isolation (`requireMandantAkteAccess`) is not tested:**
- What's not tested: The `src/lib/portal-access.ts` access guard that prevents one Mandant from seeing another Mandant's Akte data
- Files: `src/lib/portal-access.ts`, `src/app/api/portal/akten/[id]/route.ts`
- Risk: A regression in the Kontakt→Beteiligter chain lookup could expose one client's data to another
- Priority: High

**SMTP transport cache invalidation is not tested:**
- What's not tested: Whether changing SMTP credentials via the API actually causes the next email to use the new credentials
- Files: `src/lib/email/smtp/transport-factory.ts`, `src/app/api/email-konten/[id]/route.ts`
- Risk: Credential changes appear successful but emails continue to use stale credentials until restart
- Priority: Medium

**Prisma `$extends` ENTWURF gate is partially tested:**
- What's not tested: The `updateMany` pathway and the race condition where `freigegebenDurchId` is set in the same update that changes status
- Files: `src/lib/db.ts`
- Risk: AI-generated documents could bypass human review
- Priority: High — BRAO §43a compliance

**OnlyOffice callback version snapshot logic is not tested:**
- What's not tested: The Status 2 callback flow including version creation, MinIO upload ordering, and Meilisearch re-index
- Files: `src/app/api/onlyoffice/callback/route.ts`
- Risk: The version snapshot bug (saving new content instead of old) persists undetected
- Priority: Medium

---

## Missing Critical Features

**LanguageTool spell/grammar checking:**
- Problem: The Docker service is provisioned and documented as a pending feature but no client code exists
- Blocks: Quality assurance for Schriftsatz generation; lawyers currently receive AI-generated drafts with no spell-check gate

**BI Dashboard / CSV/XLSX export:**
- Problem: Referenced in project memory as a pending feature; only PDF and CSV export exist for the admin team dashboard; no generic data export for Akten, Rechnungen, or Zeiterfassung as XLSX
- Blocks: Controlling workflows that need data in Excel format

**User-level notification preferences:**
- Problem: The `BenachrichtigungenTab` is a stub; notification preferences are not actually persisted or respected per-user
- Blocks: Users cannot configure which events generate email notifications

---

## Dependencies at Risk

**`@ts-expect-error` in `src/components/ui/button.tsx:59`:**
- Risk: Framer Motion v11 + React 19 type mismatch is suppressed; this is a known upstream incompatibility
- Impact: If Framer Motion releases a React 19-compatible type update, this suppression should be removed; if not updated, button animations may break silently
- Migration plan: Monitor `framer-motion` releases for React 19 types; remove suppression once types are compatible

---

*Concerns audit: 2026-03-04*
