# Codebase Concerns

**Analysis Date:** 2026-02-24

## Tech Debt

**Hardcoded Email Address:**
- Issue: Email composition uses hardcoded sender address instead of system/user configuration
- Files: `src/components/email/email-compose-view.tsx:142`
- Impact: Multi-tenant support broken; all emails appear from single fixed address
- Fix approach: Load sender email from user profile or kanzlei settings via session or API call

**Large Component Files (Over 500 lines):**
- Issue: Multiple components exceed recommended size, making testing and maintenance difficult
- Files:
  - `src/components/dokumente/dokumente-tab.tsx` (1007 lines)
  - `src/components/akten/akte-detail-tabs.tsx` (725 lines)
  - `src/app/(dashboard)/kontakte/[id]/page.tsx` (601 lines)
  - `src/components/kalender/kalender-eintrag-dialog.tsx` (593 lines)
  - `src/components/vorlagen/vorlagen-verwaltung.tsx` (584 lines)
  - `src/components/kalender/kalender-liste.tsx` (554 lines)
- Impact: Difficulty isolating bugs, refactoring, and testing individual features
- Fix approach: Break into smaller sub-components with single responsibility; extract state management into custom hooks

**Unstructured Error Logging:**
- Issue: Debug console.log statements left in production code without log level control
- Files:
  - `src/components/editor/onlyoffice-editor.tsx:90,95` (console.log)
  - `src/app/api/onlyoffice/config/[dokumentId]/route.ts:44` (console.log)
  - `src/app/api/onlyoffice/callback/route.ts:77,124` (console.log)
  - `src/app/api/onlyoffice/download/[dokumentId]/route.ts:28` (console.log)
- Impact: Verbose logs in production; inconsistent error reporting; security risk (path/config exposure)
- Fix approach: Implement structured logging library (winston/pino); use log levels (debug, info, warn, error); strip debug logs from production build

## Known Bugs

**OnlyOffice Callback Error Handling Issue:**
- Symptoms: Non-blocking indexDokument error silently fails with `.catch(() => {})`; user doesn't know search index wasn't updated
- Files: `src/app/api/onlyoffice/callback/route.ts:122`
- Trigger: If Meilisearch unavailable or network failure during document save from OnlyOffice
- Workaround: Manual document reindex via admin API (`/api/dokumente/reindex`)
- Fix approach: Log silent catch; consider retry queue for failed indexing; notify user if indexing fails

## Security Considerations

**Missing User Session Validation in OnlyOffice Endpoints:**
- Risk: OnlyOffice download endpoint doesn't validate user is authenticated; only JWT from ONLYOFFICE is verified
- Files: `src/app/api/onlyoffice/download/[dokumentId]/route.ts:12-27`
- Current mitigation: JWT token from ONLYOFFICE verifies request originates from ONLYOFFICE server; however, no user-level access control
- Recommendations:
  - Validate user making the request (even though OnlyOffice calls it)
  - Add document-level access control: check if user has access to the akte before serving document
  - Log all document downloads for audit purposes

**Incomplete Role-Based Access Control (RBAC):**
- Risk: Only 5 API endpoints check user role; most endpoints only check authentication status, not authorization
- Files:
  - `src/app/api/kontakte/felder/route.ts` (ADMIN-only)
  - `src/app/api/akten/route.ts` (partial role check)
  - `src/app/api/dokumente/reindex/route.ts` (ADMIN-only)
  - `src/app/api/dokumente/[id]/route.ts` (partial role check)
  - `src/app/api/users/route.ts` (ADMIN-only)
- Current mitigation: Middleware doesn't enforce roles; frontend hides buttons based on role
- Recommendations:
  - Create middleware function `requireRole(role: UserRole)` for all endpoints
  - Check authorization on every POST/PUT/DELETE operation
  - Test PRAKTIKANT cannot modify ANWALT-only data
  - Implement document ownership checks (user can only access/modify documents in akten they're assigned to)

**Type Casting Bypass:**
- Risk: `session.user as any` pattern used to access role property bypasses TypeScript validation
- Files:
  - `src/lib/auth.ts:58,66`
  - `src/app/api/kontakte/felder/route.ts`
  - `src/app/api/akten/route.ts`
  - `src/app/api/dokumente/reindex/route.ts`
  - `src/app/api/dokumente/[id]/route.ts`
- Impact: Typos in property names go undetected; refactoring role field names silently breaks endpoints
- Fix approach: Extend NextAuth.js Session types properly in `src/types/next-auth.d.ts`; remove all `as any` casts

**No Rate Limiting:**
- Risk: API endpoints have no rate limiting; bulk contact import, document uploads, or search queries can be abused
- Files: All API routes in `src/app/api/`
- Current mitigation: None detected
- Recommendations: Implement rate limiting middleware (IP-based or user-based); limit file uploads by size; throttle search queries

## Performance Bottlenecks

**N+1 Query Risk in Contact Import:**
- Problem: CSV import creates contacts one-by-one in a loop without batch operations
- Files: `src/lib/kontakte/csv-import.ts` (likely pattern)
- Cause: Individual `prisma.kontakt.create()` calls for each row instead of `createMany()`
- Improvement path: Use `prisma.kontakt.createMany({ data: [...] })` for bulk import; measure with timing logs

**Meilisearch Indexing Not Blocking:**
- Problem: Document indexing happens in background (`.catch(() => {})`) after every save
- Files:
  - `src/app/api/onlyoffice/callback/route.ts:107-122`
  - `src/app/api/akten/[id]/dokumente/aus-vorlage/route.ts:177-190`
- Cause: Indexing is fire-and-forget without retry or validation
- Impact: Search results may be stale; failed indexes not reported
- Improvement path: Add background job queue (Bull/RabbitMQ); return indexed=false if indexing fails; add retry logic

**Large Database Queries Without Pagination Limits:**
- Problem: Some queries don't enforce take/skip limits properly
- Files: `src/app/api/openclaw/tasks/route.ts:41-56` (queries all tickets then filters in-app)
- Cause: Array prefix matching on tags not natively supported in Prisma; workaround fetches all records
- Impact: With 10k+ tickets, fetching all then filtering in-app is O(n) memory waste
- Improvement path: Use raw SQL with PostgreSQL `array_to_string(tags, ',') LIKE 'ai:%'` for prefix matching

## Fragile Areas

**OnlyOffice Integration Complexity:**
- Files:
  - `src/components/editor/onlyoffice-editor.tsx`
  - `src/app/api/onlyoffice/config/[dokumentId]/route.ts`
  - `src/app/api/onlyoffice/callback/route.ts`
  - `src/app/api/onlyoffice/download/[dokumentId]/route.ts`
  - `src/lib/onlyoffice.ts`
- Why fragile: Multiple moving parts (config generation, JWT verification, URL rewriting, callback handling, document sync); JWT disabled mode requires careful env var coordination
- Safe modification:
  - Add comprehensive integration tests for all JWT on/off scenarios
  - Separate concerns: move URL rewriting to dedicated utility with tests
  - Add structured logging to trace request flow through download → editing → callback
  - Document the exact Docker environment variables needed (currently in memory only)
- Test coverage: Callback endpoint has no tests; missing scenarios: network failure during download, malformed JWT, concurrent saves

**Template Placeholder Resolution:**
- Files: `src/lib/vorlagen.ts`, `src/app/api/akten/[id]/dokumente/aus-vorlage/route.ts:112-128`
- Why fragile: Placeholder resolution logic tightly coupled to specific schema; adding new placeholder types requires code changes
- Safe modification: Switch to configuration-driven placeholder mapping; validate all placeholders resolved before returning to user
- Test coverage: Unknown if all placeholder types are tested; missing test: what happens if kontakt has null fields

**Database Migration Lock:**
- Files: `prisma/migrations/` (only 1 migration: 20260223124855_init)
- Why fragile: All schema changes are in single mega-migration; no way to roll back specific changes
- Safe modification: Lock dev environment; write new migration for any schema change; test migration both up and down
- Test coverage: No migration tests detected

## Scaling Limits

**Meilisearch Full-Text Search Not Implemented:**
- Current capacity: Placeholder implementation that doesn't actually search documents
- Limit: No OCR text indexing, no full-text query support, no pagination in search results
- Files: `src/lib/meilisearch.ts`, `src/app/api/dokumente/search/route.ts`
- Scaling path: Implement actual Meilisearch integration; add OCR pipeline for PDF documents; benchmark search performance with 100k+ documents

**MinIO Storage Path Structure:**
- Current capacity: Files stored flat in `akten/{akteId}/dokumente/{timestamp}_{filename}` (or `vorlagen/{...}`)
- Limit: Path structure doesn't account for multi-tenant deployments; all files share same MinIO bucket
- Scaling path: Add tenant/kanzlei ID to path: `kanzlei/{kanzleiId}/akten/{akteId}/dokumente/...`

**JWT Token in Environment Variable:**
- Files: `.env` (ONLYOFFICE_SECRET env var)
- Risk: Sharing single JWT secret across all documents; secret rotation not possible without downtime
- Scaling path: Implement per-document JWT or short-lived tokens; add secret rotation mechanism

## Dependencies at Risk

**NextAuth.js v5 Beta:**
- Risk: Using beta version (`next-auth@5.0.0-beta.25`); API may change before stable release
- Impact: Breaking changes when upgrading to v5.0.0 stable release
- Migration plan: Pin to exact version; test upgrade path; have rollback plan for v4.x.x if needed

**Prisma ORM Decimal Type for Finance:**
- Risk: Using `@db.Decimal` for monetary amounts; Decimal arithmetic in JavaScript is error-prone without proper libraries
- Impact: Rounding errors in invoice/billing calculations; financial data corruption
- Migration plan: Consider Decimal.js library; add tests for all financial calculations; validate invoice totals

## Missing Critical Features

**No Audit Trail for Data Changes:**
- Problem: Only limited audit logging in `logAuditEvent()` calls; no comprehensive change tracking on kontakte, beteiligte, or financial records
- Blocks: Cannot answer "who changed this field and when"; critical for legal compliance
- Files: `src/lib/audit.ts` (limited implementation)

**No Document Version Control:**
- Problem: Documents are overwritten in place when edited via OnlyOffice; no history of previous versions
- Blocks: Cannot recover old document versions; cannot track document evolution
- Fix path: Keep version number in database; archive old versions to versioned paths in MinIO

**No Conflict Detection/Lock Mechanism:**
- Problem: Multiple users can edit same document simultaneously; last save wins
- Blocks: Legal firms need concurrent edit prevention or conflict resolution
- Files: `src/app/api/onlyoffice/callback/route.ts` (no locking logic)

**No Backup/Export Mechanism:**
- Problem: No data export for compliance/GDPR; no disaster recovery tested
- Blocks: Cannot provide user data export on request; no migration path to other systems
- Fix path: Add database export endpoint; add document bulk download; test restore from backup

## Test Coverage Gaps

**OnlyOffice Callback Handler:**
- What's not tested: Callback status codes (0-7); JWT verification scenarios; concurrent saves; network failures during document download
- Files: `src/app/api/onlyoffice/callback/route.ts`
- Risk: Core document save functionality untested; critical for app reliability
- Priority: High

**Kontakte Import (CSV/vCard):**
- What's not tested: Edge cases (empty files, duplicate emails, invalid character encoding); large file performance
- Files: `src/lib/kontakte/csv-import.ts`, `src/lib/kontakte/vcard-import.ts`
- Risk: User imports corrupted by parsing failures; no error recovery
- Priority: High

**Template Placeholder Resolution:**
- What's not tested: All placeholder types (kontakt fields, akte fields, kanzlei info); null/missing field handling; special characters in values
- Files: `src/lib/vorlagen.ts`, `src/app/api/akten/[id]/dokumente/aus-vorlage/route.ts`
- Risk: Generated documents have wrong data or template errors; user trust loss
- Priority: High

**API Error Responses:**
- What's not tested: Error message consistency; HTTP status code correctness (400 vs 500); error serialization
- Files: All `src/app/api/**/*.ts`
- Risk: Frontend cannot reliably parse errors; inconsistent user experience
- Priority: Medium

**Validation Schema Consistency:**
- What's not tested: Request body validation in all endpoints; zod schema coverage matches database constraints
- Files: `src/app/api/**/route.ts` (each defines own schema)
- Risk: Invalid data reaches database; constraint violations; data corruption
- Priority: Medium

---

*Concerns audit: 2026-02-24*
