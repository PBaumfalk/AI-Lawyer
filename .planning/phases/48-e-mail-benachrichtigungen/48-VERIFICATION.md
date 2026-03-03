---
phase: 48-e-mail-benachrichtigungen
verified: 2026-03-03T13:40:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 48: E-Mail-Benachrichtigungen Verification Report

**Phase Goal:** E-Mail notifications for Mandantenportal — BullMQ queue, DSGVO consent gate, deduplication, HTML templates with Kanzlei branding, three triggers (neue Nachricht, Dokument freigegeben, Sachstand-Update)
**Verified:** 2026-03-03T13:40:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Portal notification queue accepts jobs with event type, mandant email, akte id, and deep-link path | VERIFIED | `PortalNotificationJobData` interface with `type`, `mandantKontaktId`, `akteId`, `deepLinkPath` in `portal-notification.ts:23-31` |
| 2 | Email templates produce DSGVO-safe HTML+text emails with Kanzlei branding, deep-link, and no case details | VERIFIED | `renderPortalEmail()` in `email-templates.ts` returns `{subject, text, html}` for all 3 types; no case-specific data; kanzleiName in header/footer; CTA deep-link |
| 3 | DSGVO einwilligungEmail gate prevents email to Mandant who has not consented | VERIFIED | `processPortalNotification()` at line 89 explicitly checks `kontakt.einwilligungEmail` and returns early if false |
| 4 | Notification processor sends email via existing sendEmail() and logs via audit | VERIFIED | `sendEmail()` called at `portal-notification.ts:134`; `logAuditEvent()` with `PORTAL_EMAIL_GESENDET` at line 156 |
| 5 | BullMQ worker processes portal-notification jobs with retry and deduplication | VERIFIED | `portalNotificationQueue` with `attempts: 3` in `queues.ts:238-246`; worker at `worker.ts:833-860`; date-based jobId deduplication at `portal-notification.ts:44` |
| 6 | Mandant receives email when Anwalt sends a message in PORTAL channel (MSG-04) | VERIFIED | `message-service.ts:140-154` — guards on `channel.typ === "PORTAL"` and `author.role !== "MANDANT"`, then calls `triggerPortalNotificationForAkte(..., "neue-nachricht", ...)` |
| 7 | Mandant receives email when a document is set to mandantSichtbar=true (MSG-05) | VERIFIED | `mandant-sichtbar/route.ts:82-86` — calls `triggerPortalNotificationForAkte(akteId, "neues-dokument", ...)` when `body.mandantSichtbar === true` |
| 8 | Mandant receives email when a mandantSichtbar AktenActivity is created, excluding document events to avoid double-notification (MSG-06) | VERIFIED | `naechste-schritte/route.ts:55-59` — calls `triggerPortalNotificationForAkte(akteId, "sachstand-update", ...)` after creating `STATUS_CHANGE` activity (non-document type) |
| 9 | Trigger failures never block the originating action (fire-and-forget pattern) | VERIFIED | All three trigger call sites append `.catch(() => {})` and `triggerPortalNotificationForAkte()` has a top-level `try/catch` that logs and never rethrows |

**Score:** 9/9 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/portal/email-templates.ts` | HTML+text email template functions for 3 notification types | VERIFIED | 160 lines; exports `renderPortalEmail`, `PortalEmailType`, `PortalEmailInput`, `PortalEmailOutput`; all 3 types covered in `EMAIL_CONTENT` map |
| `src/lib/portal/portal-notification.ts` | Queue job dispatch + processor function | VERIFIED | 165 lines; exports `enqueuePortalNotification`, `processPortalNotification`, `PortalNotificationJobData`; full 9-step processor pipeline |
| `src/lib/queue/queues.ts` | portalNotificationQueue BullMQ queue definition | VERIFIED | `portalNotificationQueue` at line 238; present in `ALL_QUEUES` at line 268 |
| `src/worker.ts` | Portal notification worker registration | VERIFIED | Worker at lines 833-860; event handlers for `completed`, `failed`, `error`; pushed to `workers` array; startup log line present |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/portal/trigger-portal-notification.ts` | Helper to resolve Mandant kontaktId and trigger notifications | VERIFIED | 80 lines; exports `triggerPortalNotificationForAkte`; finds Mandant Beteiligte via Prisma, calls `enqueuePortalNotification` for each |
| `src/lib/messaging/message-service.ts` | MSG-04 trigger hook after PORTAL channel message send | VERIFIED | Import of `triggerPortalNotificationForAkte` at line 15; PORTAL check + author role guard + fire-and-forget call at lines 139-154 |
| `src/app/api/akten/[id]/dokumente/[dId]/mandant-sichtbar/route.ts` | MSG-05 trigger hook after mandantSichtbar toggle | VERIFIED | Full PATCH handler with auth, Prisma update, trigger call at lines 82-86, audit log |
| `src/app/api/akten/[id]/naechste-schritte/route.ts` | MSG-06 trigger hook after mandantSichtbar AktenActivity creation | VERIFIED | PUT handler creates `STATUS_CHANGE` activity then calls trigger at lines 55-59; deviation from plan (feed route) correctly resolved |

Note: The PLAN listed `src/app/api/akten/[id]/feed/route.ts` as the MSG-06 target. The executor correctly identified that the feed POST route creates `NOTIZ` entries (not mandantSichtbar) and wired MSG-06 into `naechste-schritte/route.ts` instead — this is the correct implementation decision.

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/portal/portal-notification.ts` | `src/lib/email/send.ts` | `sendEmail()` inside `processPortalNotification` | WIRED | `import { sendEmail, isEmailConfigured }` at line 13; `sendEmail()` called at line 134 with `{to, subject, text, html}` |
| `src/lib/portal/portal-notification.ts` | `src/lib/portal/email-templates.ts` | `renderPortalEmail()` call for HTML generation | WIRED | `import { renderPortalEmail }` at line 14; called at line 126 with full `PortalEmailInput` |
| `src/worker.ts` | `src/lib/portal/portal-notification.ts` | Worker registration calling `processPortalNotification` | WIRED | `import { processPortalNotification }` at line 36; called inside worker processor at line 835 |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/messaging/message-service.ts` | `src/lib/portal/portal-notification.ts` | `enqueuePortalNotification()` via `triggerPortalNotificationForAkte` | WIRED | Imported and called via `triggerPortalNotificationForAkte`; the trigger helper calls `enqueuePortalNotification` internally |
| `src/app/api/akten/[id]/dokumente/[dId]/mandant-sichtbar/route.ts` | `src/lib/portal/portal-notification.ts` | `enqueuePortalNotification()` after mandantSichtbar=true toggle | WIRED | `import { triggerPortalNotificationForAkte }` at line 5; called at line 82 (which calls enqueuePortalNotification) |
| `src/lib/portal/trigger-portal-notification.ts` | `src/lib/portal/portal-notification.ts` | Calls `enqueuePortalNotification` after resolving Mandant | WIRED | `import { enqueuePortalNotification }` at line 15; called in loop at line 61 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MSG-04 | 48-01, 48-02 | Mandant erhaelt E-Mail bei neuer Nachricht vom Anwalt | SATISFIED | `message-service.ts` PORTAL channel check + author role guard + `triggerPortalNotificationForAkte(..., "neue-nachricht", ...)` |
| MSG-05 | 48-01, 48-02 | Mandant erhaelt E-Mail bei neuem freigegebenen Dokument | SATISFIED | `mandant-sichtbar/route.ts` triggers `triggerPortalNotificationForAkte(..., "neues-dokument", ...)` when mandantSichtbar toggled to true |
| MSG-06 | 48-01, 48-02 | Mandant erhaelt E-Mail bei Sachstand-Update | SATISFIED | `naechste-schritte/route.ts` triggers `triggerPortalNotificationForAkte(..., "sachstand-update", ...)` after creating mandant-visible STATUS_CHANGE activity |

REQUIREMENTS.md confirms all three IDs marked Complete for Phase 48. No orphaned requirements found.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/api/akten/[id]/naechste-schritte/route.ts` | 63 | `console.error(...)` instead of structured logger | Info | Pre-existing or minor; does not block goal; `createLogger` is not imported in this file |

No blocker or warning-level anti-patterns found. The `console.error` is an info-level note — the file uses no `createLogger` import and uses `console.error` only in the catch block for error visibility.

---

## Human Verification Required

### 1. End-to-End Email Delivery

**Test:** With SMTP configured, set `einwilligungEmail = true` on a Kontakt, then send a message from an Anwalt in a PORTAL channel. Check that a branded email is received.
**Expected:** Email arrives with subject `[KanzleiName] Neue Nachricht zu Ihrem Verfahren`, contains CTA button linking to the portal nachrichten page, no case-specific content.
**Why human:** Requires live SMTP configuration and email client inspection.

### 2. Deduplication Within 24h

**Test:** Trigger the same notification type for the same Mandant + Akte twice in the same day.
**Expected:** BullMQ processes only one job (the second is de-duplicated by matching jobId).
**Why human:** Requires BullMQ dashboard or queue inspection to confirm job deduplication behavior.

### 3. DSGVO Gate Enforcement

**Test:** Set `einwilligungEmail = false` on a Kontakt and trigger a portal notification.
**Expected:** No email sent; log shows "DSGVO gate: einwilligungEmail=false, skipping email".
**Why human:** Requires log inspection or mock email sink to confirm no-send behavior.

### 4. Deep-Link Navigation

**Test:** Click the CTA link in the received email.
**Expected:** Browser opens portal login page (if session expired) then redirects to the deep-link target after login.
**Why human:** Portal redirect-after-login behavior requires browser testing.

---

## Gaps Summary

No gaps found. All nine observable truths are satisfied by verified, substantive, wired artifacts. All three requirement IDs (MSG-04, MSG-05, MSG-06) have confirmed implementations in the codebase. Commit hashes 97a7739, 41d1256, 5ee2e40, c4b2c75 all exist in git history.

The one plan deviation (MSG-06 wired to `naechste-schritte/route.ts` instead of `feed/route.ts`) is correct: the feed POST route creates `NOTIZ` entries with `mandantSichtbar=false`, making it the wrong trigger point. The executor's choice to wire MSG-06 into the naechste-schritte endpoint is the correct implementation.

---

_Verified: 2026-03-03T13:40:00Z_
_Verifier: Claude (gsd-verifier)_
