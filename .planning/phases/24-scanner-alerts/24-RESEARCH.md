# Phase 24: Scanner + Alerts - Research

**Researched:** 2026-02-28
**Domain:** Background job scheduling, rule-based scanning, alert management, real-time notifications
**Confidence:** HIGH

## Summary

Phase 24 implements a deterministic background scanner that runs as a BullMQ cron job, checking all open Akten for three conditions (critical Fristen, inactivity, missing data) and creating HelenaAlert records with deduplication and auto-resolve. The codebase already has all foundational pieces: the HelenaAlert Prisma model with 6 types, BullMQ cron scheduling via `upsertJobScheduler()`, the frist-reminder processor as a mature reference for dedup/notification/Vertreter routing, Socket.IO emitter for real-time push, and the NavItem badgeKey pattern for sidebar badges.

The scanner is entirely rule-based (no LLM calls), making it fast and deterministic. It complements the existing `frist-reminder.ts` (which handles Vorfrist/overdue notifications) and `proactive-processor.ts` (which creates HelenaSuggestion hints). The key new pieces are: (1) a scanner processor with 3 check types plus escalation/auto-resolve logic, (2) an alert service layer with deduplication, (3) REST API routes for Alert-Center, (4) an /alerts page with filters, and (5) Socket.IO push for FRIST_KRITISCH alerts.

**Primary recommendation:** Reuse the `aiProactiveQueue` or create a dedicated `scannerQueue`, register a nightly cron via `upsertJobScheduler()`, implement 3 check functions as pure Prisma queries, add a scanner service with dedup/auto-resolve/escalation, build REST API following the `/api/helena/drafts` pattern, and create the Alert-Center UI following the Entwuerfe page pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 3 active checks: FRIST_KRITISCH, AKTE_INAKTIV, Missing Data (BETEILIGTE_FEHLEN, DOKUMENT_FEHLT)
- NEUES_URTEIL check deferred -- other 3 checks cover the critical path; add later when Urteile-RAG usage patterns are clearer
- WIDERSPRUCH check deferred -- would require LLM-based contradiction scanning; too complex for deterministic scanner
- Critical escalation only: scanner creates FRIST_KRITISCH alerts for Fristen < 48h that are still unacknowledged (not quittiert, not erledigt)
- frist-reminder.ts keeps handling normal Vorfristen and overdue escalation -- no duplication
- Scanner complements, does not replace, the existing frist-reminder system
- 14-day threshold for AKTE_INAKTIV: no new documents, emails, or notes in 14 days on an open Akte
- Only checks open/active Akten (not archiviert)
- Structural completeness checks only for Anomalie-Check -- no LLM needed
- BETEILIGTE_FEHLEN: Akte has no Mandant or no Gegner assigned
- DOKUMENT_FEHLT: configurable per check (e.g., Vollmacht missing) -- details at Claude's discretion
- Same alert type + same Akte within 24h = suppressed (no duplicate creation)
- Scanner checks existing unresolved alerts and marks them resolved when condition is fixed
- Auto-resolved alerts keep a history entry (resolvedAt timestamp + reason) for audit trail
- After 3 days unresolved: bump severity +2
- After 7 days unresolved: escalate to Admin via notification
- One-click dismiss (gelesen = true) with optional comment field for audit trail
- No required comment, even for critical alerts
- New "Alerts" sidebar nav item with unread count badge (reuses NavItem.badgeKey pattern from Phase 23)
- Clicking opens dedicated /alerts page
- Flat chronological list, newest first
- Filter chips at top: by type (FRIST_KRITISCH, AKTE_INAKTIV, etc.), by Akte, gelesen/ungelesen
- "Alle gelesen" bulk action button at top -- no individual checkboxes
- Alerts appear in both /alerts page AND in Akte detail view (existing tabs/sections)
- When Phase 26 Activity Feed ships, alerts will integrate there
- Only FRIST_KRITISCH triggers real-time Socket.IO push to the user
- Other alert types are visible in Alert-Center on next page load -- avoids notification fatigue
- Badge count update pushed via Socket.IO for all types
- Reuse Vertreter routing pattern from frist-reminder.ts: when Verantwortlicher is on vacation, route to Vertreter + notify both
- Consistent behavior across frist-reminder and scanner systems

### Claude's Discretion
- Email notification for FRIST_KRITISCH: evaluate overlap with frist-reminder email and decide whether scanner should also email or rely on frist-reminder's existing email channel
- Admin escalation mechanism: notification vs separate HelenaAlert -- pick cleanest approach given existing patterns
- Who can dismiss alerts: Verantwortlicher + Admin vs anyone with Akte access -- pick based on existing RBAC patterns
- DOKUMENT_FEHLT specific rules: which documents are "expected" per Sachgebiet
- Scanner cron schedule: existing aiProactiveQueue has 4h pattern, roadmap says "nightly" -- decide appropriate schedule

### Deferred Ideas (OUT OF SCOPE)
- NEUES_URTEIL check (keyword/semantic matching of new Urteile against open Akten) -- add when Urteile-RAG usage patterns are clearer
- WIDERSPRUCH check (LLM-based contradiction scanning between documents) -- too complex for deterministic scanner, consider as separate Helena agent capability
- Dashboard widget for Alert-Center summary -- Phase 26 scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCAN-01 | Taeglicher Background-Scanner (BullMQ-Cron, konfigurierbar) prueft alle offenen Akten | BullMQ `upsertJobScheduler()` pattern from frist-reminder/gesetze-sync. Dedicated scannerQueue with nightly cron. `getSettingTyped()` for configurable schedule. |
| SCAN-02 | Frist-Check: Fristen < 48h (per CONTEXT) ohne quittiert/erledigt -> FRIST_KRITISCH Alert | KalenderEintrag query: `typ: FRIST, erledigt: false, quittiert: false, datum < now+48h`. Complements frist-reminder.ts. |
| SCAN-03 | Inaktivitaets-Check: Akte > 14 Tage keine Aktivitaet -> AKTE_INAKTIV Alert | Query Akte.geaendert + recent Dokument/EmailMessage/ChatNachricht timestamps. 14-day threshold per CONTEXT. |
| SCAN-04 | Anomalie-Check: unvollstaendige Beteiligte, fehlende Dokumente -> Flag | Beteiligter rolle query (MANDANT/GEGNER presence). Configurable DOKUMENT_FEHLT rules per Sachgebiet. |
| SCAN-05 | Neu-Urteil-Check: DEFERRED per CONTEXT.md | Out of scope -- deferred to when Urteile-RAG usage patterns are clearer. |
| SCAN-06 | Konfigurierbare Schwellenwerte pro Check-Typ | SystemSetting table via `getSettingTyped()`. New scanner.* settings in defaults.ts. |
| ALRT-02 | Alert-Center im Dashboard mit Filter nach Typ, Akte, Prioritaet und Gelesen/Ungelesen | REST API at `/api/helena/alerts` following drafts pattern. /alerts page with filter chips. |
| ALRT-03 | Alerts erscheinen im Akte-Feed als Helena-Event | AktenActivity with typ: HELENA_ALERT created alongside HelenaAlert. Phase 26 Activity Feed will render these. |
| ALRT-04 | Alert-Deduplizierung: gleicher Alert-Typ + gleiche Akte innerhalb 24h wird nicht doppelt erzeugt | Prisma query: `findFirst({ where: { akteId, typ, createdAt: { gte: 24h ago } } })` before create. |
| ALRT-05 | Kritische Alerts (FRIST_KRITISCH) erzeugen zusaetzlich Socket.IO Push-Notification | `getSocketEmitter().to(user:${userId}).emit("helena:alert-critical", ...)` pattern from draft-notification.ts. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| BullMQ | (already installed) | Cron job scheduling + queue | Already used for 15+ queues in the project. `upsertJobScheduler()` for idempotent cron registration. |
| Prisma | (already installed) | Database queries for scanner checks + alert CRUD | Single source of truth, existing `HelenaAlert` model ready. |
| @socket.io/redis-emitter | (already installed) | Real-time push from worker to browser | Existing pattern via `getSocketEmitter()`. |
| date-fns | (already installed) | Date arithmetic for threshold calculations | Already used throughout frist-reminder.ts and elsewhere. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | (already installed) | API query param validation | For `/api/helena/alerts` route input validation. |
| lucide-react | (already installed) | Icons for Alert-Center UI | `Bell`, `AlertTriangle`, `Clock`, `UserMinus` for alert types. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dedicated scannerQueue | Reuse aiProactiveQueue | Separate queue is cleaner -- scanner is deterministic (no LLM budget), proactive is AI-based. Different retry/concurrency needs. |
| HelenaAlert.meta for resolvedAt | Add resolvedAt column to schema | Use meta JSON to avoid schema migration -- meta already exists and is typed as Json?. Keeps model stable. |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── workers/processors/
│   └── scanner.ts                 # Main scanner processor (3 check functions)
├── lib/
│   ├── scanner/
│   │   ├── service.ts             # Alert service: createScannerAlert(), resolveAlert(), escalateAlerts()
│   │   ├── checks/
│   │   │   ├── frist-check.ts     # FRIST_KRITISCH check logic
│   │   │   ├── inaktiv-check.ts   # AKTE_INAKTIV check logic
│   │   │   └── anomalie-check.ts  # BETEILIGTE_FEHLEN + DOKUMENT_FEHLT check logic
│   │   └── types.ts               # ScanResult, CheckResult types
│   └── queue/
│       └── queues.ts              # Add scannerQueue + registerScannerJob()
├── app/
│   ├── api/helena/alerts/
│   │   ├── route.ts               # GET (list) + PATCH (bulk mark read)
│   │   └── [id]/route.ts          # PATCH (dismiss single) + GET (detail)
│   └── (dashboard)/alerts/
│       └── page.tsx               # Alert-Center page
├── components/
│   └── helena/
│       └── alert-center.tsx       # Client component with filters + list
└── worker.ts                      # Register scanner worker + cron
```

### Pattern 1: Scanner Processor (BullMQ Cron)
**What:** A dedicated queue + worker that runs on a configurable cron schedule, iterates all open Akten, runs 3 check functions, creates/resolves alerts.
**When to use:** For the nightly scanner job.
**Example:**
```typescript
// src/workers/processors/scanner.ts
// Follows exact pattern from frist-reminder.ts

import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getSettingTyped } from "@/lib/settings/service";
import { runFristCheck } from "@/lib/scanner/checks/frist-check";
import { runInaktivCheck } from "@/lib/scanner/checks/inaktiv-check";
import { runAnomalieCheck } from "@/lib/scanner/checks/anomalie-check";
import { resolveStaleAlerts, escalateUnresolved } from "@/lib/scanner/service";

const log = createLogger("scanner");

export async function processScanner(): Promise<ScanResult> {
  log.info("Starting scanner run");

  // Load configurable thresholds from SystemSetting
  const fristThresholdHours = await getSettingTyped<number>("scanner.frist_threshold_hours", 48);
  const inaktivThresholdDays = await getSettingTyped<number>("scanner.inaktiv_threshold_days", 14);
  const escalation3dEnabled = await getSettingTyped<boolean>("scanner.escalation_3d_enabled", true);
  const escalation7dEnabled = await getSettingTyped<boolean>("scanner.escalation_7d_enabled", true);

  // Get all open Akten
  const akten = await prisma.akte.findMany({
    where: { status: "OFFEN" },
    select: {
      id: true,
      aktenzeichen: true,
      kurzrubrum: true,
      sachgebiet: true,
      anwaltId: true,
      sachbearbeiterId: true,
      geaendert: true,
    },
  });

  let alertsCreated = 0;
  let alertsResolved = 0;

  for (const akte of akten) {
    alertsCreated += await runFristCheck(akte, fristThresholdHours);
    alertsCreated += await runInaktivCheck(akte, inaktivThresholdDays);
    alertsCreated += await runAnomalieCheck(akte);
  }

  // Auto-resolve alerts where condition is now fixed
  alertsResolved = await resolveStaleAlerts();

  // Progressive escalation
  if (escalation3dEnabled) await escalateUnresolved(3, 2);  // +2 severity after 3 days
  if (escalation7dEnabled) await escalateUnresolved(7, 0);  // admin notify after 7 days

  log.info({ aktenScanned: akten.length, alertsCreated, alertsResolved }, "Scanner run complete");
  return { aktenScanned: akten.length, alertsCreated, alertsResolved };
}
```

### Pattern 2: Alert Deduplication
**What:** Before creating a HelenaAlert, check if the same type+Akte combo was created within 24 hours.
**When to use:** Every alert creation in the scanner.
**Example:**
```typescript
// src/lib/scanner/service.ts

import { subHours } from "date-fns";

export async function createScannerAlert(params: {
  akteId: string;
  userId: string;
  typ: HelenaAlertTyp;
  titel: string;
  inhalt?: string;
  severity: number;
  meta?: Record<string, unknown>;
}): Promise<HelenaAlert | null> {
  // Dedup: same type + same Akte within 24h
  const existing = await prisma.helenaAlert.findFirst({
    where: {
      akteId: params.akteId,
      typ: params.typ,
      createdAt: { gte: subHours(new Date(), 24) },
    },
    select: { id: true },
  });

  if (existing) {
    log.debug({ akteId: params.akteId, typ: params.typ }, "Alert deduplicated");
    return null;
  }

  const alert = await prisma.helenaAlert.create({
    data: {
      akteId: params.akteId,
      userId: params.userId,
      typ: params.typ,
      titel: params.titel,
      inhalt: params.inhalt ?? null,
      severity: params.severity,
      prioritaet: params.severity,
      meta: params.meta ?? undefined,
    },
  });

  // Create AktenActivity entry for Akte feed
  await prisma.aktenActivity.create({
    data: {
      akteId: params.akteId,
      typ: "HELENA_ALERT",
      titel: params.titel,
      inhalt: params.inhalt ?? null,
      meta: { alertId: alert.id, alertTyp: params.typ, severity: params.severity },
    },
  });

  // Socket.IO push for FRIST_KRITISCH only
  if (params.typ === "FRIST_KRITISCH") {
    getSocketEmitter()
      .to(`user:${params.userId}`)
      .emit("helena:alert-critical", {
        alertId: alert.id,
        akteId: params.akteId,
        typ: params.typ,
        titel: params.titel,
      });

    // Also create in-app Notification for persistence
    await createNotification({
      userId: params.userId,
      type: "helena:alert-critical",
      title: params.titel,
      message: params.inhalt ?? "Kritische Frist erfordert sofortige Aufmerksamkeit.",
      data: { alertId: alert.id, akteId: params.akteId, link: `/akten/${params.akteId}` },
    });
  }

  // Badge count update for all types
  const unreadCount = await prisma.helenaAlert.count({
    where: { userId: params.userId, gelesen: false },
  });
  getSocketEmitter()
    .to(`user:${params.userId}`)
    .emit("helena:alert-badge", { count: unreadCount });

  return alert;
}
```

### Pattern 3: Auto-Resolve with Audit Trail
**What:** Scanner checks existing unresolved alerts and resolves them when the underlying condition is fixed.
**When to use:** During each scanner run, after creating new alerts.
**Example:**
```typescript
// Resolve FRIST_KRITISCH alerts where Frist is now erledigt or quittiert
export async function resolveStaleAlerts(): Promise<number> {
  let resolved = 0;

  // Find all unresolved FRIST_KRITISCH alerts
  const fristAlerts = await prisma.helenaAlert.findMany({
    where: {
      typ: "FRIST_KRITISCH",
      gelesen: false,
      meta: { not: { path: ["resolvedAt"], not: Prisma.AnyNull } },
    },
    select: { id: true, meta: true, akteId: true },
  });

  for (const alert of fristAlerts) {
    const fristId = (alert.meta as any)?.fristId;
    if (!fristId) continue;

    const frist = await prisma.kalenderEintrag.findUnique({
      where: { id: fristId },
      select: { erledigt: true, quittiert: true },
    });

    if (frist?.erledigt || frist?.quittiert) {
      await prisma.helenaAlert.update({
        where: { id: alert.id },
        data: {
          gelesen: true,
          gelesenAt: new Date(),
          meta: {
            ...(alert.meta as object),
            resolvedAt: new Date().toISOString(),
            resolvedReason: frist.erledigt ? "Frist erledigt" : "Frist quittiert",
          },
        },
      });
      resolved++;
    }
  }

  // Similar for AKTE_INAKTIV, BETEILIGTE_FEHLEN, DOKUMENT_FEHLT...
  return resolved;
}
```

### Pattern 4: Vertreter Routing (from frist-reminder.ts)
**What:** When the Verantwortlicher is on vacation, route alerts and notifications to their Vertreter while also informing the original user.
**When to use:** For FRIST_KRITISCH Socket.IO push and admin escalation.
**Example:**
```typescript
// Reuse the exact pattern from frist-reminder.ts
function resolveAlertRecipient(akte: { anwaltId: string | null; sachbearbeiterId: string | null }): string | null {
  return akte.anwaltId ?? akte.sachbearbeiterId;
}

// Then check vacation status and route accordingly
// (exact pattern from frist-reminder.ts isUserOnVacation + dual notification)
```

### Anti-Patterns to Avoid
- **Running LLM calls in scanner:** Scanner MUST be deterministic. All 3 checks use Prisma queries only. No AI SDK calls.
- **Replacing frist-reminder:** Scanner creates FRIST_KRITISCH alerts for <48h unacknowledged Fristen. frist-reminder.ts handles Vorfrist reminders and overdue escalation. They are complementary, not overlapping.
- **Unbounded Akte iteration:** Process all open Akten but use efficient batch queries. Don't load full relations -- use `select` for only needed fields.
- **Creating alerts without checking existing:** Always dedup before create. The 24h window prevents alert spam.
- **Modifying HelenaAlert schema:** Use the existing `meta: Json?` field for resolvedAt, resolvedReason, escalationHistory instead of adding columns. Keeps migration scope minimal.

## Discretion Recommendations

### Email for FRIST_KRITISCH: DO NOT send scanner email
**Recommendation:** Do NOT send email from scanner for FRIST_KRITISCH. The existing `frist-reminder.ts` already sends emails for upcoming and overdue Fristen via dual-channel (in-app + email). Scanner's FRIST_KRITISCH alert adds Socket.IO push and Alert-Center visibility, which is the gap frist-reminder doesn't cover. Adding a second email would create confusion.
**Confidence:** HIGH -- based on analysis of frist-reminder.ts email patterns.

### Admin escalation: Use createNotification() (not a separate HelenaAlert)
**Recommendation:** After 7 days unresolved, call `createNotification()` to all ADMIN users (same pattern as frist-reminder.ts overdue escalation lines 461-486). Don't create a separate HelenaAlert targeting admins -- alerts are per-Akte, and admins may not be the Akte owner. The notification system is the right channel for escalation.
**Confidence:** HIGH -- matches existing escalation pattern in frist-reminder.ts and health/alerts.ts.

### Alert dismiss permissions: Anyone with Akte access
**Recommendation:** Anyone who can see the Akte (passes `buildAkteAccessFilter`) can dismiss alerts on it. This matches the existing RBAC pattern where Akte access is determined by Dezernat membership + role. Adding a separate Verantwortlicher-only check would create friction without meaningful security benefit.
**Confidence:** HIGH -- consistent with existing `buildAkteAccessFilter` pattern used in drafts API.

### DOKUMENT_FEHLT rules per Sachgebiet
**Recommendation:** Start simple with a configurable JSON map in SystemSetting:
```json
{
  "ARBEITSRECHT": ["Vollmacht", "Kuendigungsschreiben"],
  "VERKEHRSRECHT": ["Vollmacht", "Unfallbericht"],
  "FAMILIENRECHT": ["Vollmacht"],
  "default": ["Vollmacht"]
}
```
Check: for each expected document name, look for a Dokument with matching `kategorie` or name pattern. Store the setting key as `scanner.required_documents` with type `json`.
**Confidence:** MEDIUM -- the exact document matching strategy (by kategorie vs name pattern) needs validation during implementation. Start with VorlageKategorie.MANDATSVOLLMACHT check.

### Scanner cron schedule: Nightly at 01:00
**Recommendation:** Run at `0 1 * * *` (01:00 Europe/Berlin). This slots between the existing crons:
- 01:00 -- Scanner (new)
- 02:00 -- Gesetze sync
- 03:00 -- Urteile sync
- 06:00 -- Frist reminder
- 07:00 -- AI Briefing

Nightly (not every 4h like aiProactive) because scanner is rule-based and conditions don't change that frequently. The aiProactiveQueue's 4h interval was designed for LLM-based analysis. Store as `scanner.cron_schedule` in SystemSetting for configurability.
**Confidence:** HIGH -- fits the established nightly cron pattern window.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom setTimeout/setInterval loop | BullMQ `upsertJobScheduler()` | Survives worker restarts, handles timezone, idempotent registration |
| Deduplication | In-memory Set or Redis key | Prisma `findFirst` with 24h window | Persistent across restarts, no cache invalidation bugs |
| Real-time push | Custom WebSocket server | `getSocketEmitter()` + Redis emitter | Already wired, handles rooms (user:/akte:/role:), works from worker process |
| Notification persistence | Custom DB writes | `createNotification()` service | Handles Socket.IO emit + DB persist in one call |
| RBAC filtering | Custom role checks | `buildAkteAccessFilter()` | Handles Dezernat membership, admin override, all roles consistently |
| Date calculations | Manual ms arithmetic | `date-fns` (subHours, subDays, differenceInCalendarDays) | Edge cases (DST, leap years, timezones) handled correctly |

**Key insight:** Every infrastructure piece for Phase 24 already exists. The scanner is pure business logic (Prisma queries + conditional alert creation) layered on top of existing patterns. Zero new packages needed.

## Common Pitfalls

### Pitfall 1: Scanner vs Frist-Reminder Overlap
**What goes wrong:** Creating FRIST_KRITISCH alerts for the same Fristen that frist-reminder already sends Vorfrist/overdue notifications for, leading to double notifications.
**Why it happens:** Both systems check KalenderEintrag with typ=FRIST, but with different thresholds and purposes.
**How to avoid:** Scanner checks `fristablauf < now + 48h AND erledigt = false AND quittiert = false`. This is strictly the "critical, unacknowledged" window. Frist-reminder handles the broader Vorfrist dates (7d, 3d, 1d) and overdue escalation. Clear separation: scanner = alert creation for Alert-Center, frist-reminder = notification + email for proactive reminders.
**Warning signs:** Users receiving both a Vorfrist notification AND a FRIST_KRITISCH alert for the same Frist at the same time.

### Pitfall 2: Dedup Race Condition
**What goes wrong:** Two scanner runs (or a manual trigger + cron) create duplicate alerts because the dedup check and create are not atomic.
**Why it happens:** BullMQ concurrency is set to 1 for the scanner, but manual API triggers could race.
**How to avoid:** Set scanner Worker concurrency to 1 (only one scan at a time). For manual triggers, use the same queue (not a direct function call). The dedup `findFirst + create` is safe for single-worker concurrency.
**Warning signs:** Multiple alerts of the same type for the same Akte created within seconds.

### Pitfall 3: Auto-Resolve Missing Audit Trail
**What goes wrong:** Alerts get silently resolved without any record of what happened, making it impossible to trace alert history.
**Why it happens:** Updating `gelesen=true` without recording the resolution reason.
**How to avoid:** Always set `meta.resolvedAt` + `meta.resolvedReason` when auto-resolving. Use Prisma's JSON merge pattern to preserve existing meta fields.
**Warning signs:** Alerts disappearing from the list with no explanation.

### Pitfall 4: N+1 Queries in Scanner Loop
**What goes wrong:** For each of N Akten, making multiple individual queries (check Beteiligter, check KalenderEintrag, check Dokument) resulting in 3N+ database calls.
**Why it happens:** Implementing checks as individual per-Akte functions without batching.
**How to avoid:** Batch-query where possible. For FRIST_KRITISCH, query ALL Fristen < 48h across all Akten in one query, then group by akteId. For BETEILIGTE_FEHLEN, query all Akten with their Beteiligter counts in one aggregation. Only AKTE_INAKTIV needs per-Akte activity timestamp checking (but can still batch the initial Akte.geaendert check).
**Warning signs:** Scanner taking >60s for a small number of Akten.

### Pitfall 5: Badge Count Stale After Dismiss
**What goes wrong:** User dismisses an alert but the sidebar badge still shows the old count until page refresh.
**Why it happens:** Dismiss API endpoint doesn't push a badge count update via Socket.IO.
**How to avoid:** After every dismiss/mark-read API call, emit a `helena:alert-badge` Socket.IO event with the new count. The sidebar listens for this event and updates in real-time (same pattern as draft badge).
**Warning signs:** Badge count not updating after dismissing alerts.

### Pitfall 6: Escalation Severity Overflow
**What goes wrong:** Severity bumped past 10 (the maximum) after repeated escalation cycles.
**Why it happens:** Adding +2 without clamping: `Math.min(10, currentSeverity + 2)`.
**How to avoid:** Always clamp: `severity: Math.min(10, alert.severity + 2)`.
**Warning signs:** Severity values > 10 in the database.

## Code Examples

### Frist-Check Query
```typescript
// Find all critical Fristen: < threshold hours, not erledigt, not quittiert, on open Akten
const criticalFristen = await prisma.kalenderEintrag.findMany({
  where: {
    typ: "FRIST",
    erledigt: false,
    quittiert: false,
    akte: { status: "OFFEN" },
    OR: [
      { fristablauf: { lte: thresholdDate, gte: new Date() } },
      { fristablauf: null, datum: { lte: thresholdDate, gte: new Date() } },
    ],
  },
  include: {
    akte: {
      select: {
        id: true,
        aktenzeichen: true,
        kurzrubrum: true,
        anwaltId: true,
        sachbearbeiterId: true,
      },
    },
    verantwortlich: {
      select: {
        id: true,
        name: true,
        vertretungAktiv: true,
        vertretungVon: true,
        vertretungBis: true,
        vertreterId: true,
        vertreter: { select: { id: true, name: true } },
      },
    },
  },
});
```

### Inaktiv-Check Query
```typescript
// Check for Akten with no recent activity
const inaktivThreshold = subDays(new Date(), inaktivDays);

// First: get open Akten last modified before threshold
const staleAkten = await prisma.akte.findMany({
  where: {
    status: "OFFEN",
    geaendert: { lt: inaktivThreshold },
  },
  select: {
    id: true,
    aktenzeichen: true,
    kurzrubrum: true,
    anwaltId: true,
    sachbearbeiterId: true,
    geaendert: true,
    // Check for recent documents, emails, notes
    _count: {
      select: {
        dokumente: { where: { createdAt: { gte: inaktivThreshold } } },
        emailMessages: { where: { date: { gte: inaktivThreshold } } },
        chatNachrichten: { where: { createdAt: { gte: inaktivThreshold } } },
      },
    },
  },
});

// Filter to truly inactive (no recent documents, emails, or messages)
const trulyInactive = staleAkten.filter(
  (a) => a._count.dokumente === 0 && a._count.emailMessages === 0 && a._count.chatNachrichten === 0
);
```

### Alert-Center REST API (GET)
```typescript
// GET /api/helena/alerts
export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const { searchParams } = new URL(request.url);
  const typ = searchParams.get("typ");
  const akteId = searchParams.get("akteId");
  const gelesen = searchParams.get("gelesen");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  const akteFilter = buildAkteAccessFilter(session.user.id, session.user.role);

  const where: Record<string, unknown> = {
    akte: akteFilter,
  };

  if (typ) where.typ = typ;
  if (akteId) where.akteId = akteId;
  if (gelesen === "true") where.gelesen = true;
  if (gelesen === "false") where.gelesen = false;

  const skip = (page - 1) * limit;

  const [alerts, total] = await Promise.all([
    prisma.helenaAlert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      },
    }),
    prisma.helenaAlert.count({ where }),
  ]);

  return NextResponse.json({
    alerts,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
```

### Scanner Queue Registration
```typescript
// In queues.ts
export const scannerQueue = new Queue("scanner", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "custom" },
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});

export async function registerScannerJob(
  cronPattern = "0 1 * * *"
): Promise<void> {
  await scannerQueue.upsertJobScheduler(
    "scanner-nightly",
    {
      pattern: cronPattern,
      tz: "Europe/Berlin",
    },
    {
      name: "nightly-scan",
      data: {},
      opts: {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
      },
    }
  );
}
```

### Sidebar Badge for Alerts
```typescript
// In sidebar.tsx, add to navigation array:
{ name: "Alerts", href: "/alerts", icon: Bell, badgeKey: "unreadAlerts" },

// Add state + fetch:
const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);

const fetchAlertCount = useCallback(async () => {
  try {
    const res = await fetch("/api/helena/alerts?gelesen=false&limit=0");
    if (res.ok) {
      const data = await res.json();
      setUnreadAlertsCount(data.total ?? 0);
    }
  } catch { /* Non-critical */ }
}, []);

// Listen for Socket.IO badge updates:
useEffect(() => {
  if (!socket) return;
  function handleBadge(data: { count: number }) {
    setUnreadAlertsCount(data.count);
  }
  socket.on("helena:alert-badge", handleBadge);
  socket.on("helena:alert-critical", () => fetchAlertCount());
  return () => {
    socket.off("helena:alert-badge", handleBadge);
    socket.off("helena:alert-critical", () => fetchAlertCount());
  };
}, [socket, fetchAlertCount]);

// Add to badgeCounts:
const badgeCounts = useMemo(() => ({
  pendingDrafts: pendingDraftsCount,
  unreadAlerts: unreadAlertsCount,
}), [pendingDraftsCount, unreadAlertsCount]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HelenaSuggestion for proactive hints | HelenaAlert for scanner-generated alerts | Phase 19 (schema) | Proper typed alert model with severity, priority, gelesen tracking |
| aiProactiveQueue for all scanning | Dedicated scannerQueue for deterministic checks | Phase 24 (this phase) | Clean separation: scanner (no LLM) vs proactive (LLM-based) |
| Manual alert creation via create_alert tool | Automated scanner + dedup + auto-resolve | Phase 24 (this phase) | Proactive instead of reactive alert generation |

**Deprecated/outdated:**
- `HelenaSuggestion` for scanner-type alerts: use `HelenaAlert` instead. HelenaSuggestion remains for AI-generated suggestions from proactive-processor.

## Schema Changes Required

### HelenaAlert Model: No Schema Changes Needed
The existing model has all required fields:
- `typ` (HelenaAlertTyp enum) -- FRIST_KRITISCH, AKTE_INAKTIV, BETEILIGTE_FEHLEN, DOKUMENT_FEHLT already defined
- `severity` + `prioritaet` (Int) -- for escalation bumps
- `gelesen` + `gelesenAt` (Boolean + DateTime?) -- for dismiss flow
- `meta` (Json?) -- for resolvedAt, resolvedReason, fristId, escalationHistory, dismissComment
- Indexes on [akteId, typ], [userId, gelesen], [typ, createdAt] -- cover all query patterns

### New SystemSettings Needed
```
scanner.enabled (boolean, default: true)
scanner.cron_schedule (string, default: "0 1 * * *")
scanner.frist_threshold_hours (number, default: 48)
scanner.inaktiv_threshold_days (number, default: 14)
scanner.escalation_3d_enabled (boolean, default: true)
scanner.escalation_7d_enabled (boolean, default: true)
scanner.required_documents (json, default: {"default": ["Vollmacht"]})
```

## Open Questions

1. **DOKUMENT_FEHLT matching strategy**
   - What we know: Need to check if expected documents (e.g., Vollmacht) exist for an Akte
   - What's unclear: Match by Dokument.name pattern, Dokument.kategorie (VorlageKategorie enum), or both?
   - Recommendation: Start with checking if any Beteiligter with rolle=MANDANT has a Dokument with `kategorie: MANDATSVOLLMACHT`. Expand later. LOW priority since this is a soft check.

2. **AktenActivity creation timing**
   - What we know: HELENA_ALERT activity type exists in the enum. Activities should be created alongside alerts.
   - What's unclear: Should auto-resolved alerts also create an activity entry?
   - Recommendation: Create activity only on alert creation, not on resolve. Phase 26 Activity Feed will render these. Auto-resolve is an internal state change, not a user-facing event.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `src/workers/processors/frist-reminder.ts` -- mature dedup, Vertreter routing, notification patterns
- Existing codebase analysis: `src/lib/queue/queues.ts` -- BullMQ upsertJobScheduler, queue registration
- Existing codebase analysis: `src/worker.ts` -- Worker registration, cron startup, graceful shutdown
- Existing codebase analysis: `src/lib/helena/draft-notification.ts` -- Socket.IO emitter pattern
- Existing codebase analysis: `src/components/layout/sidebar.tsx` -- NavItem badgeKey pattern
- Existing codebase analysis: `prisma/schema.prisma` -- HelenaAlert model, AktenActivityTyp enum
- Existing codebase analysis: `src/lib/notifications/service.ts` -- createNotification pattern
- Existing codebase analysis: `src/lib/settings/defaults.ts` -- SystemSetting registration pattern
- Existing codebase analysis: `src/app/api/helena/drafts/route.ts` -- API route pattern with RBAC
- Existing codebase analysis: `src/lib/ai/proactive-processor.ts` -- existing proactive scan reference
- Existing codebase analysis: `src/lib/health/alerts.ts` -- cooldown + admin email escalation pattern

### Secondary (MEDIUM confidence)
- CONTEXT.md user decisions -- locked thresholds, check types, escalation rules

### Tertiary (LOW confidence)
- DOKUMENT_FEHLT matching strategy -- needs validation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, zero new dependencies
- Architecture: HIGH -- every pattern has a direct existing reference in the codebase
- Pitfalls: HIGH -- identified from analyzing existing frist-reminder overlap and common BullMQ patterns
- Discretion recommendations: HIGH for email/escalation/schedule, MEDIUM for DOKUMENT_FEHLT matching

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (30 days -- stable domain, no external API dependencies)
