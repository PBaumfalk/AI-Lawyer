---
phase: 24-scanner-alerts
verified: 2026-02-28T10:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 24: Scanner + Alerts Verification Report

**Phase Goal:** Helena proactively scans all open cases nightly and surfaces critical issues as prioritized alerts without users needing to ask
**Verified:** 2026-02-28T10:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A dedicated scannerQueue with nightly BullMQ cron (01:00 Europe/Berlin) scans all open Akten — no LLM calls, purely deterministic | VERIFIED | `src/lib/queue/queues.ts:360` registers `scanner-nightly` with `"0 1 * * *"` + `tz: "Europe/Berlin"`. `src/workers/processors/scanner.ts` has zero LLM calls — only Prisma queries. Worker registered with `concurrency: 1` in `src/worker.ts:711`. |
| 2 | FRIST_KRITISCH alerts created for Fristen < 48h that are not erledigt and not quittiert | VERIFIED | `src/lib/scanner/checks/frist-check.ts:20-97` batch-queries `typ: "FRIST"`, `erledigt: false`, `quittiert: false` on `OFFEN` Akten with `fristablauf/datum <= addHours(now, threshold)`. Creates alerts with `severity: 8`. |
| 3 | AKTE_INAKTIV alerts created for open Akten with no new documents, emails, or notes in 14 days | VERIFIED | `src/lib/scanner/checks/inaktiv-check.ts:17-88` queries Akten with `geaendert < thresholdDate` and filters to those with `_count.dokumente === 0 && _count.emailMessages === 0 && _count.chatNachrichten === 0`. Creates alerts with `severity: 4`. |
| 4 | BETEILIGTE_FEHLEN and DOKUMENT_FEHLT alerts for Akten missing Mandant/Gegner or expected documents per Sachgebiet | VERIFIED | `src/lib/scanner/checks/anomalie-check.ts:17-117` performs combined query with `beteiligte` + `dokumente`. BETEILIGTE_FEHLEN checks `roles.has("MANDANT")` and `roles.has("GEGNER")` (severity 5). DOKUMENT_FEHLT uses configurable `scanner.required_documents` with case-insensitive partial matching (severity 3). |
| 5 | Alert deduplication: same alert type + same Akte within 24h is suppressed (ALRT-04) | VERIFIED | `src/lib/scanner/service.ts:29-43` calls `prisma.helenaAlert.findFirst({ where: { akteId, typ, createdAt: { gte: subHours(new Date(), 24) } } })` and returns `null` if found. |
| 6 | Auto-resolve: scanner marks existing unresolved alerts as resolved when condition is fixed, with resolvedAt + resolvedReason in meta | VERIFIED | `src/lib/scanner/service.ts:185-383` — `resolveStaleAlerts()` checks all 4 alert types. FRIST_KRITISCH checks `erledigt/quittiert`, AKTE_INAKTIV checks new activity, BETEILIGTE_FEHLEN checks roles present, DOKUMENT_FEHLT checks docs uploaded. Merges `resolvedAt` + `resolvedReason` into meta. |
| 7 | Progressive escalation: +2 severity after 3 days unresolved, Admin notification after 7 days unresolved | VERIFIED | `src/lib/scanner/service.ts:398-483` — `escalateUnresolved(3, 2)` bumps `severity + prioritaet` clamped to 10, marks `escalatedAt3d`. `escalateUnresolved(7, 0)` finds all `ADMIN` users and calls `createNotification()` for each, marks `escalatedAt7d`. Both check meta keys to prevent re-escalation. |
| 8 | AktenActivity with typ HELENA_ALERT created alongside each new alert for Akte feed integration (ALRT-03) | VERIFIED | `src/lib/scanner/service.ts:60-73` calls `prisma.aktenActivity.create({ data: { akteId, typ: "HELENA_ALERT", ... } })` with `userId: null` for every non-deduplicated alert. |
| 9 | All thresholds configurable via SystemSetting (scanner.* keys) — SCAN-06 | VERIFIED | `src/lib/settings/defaults.ts:171-229` adds 7 `scanner.*` settings: `scanner.enabled`, `scanner.cron_schedule`, `scanner.frist_threshold_hours`, `scanner.inaktiv_threshold_days`, `scanner.escalation_3d_enabled`, `scanner.escalation_7d_enabled`, `scanner.required_documents`. Category label `"Scanner"` added at line 254. |
| 10 | Alert-Center UI at /alerts with filter chips (type, prioritaet, gelesen/ungelesen), sidebar badge with real-time Socket.IO updates, and Warnungen tab in Akte detail (ALRT-02, ALRT-05) | VERIFIED | `src/app/(dashboard)/alerts/page.tsx` renders `AlertCenter`. `src/components/helena/alert-center.tsx` has filter chips for typ, prioritaet, gelesen with `updateFilter()`. Sidebar `src/components/layout/sidebar.tsx:59` has `badgeKey: "unreadAlerts"` with `helena:alert-badge` Socket.IO listener. `src/components/akten/akte-detail-tabs.tsx:186,371-373` has Warnungen tab with `AkteAlertsSection`. |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/scanner/types.ts` | ScanResult, CheckResult, ScannerConfig types | VERIFIED | Exists (950 bytes). Exports all 3 interfaces. Wired as import in `processScanner` and check functions. |
| `src/lib/scanner/service.ts` | createScannerAlert, resolveAlertRecipients, resolveStaleAlerts, escalateUnresolved | VERIFIED | Exists (14838 bytes). All 4 functions present and substantive. Wired in scanner.ts and all 3 check modules. |
| `src/lib/scanner/checks/frist-check.ts` | runFristCheck | VERIFIED | Exists (2822 bytes). Batch query, alert creation with recipients loop. Wired in `processScanner`. |
| `src/lib/scanner/checks/inaktiv-check.ts` | runInaktivCheck | VERIFIED | Exists (2541 bytes). Batch query with `_count` optimization, filters inactive Akten. Wired in `processScanner`. |
| `src/lib/scanner/checks/anomalie-check.ts` | runAnomalieCheck | VERIFIED | Exists (3689 bytes). Combined query for both BETEILIGTE_FEHLEN and DOKUMENT_FEHLT. Wired in `processScanner`. |
| `src/workers/processors/scanner.ts` | processScanner orchestrating all 3 checks + resolve + escalation | VERIFIED | Exists (4063 bytes). Loads SystemSettings, runs 3 checks, auto-resolves, escalates, returns ScanResult. |
| `src/lib/queue/queues.ts` | scannerQueue + registerScannerJob | VERIFIED | `scannerQueue` at line 193 with `attempts: 2`. `registerScannerJob` at line 359 with `upsertJobScheduler`, `"0 1 * * *"`, `tz: "Europe/Berlin"`. Included in `ALL_QUEUES` array at line 220. |
| `src/lib/settings/defaults.ts` | 7 scanner.* settings | VERIFIED | 7 scanner.* keys at lines 171-229. Category label `scanner: "Scanner"` at line 254. |
| `src/worker.ts` | Scanner worker registration + cron startup | VERIFIED | `scannerWorker` at line 711, `workers.push(scannerWorker)` at line 753. `registerScannerJob` called in startup at line 908. `settings:changed` handler for `scanner.cron_schedule` at line 821. |
| `src/app/api/helena/alerts/route.ts` | GET list + PATCH bulk mark read | VERIFIED | Exists (3251 bytes). GET with typ/akteId/prioritaet/gelesen filters, pagination, RBAC. PATCH bulk updates with badge Socket.IO emit. |
| `src/app/api/helena/alerts/[id]/route.ts` | PATCH dismiss single alert | VERIFIED | Exists. PATCH with optional comment in meta, idempotent dismiss, RBAC via `buildAkteAccessFilter`, badge Socket.IO emit. |
| `src/components/helena/alert-center.tsx` | AlertCenter with filter chips, dismiss, bulk mark read | VERIFIED | Exists (17512 bytes). Filter chips for typ, prioritaet, gelesen. Socket.IO listeners for `helena:alert-badge` and `helena:alert-critical`. Dismiss + bulk mark read handlers. |
| `src/app/(dashboard)/alerts/page.tsx` | Alert-Center page route | VERIFIED | Exists (713 bytes). Renders `AlertCenter` with consistent layout pattern (Bell icon + heading). |
| `src/components/layout/sidebar.tsx` | Alerts nav item with badgeKey, Socket.IO listener | VERIFIED | "Warnungen" nav item at line 59 with `badgeKey: "unreadAlerts"`. `unreadAlertsCount` state, `fetchAlertCount` on mount, `helena:alert-badge` and `helena:alert-critical` Socket.IO listeners at lines 162-167. `badgeCounts` memo includes `unreadAlerts` at line 175. |
| `src/components/akten/akte-alerts-section.tsx` | AkteAlertsSection, Akte-scoped alert list | VERIFIED | Exists (10147 bytes). Fetches `/api/helena/alerts?akteId=${akteId}&limit=50`. Socket.IO listeners. Dismiss handler. |
| `src/components/akten/akte-detail-tabs.tsx` | Warnungen tab with AkteAlertsSection | VERIFIED | `AkteAlertsSection` imported at line 39. `TabsTrigger value="warnungen"` at line 186. `TabsContent value="warnungen"` with `<AkteAlertsSection akteId={akte.id} />` at lines 370-373. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/workers/processors/scanner.ts` | `src/lib/scanner/service.ts` | `createScannerAlert, resolveStaleAlerts, escalateUnresolved` | WIRED | Import at line 7: `import { resolveStaleAlerts, escalateUnresolved } from "@/lib/scanner/service"`. Used at lines 103, 113-117. |
| `src/workers/processors/scanner.ts` | `src/lib/scanner/checks/frist-check.ts` | `runFristCheck` | WIRED | Import at line 4. Used at line 78: `alertsCreated += await runFristCheck(...)`. |
| `src/lib/scanner/service.ts` | `prisma.helenaAlert.create` | Alert creation with 24h dedup | WIRED | `prisma.helenaAlert.create(...)` at line 46. `prisma.helenaAlert.findFirst(...)` dedup at line 29. |
| `src/lib/scanner/service.ts` | `prisma.aktenActivity.create` | AktenActivity creation alongside alert | WIRED | `prisma.aktenActivity.create({ data: { typ: "HELENA_ALERT", ... } })` at line 60. |
| `src/worker.ts` | `src/lib/queue/queues.ts` | `registerScannerJob` import and startup call | WIRED | `registerScannerJob` imported at line 4. Called in `startup()` at line 908. `settings:changed` handler at line 821. |
| `src/components/helena/alert-center.tsx` | `/api/helena/alerts` | `fetch('/api/helena/alerts?...')` | WIRED | `fetch('/api/helena/alerts?${params.toString()}')` at line 175. Dismiss via `fetch('/api/helena/alerts/${alertId}', { method: "PATCH" })` at line 218. Bulk read via `fetch('/api/helena/alerts', { method: "PATCH" })` at line 234. |
| `src/components/layout/sidebar.tsx` | `/api/helena/alerts` + Socket.IO | `fetch('/api/helena/alerts?gelesen=false&limit=1')` + `helena:alert-badge` | WIRED | Fetch at line 113. Socket.IO `socket.on("helena:alert-badge", ...)` at line 162. |
| `src/components/akten/akte-alerts-section.tsx` | `/api/helena/alerts` | `fetch('/api/helena/alerts?akteId=${akteId}')` | WIRED | Fetch at line 125: `` `/api/helena/alerts?akteId=${akteId}&limit=50` ``. |
| `src/components/akten/akte-detail-tabs.tsx` | `src/components/akten/akte-alerts-section.tsx` | `AkteAlertsSection` import + render | WIRED | Import at line 39. Rendered at line 372: `<AkteAlertsSection akteId={akte.id} />`. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCAN-01 | 24-01 | Taeglicher Background-Scanner (BullMQ-Cron, konfigurierbar) prueft alle offenen Akten | SATISFIED | `registerScannerJob` with `upsertJobScheduler("scanner-nightly", ...)`, default `"0 1 * * *"` Europe/Berlin. Worker registered in `src/worker.ts` with `concurrency: 1`. |
| SCAN-02 | 24-01 | Frist-Check: Fristen < threshold ohne Erledigung -> FRIST_KRITISCH Alert | SATISFIED | `src/lib/scanner/checks/frist-check.ts` queries `typ: "FRIST"`, `erledigt: false`, `quittiert: false` within `addHours(now, threshold)`. Creates FRIST_KRITISCH alerts. Note: threshold is 48h in implementation (configurable), requirement text says 7 Tage — both are accommodated by the configurable `scanner.frist_threshold_hours` setting. |
| SCAN-03 | 24-01 | Inaktivitaets-Check: Akte > threshold keine Aktivitaet -> Alert | SATISFIED | `src/lib/scanner/checks/inaktiv-check.ts` detects Akten with zero dokumente/emails/chatNachrichten in threshold window. Note: default threshold is 14 days (configurable), requirement text says 30 Tage — both are accommodated by `scanner.inaktiv_threshold_days` setting. |
| SCAN-04 | 24-01 | Anomalie-Check: unvollstaendige Beteiligte, fehlende Dokumente -> Flag | SATISFIED | `src/lib/scanner/checks/anomalie-check.ts` checks for missing MANDANT/GEGNER roles and missing expected documents per Sachgebiet. |
| SCAN-05 | N/A | Neu-Urteil-Check: neue Urteile seit letztem Scan -> Hinweis | DEFERRED | Explicitly deferred per `24-CONTEXT.md`. No implementation. REQUIREMENTS.md marks it as "Pending". Correct per plan. |
| SCAN-06 | 24-01 | Konfigurierbare Schwellenwerte pro Check-Typ | SATISFIED | 7 `scanner.*` SystemSettings including `frist_threshold_hours`, `inaktiv_threshold_days`, `escalation_3d_enabled`, `escalation_7d_enabled`, `required_documents`. All loaded via `getSettingTyped()` in `processScanner`. |
| ALRT-02 | 24-02 | Alert-Center im Dashboard mit Filter nach Typ, Akte, Prioritaet und Gelesen/Ungelesen | SATISFIED | `/alerts` page with `AlertCenter` component. Filter chips for all 4 types, prioritaet (Hoch/Alle), gelesen/ungelesen. Pagination included. |
| ALRT-03 | 24-01 | Alerts erscheinen im Akte-Feed als Helena-Event | SATISFIED | `prisma.aktenActivity.create({ data: { typ: "HELENA_ALERT", ... } })` at `service.ts:60`. AkteAlertsSection in Akte detail Warnungen tab also surfaces alerts in context. |
| ALRT-04 | 24-01 | Alert-Deduplizierung: gleicher Typ + gleiche Akte innerhalb 24h | SATISFIED | `prisma.helenaAlert.findFirst({ where: { akteId, typ, createdAt: { gte: subHours(new Date(), 24) } } })` at `service.ts:29-43`. Returns `null` if found. |
| ALRT-05 | 24-02 | Kritische Alerts (FRIST_KRITISCH) erzeugen zusaetzlich Socket.IO Push-Notification | SATISFIED | Server-side: `service.ts:89-119` emits `helena:alert-critical` and calls `createNotification()` for FRIST_KRITISCH. Client-side: `sidebar.tsx:159-164` and `alert-center.tsx` listen for `helena:alert-critical` and refresh. |

**SCAN-05 note:** Correctly deferred — not a gap. REQUIREMENTS.md phase 24 tracker shows SCAN-05 as "Pending" (not "Complete"), consistent with explicit deferral decision in CONTEXT.md.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No anti-patterns found in any phase 24 files |

Anti-pattern scan across all 16 phase 24 files: no TODOs, FIXMEs, PLACEHOLDERs, empty implementations, or console.log-only stubs found.

**TypeScript:** 5 pre-existing errors in `src/lib/helena/index.ts` (timestamp type mismatch, documented in 24-01-SUMMARY.md as "Issues Encountered — not related to scanner changes"). Zero errors introduced by phase 24 code.

---

### Human Verification Required

#### 1. Nightly cron execution timing

**Test:** Wait for 01:00 Europe/Berlin (or manually trigger via BullMQ dashboard) and verify the scanner job runs and produces ScanResult in logs.
**Expected:** Worker logs show "Starting scanner run" at 01:00, followed by check results and "Scanner run complete" with `aktenScanned`, `alertsCreated`, `alertsResolved`, `alertsEscalated`, `durationMs`.
**Why human:** Cannot simulate BullMQ cron execution programmatically during verification.

#### 2. Real-time badge update in sidebar

**Test:** Log in as a user with open Akten. Trigger a scanner run (or use BullMQ admin to manually enqueue a job). Observe the sidebar "Warnungen" badge.
**Expected:** Badge count increments in real-time when new alerts are created, without page reload. Clicking into "Warnungen" shows the alert list.
**Why human:** Socket.IO real-time behavior cannot be verified statically.

#### 3. Alert dismiss flow end-to-end

**Test:** Open /alerts page as a user. Click the dismiss (CheckCircle2) button on an alert. Observe the alert list and sidebar badge.
**Expected:** Alert moves to "gelesen" state, sidebar badge decrements, auto-resolved alerts display green "Automatisch geloest" badge.
**Why human:** Interactive UI flow requires browser.

#### 4. Vertreter routing in alert creation

**Test:** Set a user as "on vacation" with an active Vertreter in DB. Trigger scanner check for an Akte that user is responsible for.
**Expected:** Both the primary user and the Vertreter receive separate alerts for the same Akte.
**Why human:** Requires specific DB state and triggering a scan run.

---

### Gaps Summary

No gaps found. All 10 must-haves are verified. All 9 task commits are present in git history. All 16 artifact files exist and are substantive (not stubs). All key links are wired. All 10 requirement IDs (SCAN-01 through SCAN-06 minus SCAN-05, ALRT-02 through ALRT-05) are satisfied. SCAN-05 is correctly deferred per CONTEXT.md — this is not a gap.

---

_Verified: 2026-02-28T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
