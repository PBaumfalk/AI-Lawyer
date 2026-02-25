# Phase 8: Integration Hardening - Research

**Researched:** 2026-02-25
**Domain:** Cross-phase integration wiring — RBAC enforcement, Versand-Gate, audit logging, KPI data alignment, PRAKTIKANT removal
**Confidence:** HIGH

## Summary

Phase 8 is a wiring phase: all the building blocks already exist in the codebase (`buildAkteAccessFilter`, `requirePermission`, `logAuditEvent`, `checkDokumenteFreigegeben`) and need to be applied to routes and UI components that were built in earlier phases without these guards. The work is straightforward code integration, not library research or architectural design.

The primary integration gaps are: (1) Finance API routes use `auth()` directly instead of `buildAkteAccessFilter()` for list queries, (2) KI-chat routes use basic `auth()` instead of `requirePermission('canUseKI')` (but per user decision, KI is open to all logged-in users -- no role restriction), (3) Dashboard Prisma queries lack any user-scoped filtering, (4) Versand-Gate `checkDokumenteFreigegeben()` is defined but not called in the email-send or beA-send flows, (5) beA routes have RBAC but no audit logging, (6) Finanzen overview KPI cards read wrong API response keys, and (7) PRAKTIKANT role must be entirely removed.

**Primary recommendation:** Wire existing helper functions into existing routes/components. No new libraries or architectural changes needed. The PRAKTIKANT removal requires a Prisma migration, code cleanup across ~15 files, and careful testing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- PRAKTIKANT-Rolle komplett entfernen (Schema, Seed, UI, Permission-Checks) -- 4 Rollen: ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT
- REQ-RS-003 ("PRAKTIKANT nur Lesen + Entwuerfe") wird obsolet
- KI-Chat (/api/ki-chat, /api/ki-chat/conversations, /api/helena/suggestions) offen fuer alle eingeloggten User -- keine Rolleneinschraenkung, nur Auth-Check
- API-Routes geben 403 Forbidden bei unberechtigtem Zugriff zurueck
- Nav-Items fuer nicht-berechtigte Funktionen werden komplett versteckt (nicht ausgegraut)
- ENTWURF-Dokumente im Attach-Dialog sichtbar aber ausgegraut mit Hinweis "Noch nicht freigegeben"
- Quick-Release-Button direkt neben gesperrtem Dokument im Attach-Dialog -- Dokument kann sofort freigegeben werden ohne Workflow-Wechsel
- API gibt 400 Bad Request bei Versuch, ENTWURF-Dokument zu senden (z.B. manipulierter Request)
- Gleiche checkDokumenteFreigegeben()-Logik fuer E-Mail-Versand und beA-Versand -- eine Funktion, zwei Einsatzorte
- ALLE beA-Aktionen loggen: Senden, Empfangen, eEB-Bestaetigung, Nachricht oeffnen, Anhang herunterladen, Safe-ID aendern, Postfach wechseln
- Ausfuehrliche Log-Eintraege: User, Aktion, Zeitstempel, Aktenzeichen, Empfaenger-Safe-ID, Dokumentenliste, Dateigroessen, Nachrichtentyp, Ergebnis (Erfolg/Fehler)
- Erfolg UND Fehler loggen -- bei Fehler zusaetzlich: Fehlermeldung, Fehlercode
- Pruefprotokoll-Tab in der Aktenansicht zeigt beA-Audit-Log chronologisch an
- Finance-API-Routes verwenden buildAkteAccessFilter() -- User sieht nur Finanzdaten seiner Akten
- KPI-Card-Keys fixen (API-Response-Keys muessen mit Frontend-Keys matchen) -- keine neuen KPIs
- SEKRETARIAT + SACHBEARBEITER: nur operative KPIs (offene Rechnungen, ueberfaellige Rechnungen, Fremdgeld-Saldo)
- ANWALT + ADMIN: alle KPIs (inklusive Gesamtumsatz, Gewinn, Honorarvolumen)
- ADMIN sieht immer kanzleiweite Summen
- ANWALT: kanzleiweite Finanzsicht konfigurierbar pro User -- Checkbox "Kanzleiweite Finanzen" in der Benutzerverwaltung
- Angestellte Anwaelte sehen nur eigene Akten-Finanzen, Partner-Anwaelte koennen kanzleiweit freigeschaltet werden

### Claude's Discretion
- Exact Pruefprotokoll-Tab UI layout and filtering
- Quick-Release-Button design im Attach-Dialog
- Wie die "Kanzleiweite Finanzen"-Checkbox technisch ins User-Modell integriert wird
- Error-State-Handling bei 403/400 Responses im Frontend

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-RS-001 | Akten-Zugriff: Persoenlich + Gruppen/Dezernate + Admin-Override | `buildAkteAccessFilter()` already implements this in `src/lib/rbac.ts` -- needs to be applied to finance routes and dashboard queries |
| REQ-RS-002 | SEKRETARIAT als eingeschraenkter Sachbearbeiter (kein Freigeben) | PERMISSIONS matrix already defines SEKRETARIAT restrictions; finance KPI visibility enforcement needed |
| REQ-RS-003 | PRAKTIKANT: Nur Lesen + Entwuerfe (zugewiesene Akten) | **OBSOLETE per user decision** -- PRAKTIKANT role will be entirely removed |
| REQ-RS-004 | Systemweiter Audit-Trail (Wer/Wann/Was) | `logAuditEvent()` exists in `src/lib/audit.ts` with rich action types; beA routes need audit calls added |
| REQ-KI-003 | Akten-spezifischer Document Chat | KI-chat routes already work; per user decision, open to all logged-in users (no RBAC restriction beyond auth) |
| REQ-KI-009 | KI-Entwurf-Workflow: ENTWURF + Freigabe | Already implemented in Phase 6; integration-hardening ensures ENTWURF docs blocked from send flows |
| REQ-FI-003 | Rechnungen: DB-Model, Nummernkreis, Status-Flow | Already built; needs `buildAkteAccessFilter()` on list queries |
| REQ-FI-005 | Aktenkonto: Buchungen, Saldo, Beleg-Verknuepfung | Already built; needs `buildAkteAccessFilter()` on list/detail queries |
| REQ-FI-006 | Fremdgeld-Compliance | Already built; KPI display broken due to API response key mismatch |
</phase_requirements>

## Standard Stack

### Core
No new libraries needed. Phase 8 wires existing code.

| Library | Version | Purpose | Already Installed |
|---------|---------|---------|-------------------|
| Prisma | Current | Schema migration for PRAKTIKANT removal + `canSeeKanzleiFinanzen` field | YES |
| Next.js App Router | 14+ | API routes being modified | YES |

### Supporting
No new packages to install.

### Alternatives Considered
None -- this is purely wiring existing helpers into existing routes.

## Architecture Patterns

### Pattern 1: RBAC Guard Application
**What:** Add `buildAkteAccessFilter()` to Prisma `where` clauses in finance and dashboard routes
**When to use:** Any list/aggregate query that returns case-related data
**Example:**
```typescript
// src/app/api/finanzen/rechnungen/route.ts -- current (broken)
const where: Record<string, any> = {};
// ... filter conditions

// After fix:
import { requireAuth, buildAkteAccessFilter } from "@/lib/rbac";

const authResult = await requireAuth();
if (authResult.error) return authResult.error;
const { session } = authResult;

const accessFilter = buildAkteAccessFilter(session.user.id, session.user.role);
// Apply access filter to akte relation
const where: Record<string, any> = {
  akte: accessFilter, // Only invoices for accessible cases
};
```

### Pattern 2: Versand-Gate Integration
**What:** Call `checkDokumenteFreigegeben()` before queuing email send or beA send
**When to use:** Any send operation that includes document attachments
**Example:**
```typescript
// In email-send route, before queuing:
import { checkDokumenteFreigegeben } from "@/lib/versand-gate";

if (data.anhaenge.length > 0) {
  const check = await checkDokumenteFreigegeben(data.anhaenge);
  if (!check.ok) {
    return Response.json(
      { error: "ENTWURF-Dokumente koennen nicht gesendet werden", details: check.errors },
      { status: 400 }
    );
  }
}
```

### Pattern 3: beA Audit Logging
**What:** Call `logAuditEvent()` at the end of each beA route handler with detailed beA-specific metadata
**When to use:** Every beA API route (POST, PATCH, GET for message detail)
**Example:**
```typescript
// After successful beA operation:
await logAuditEvent({
  userId: session.user.id,
  akteId: nachricht.akteId,
  aktion: "BEA_NACHRICHT_GESENDET" as any,
  details: {
    nachrichtId: nachricht.id,
    betreff: nachricht.betreff,
    empfaengerSafeId: nachricht.safeIdEmpfaenger,
    anhaengeAnzahl: attachments.length,
    ergebnis: "ERFOLG",
  },
});
```

### Pattern 4: PRAKTIKANT Removal
**What:** Remove the PRAKTIKANT value from UserRole enum, all permission checks, UI references, and seed data
**When to use:** Single migration + code cleanup
**Steps:**
1. Prisma schema: Remove `PRAKTIKANT` from `UserRole` enum
2. Migration: Convert any existing PRAKTIKANT users to SACHBEARBEITER (safe default)
3. `src/lib/rbac.ts`: Remove PRAKTIKANT from PERMISSIONS, ROLE_LABELS, requireAkteAccess PRAKTIKANT check
4. `src/components/layout/sidebar.tsx`: Remove all `hideForRoles: ["PRAKTIKANT"]` entries
5. All API routes: Remove PRAKTIKANT-specific checks
6. `src/app/api/admin/rollen/route.ts`: Remove from roles array

### Pattern 5: KPI Key Alignment
**What:** Fix the API response keys to match what the frontend reads, or vice versa
**Current mismatch:**
- Frontend reads: `invoiceData.stats.gesamtUmsatz`, `stats.offeneForderungen`, `stats.ueberfaellig`
- API returns: `summary.offeneForderungen`, `summary.ueberfaelligCount`
- Frontend reads: `aktenkontoData.fremdgeldAlerts`
- API aktenkonto (cross-case GET) returns: `summary.fremdgeld` (no fremdgeldAlerts at top level)

**Fix approach:** Align the API response to include a `stats` key matching the frontend expectations, OR update the frontend to read the correct keys from the actual API response.

### Pattern 6: Kanzleiweite Finanzen Flag
**What:** Add `canSeeKanzleiFinanzen` boolean field to User model for ANWALT users
**When to use:** Finance API routes check this flag to decide whether to apply `buildAkteAccessFilter()` or return all data
**Implementation:**
```typescript
// In Prisma schema User model:
canSeeKanzleiFinanzen Boolean @default(false)

// In finance routes:
const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { canSeeKanzleiFinanzen: true } });
const showKanzleiweit = session.user.role === 'ADMIN' || (session.user.role === 'ANWALT' && user?.canSeeKanzleiFinanzen);
const akteFilter = showKanzleiweit ? {} : buildAkteAccessFilter(session.user.id, session.user.role);
```

### Anti-Patterns to Avoid
- **Inline role checks instead of helpers:** Use `requireAuth()` / `requirePermission()` / `buildAkteAccessFilter()`, never raw `session.user.role === 'X'` checks for new code
- **Swallowing audit log errors:** Always fire-and-forget with `.catch(() => {})`, but never skip the audit call entirely
- **Frontend-only RBAC:** Always enforce on API side first, hide in UI second

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Permission checking | Custom if/else per route | `requirePermission()` from rbac.ts | Consistent audit logging on denial |
| Akte access filtering | Manual joins per query | `buildAkteAccessFilter()` | Handles direct + Dezernat + AdminOverride paths |
| Document send validation | Custom status checks | `checkDokumenteFreigegeben()` | Already handles missing docs, wrong status, missing approver |
| Audit logging | Custom prisma.auditLog.create | `logAuditEvent()` | Standardized shape, handles nulls |

**Key insight:** Every building block already exists. The only work is calling existing functions from the right places.

## Common Pitfalls

### Pitfall 1: Nested Akte Filter in Finance Queries
**What goes wrong:** Finance routes query `prisma.rechnung.findMany()` not `prisma.akte.findMany()`, so the access filter must be applied to the nested `akte` relation, not the top-level `where`.
**Why it happens:** `buildAkteAccessFilter()` returns a filter for the Akte model, but finance models (Rechnung, AktenKontoBuchung) have an `akte` relation.
**How to avoid:** Apply filter as `where: { akte: accessFilter }` for Rechnung queries, and `where: { ...accessFilter }` for direct Akte queries.
**Warning signs:** Users seeing all invoices regardless of Akte assignment.

### Pitfall 2: PRAKTIKANT Migration Safety
**What goes wrong:** Removing enum value from Prisma schema while rows still reference it causes migration failure.
**Why it happens:** PostgreSQL rejects removing an enum value if any row uses it.
**How to avoid:** Migration must first UPDATE users SET role = 'SACHBEARBEITER' WHERE role = 'PRAKTIKANT', THEN alter the enum.
**Warning signs:** Migration error about enum value in use.

### Pitfall 3: Aggregate Queries Ignoring Access Filter
**What goes wrong:** Finance summary stats (aggregate queries) don't respect the same access filter as list queries.
**Why it happens:** Developer applies filter to `findMany` but forgets to apply same filter to `aggregate` and `count` calls.
**How to avoid:** Extract the `where` clause into a variable and reuse it for ALL queries: list, count, and aggregate.
**Warning signs:** KPI cards show kanzlei-wide totals even for non-admin users.

### Pitfall 4: beA Audit Action Types Missing from Union
**What goes wrong:** TypeScript error when using new audit action strings like `BEA_NACHRICHT_GESENDET`.
**Why it happens:** The `AuditAktion` type union in audit.ts doesn't include beA-specific actions.
**How to avoid:** Add all beA audit actions to the `AuditAktion` type AND to `AKTION_LABELS` map simultaneously.
**Warning signs:** `as any` casts needed on aktion field.

### Pitfall 5: Frontend KPI Key Mismatch
**What goes wrong:** Finance overview page shows 0 for all KPI values.
**Why it happens:** Frontend reads `invoiceData.stats.X` but API returns `summary.Y` with different key names.
**How to avoid:** Always check both API response shape AND frontend consumption code when fixing KPI display.
**Warning signs:** KPIs stuck at 0 or "..." loading state.

### Pitfall 6: Email Send Anhaenge Are String IDs Not Dokument IDs
**What goes wrong:** Versand-Gate check fails because `data.anhaenge` contains file upload IDs, not Dokument IDs.
**Why it happens:** Email compose attachments can come from two sources: DMS documents (have `dms-{dokumentId}` prefixed IDs) or direct uploads (have `upload-{random}` IDs). Only DMS documents need the Versand-Gate check.
**How to avoid:** Filter `anhaenge` to only those with `source === 'dms'`, extract the document ID from `dms-{id}` format, then pass to `checkDokumenteFreigegeben()`.
**Warning signs:** Versand-Gate blocks all attachments or allows all.

## Code Examples

### Example 1: Finance Route with buildAkteAccessFilter
```typescript
// Rechnungen list with access filtering
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  // Determine access scope
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { canSeeKanzleiFinanzen: true },
  });

  const showAll = session.user.role === "ADMIN" ||
    (session.user.role === "ANWALT" && user?.canSeeKanzleiFinanzen);

  const akteFilter = showAll ? {} : buildAkteAccessFilter(session.user.id, session.user.role);
  const where: Record<string, any> = { akte: akteFilter };

  // ... existing filter logic applied ON TOP of access filter
  if (status) where.status = status;
  // etc.
}
```

### Example 2: Dashboard with User-Scoped Queries
```typescript
// Dashboard: user-scoped counts
const accessFilter = buildAkteAccessFilter(userId, userRole);

const offeneAkten = await prisma.akte.count({
  where: { status: "OFFEN", ...accessFilter },
});

const fristenHeute = await prisma.kalenderEintrag.count({
  where: {
    erledigt: false,
    typ: "FRIST",
    datum: { gte: today, lt: tomorrow },
    akte: accessFilter,
  },
});
```

### Example 3: beA Audit Logging
```typescript
// New beA audit actions added to audit.ts:
export type AuditAktion =
  | /* ...existing actions... */
  | "BEA_NACHRICHT_GESENDET"
  | "BEA_NACHRICHT_EMPFANGEN"
  | "BEA_EEB_BESTAETIGT"
  | "BEA_NACHRICHT_GELESEN"
  | "BEA_ZUORDNUNG_GEAENDERT";

// In beA route:
logAuditEvent({
  userId: session.user.id,
  akteId: nachricht.akteId,
  aktion: "BEA_NACHRICHT_GESENDET",
  details: {
    nachrichtId: nachricht.id,
    betreff: data.betreff,
    empfaengerSafeId: data.safeIdEmpfaenger,
    anhaengeAnzahl: (data.anhaenge || []).length,
    ergebnis: "ERFOLG",
  },
}).catch(() => {});
```

### Example 4: Versand-Gate in Email Send
```typescript
// In POST /api/email-send before queuing:
// Extract DMS document IDs from anhaenge
const dmsDocIds = data.anhaenge
  .filter((id: string) => id.startsWith("dms-"))
  .map((id: string) => id.replace("dms-", ""));

if (dmsDocIds.length > 0) {
  const check = await checkDokumenteFreigegeben(dmsDocIds);
  if (!check.ok) {
    return Response.json(
      { error: "Nicht freigegebene Dokumente koennen nicht versendet werden", details: check.errors },
      { status: 400 }
    );
  }
}
```

### Example 5: Attach Dialog with ENTWURF Greyed Out
```typescript
// In document picker, fetch ALL documents (not just FREIGEGEBEN)
// Display ENTWURF docs greyed out with status badge
{docs.map((doc) => {
  const isEntwurf = doc.status === "ENTWURF" || doc.status === "ZUR_PRUEFUNG";
  return (
    <div key={doc.id} className={isEntwurf ? "opacity-50 cursor-not-allowed" : ""}>
      <span>{doc.name}</span>
      {isEntwurf && (
        <>
          <span className="text-xs text-amber-500">Noch nicht freigegeben</span>
          <button onClick={() => quickRelease(doc.id)}>Freigeben</button>
        </>
      )}
      {!isEntwurf && (
        <button onClick={() => onSelect(doc)}>Anhaengen</button>
      )}
    </div>
  );
})}
```

## Codebase Inventory

### Files That Need RBAC Wiring (buildAkteAccessFilter)

| File | Current Auth | Needed Change |
|------|-------------|---------------|
| `src/app/api/finanzen/rechnungen/route.ts` (GET) | `auth()` only | Add `buildAkteAccessFilter` to `where.akte` |
| `src/app/api/finanzen/rechnungen/route.ts` (POST) | `auth()` only | Verify Akte access before creating invoice |
| `src/app/api/finanzen/rechnungen/[id]/route.ts` (GET/PATCH/DELETE) | `auth()` only | Add `requireAkteAccess` for single invoice |
| `src/app/api/finanzen/aktenkonto/route.ts` (GET) | `auth()` only | Add `buildAkteAccessFilter` to `where.akte` |
| `src/app/api/finanzen/aktenkonto/[akteId]/route.ts` (GET/POST) | `auth()` + PRAKTIKANT check | Replace with `requireAkteAccess(akteId)` |
| `src/app/api/finanzen/zeiterfassung/route.ts` | `auth()` only | Add access filter for akteId queries |
| `src/app/api/finanzen/buchungsperioden/route.ts` | `auth()` only | ADMIN-only route; verify |
| `src/app/api/finanzen/kostenstellen/route.ts` | `auth()` only | ADMIN-only for write; read may need filter |
| `src/app/(dashboard)/dashboard/page.tsx` | `auth()` only | Add user-scoped Prisma queries |

### Files That Need beA Audit Logging

| File | Existing RBAC | Audit Actions Needed |
|------|-------------|---------------------|
| `src/app/api/bea/messages/route.ts` (GET) | `requirePermission("canReadBeA")` | Log message list access (optional) |
| `src/app/api/bea/messages/route.ts` (POST) | `requirePermission("canSendBeA")` | `BEA_NACHRICHT_EMPFANGEN` or `BEA_NACHRICHT_GESENDET` based on status |
| `src/app/api/bea/messages/[id]/route.ts` (GET) | `requirePermission("canReadBeA")` | `BEA_NACHRICHT_GELESEN` |
| `src/app/api/bea/messages/[id]/route.ts` (PATCH) | `requirePermission("canSendBeA")` | `BEA_ZUORDNUNG_GEAENDERT` |
| `src/app/api/bea/messages/[id]/eeb/route.ts` (POST) | `requireRole("ANWALT", "ADMIN")` | `BEA_EEB_BESTAETIGT` |
| `src/app/api/bea/auto-assign/route.ts` (POST) | `requirePermission("canReadBeA")` | `BEA_ZUORDNUNG_GEAENDERT` |

### Files That Need PRAKTIKANT Removal

| File | PRAKTIKANT Reference | Change |
|------|---------------------|--------|
| `prisma/schema.prisma` | `UserRole` enum | Remove PRAKTIKANT value |
| `src/lib/rbac.ts` | PERMISSIONS[PRAKTIKANT], ROLE_LABELS, requireAkteAccess | Remove all PRAKTIKANT entries |
| `src/components/layout/sidebar.tsx` | `hideForRoles: ["PRAKTIKANT"]` x3 | Remove hideForRoles arrays (or keep only for SEKRETARIAT) |
| `src/app/api/admin/rollen/route.ts` | roles array | Remove PRAKTIKANT from array |
| `src/app/api/ki-entwuerfe/route.ts` | PRAKTIKANT check | Remove PRAKTIKANT-specific block |
| `src/app/api/finanzen/aktenkonto/[akteId]/route.ts` | PRAKTIKANT read-only | Remove PRAKTIKANT check |
| `src/app/api/dokumente/[id]/route.ts` | Blocks PRAKTIKANT | Update comment |
| `src/app/api/akten/route.ts` | PRAKTIKANT cannot create | Remove check |
| `src/app/api/akten/[id]/dokumente/route.ts` | PRAKTIKANT blocked from uploads | Remove check |
| `src/app/api/bea/messages/route.ts` | canReadBeA blocks PRAKTIKANT (comment) | Update comment |
| `src/app/api/bea/messages/[id]/route.ts` | canReadBeA blocks PRAKTIKANT (comment) | Update comment |
| `src/app/api/bea/auto-assign/route.ts` | canReadBeA blocks PRAKTIKANT (comment) | Update comment |

### KPI Key Mismatches (Finance Overview)

| Frontend Reads | API Returns | Fix |
|---------------|-------------|-----|
| `invoiceData.stats` | `invoiceData.summary` | Rename API key or frontend key |
| `stats.gesamtUmsatz` | No gesamtUmsatz field | Add gesamtUmsatz calculation to API |
| `stats.offeneForderungen` | `summary.offeneForderungen` | Key name alignment |
| `stats.ueberfaellig` | `summary.ueberfaelligCount` | Key name alignment |
| `aktenkontoData.fremdgeldAlerts` | No fremdgeldAlerts on cross-case route | Add fremdgeld alerts to cross-case aktenkonto API |

### Versand-Gate Integration Points

| Send Flow | File | Current State | Needed |
|-----------|------|---------------|--------|
| Email compose send | `src/app/api/email-send/route.ts` | No doc check | Add `checkDokumenteFreigegeben()` for DMS attachments |
| beA compose send | `src/components/bea/bea-compose.tsx` | Client-side only fetches FREIGEGEBEN docs | Add server-side check in POST /api/bea/messages |
| Email attach dialog | `src/components/email/compose-attachments.tsx` | Shows all docs | Show ENTWURF greyed out with Quick-Release |
| beA attach dialog | `src/components/bea/bea-compose.tsx` (DocumentPicker) | Only fetches FREIGEGEBEN | Show ENTWURF greyed out with Quick-Release |

### Prisma Migration Requirements

1. **Remove PRAKTIKANT from UserRole enum**
   - Must first UPDATE all PRAKTIKANT users to SACHBEARBEITER
   - Then ALTER TYPE to remove the value

2. **Add canSeeKanzleiFinanzen to User model**
   - New Boolean field, default false
   - Only meaningful for ANWALT role

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw `auth()` check | `requireAuth()` / `requirePermission()` | Phase 7 | All new routes should use rbac helpers |
| PRAKTIKANT in 5-role system | 4-role system (ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT) | Phase 8 (this) | Simplifies RBAC matrix |

## Open Questions

1. **Email send `anhaenge` format**
   - What we know: The `sendSchema` defines `anhaenge` as `z.array(z.string())` -- these are "File IDs from DMS or uploaded"
   - What's unclear: The exact ID format for DMS documents vs uploads in the send payload (the compose component uses `id` with `dms-` or `upload-` prefix but sends to API as string array)
   - Recommendation: Examine the compose-popup.tsx to trace how attachment IDs are passed to the send API. The Versand-Gate should check any DMS-source attachment IDs.

2. **Dashboard page is server-rendered**
   - What we know: `src/app/(dashboard)/dashboard/page.tsx` is an async server component calling Prisma directly
   - What's unclear: The `auth()` call in server components returns session but may not include role in all contexts
   - Recommendation: Ensure `session.user.role` is available (it is, since NextAuth is configured to include it). Apply `buildAkteAccessFilter` to all Prisma queries in the page.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files listed above
- `src/lib/rbac.ts` -- existing RBAC helper implementations
- `src/lib/versand-gate.ts` -- existing document approval check
- `src/lib/audit.ts` -- existing audit logging infrastructure
- `prisma/schema.prisma` -- current schema state

### Secondary (MEDIUM confidence)
- Prisma migration patterns for enum removal (standard Prisma practice, well-documented)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all code already exists
- Architecture: HIGH -- wiring existing helpers, patterns are established in codebase
- Pitfalls: HIGH -- identified from direct code analysis, key mismatches are concrete

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (30 days -- stable, no external dependencies)
