---
phase: 08-integration-hardening
verified: 2026-02-25T14:00:00Z
status: gaps_found
score: 14/15 must-haves verified
re_verification: null
gaps:
  - truth: "Pruefprotokoll tab in Akte detail shows chronological beA audit log queried from prisma.auditLog"
    status: failed
    reason: "The historie API route assigns where.aktion = aktion (a raw comma-separated string) instead of where.aktion = { in: aktion.split(',') }. Prisma performs an exact-match against the literal string 'BEA_NACHRICHT_GESENDET,BEA_NACHRICHT_EMPFANGEN,...' and returns zero rows. The Pruefprotokoll tab will always show 'Keine beA-Aktivitaeten' regardless of how many beA events exist."
    artifacts:
      - path: "src/app/api/akten/[id]/historie/route.ts"
        issue: "Line 23: where.aktion = aktion assigns the raw comma-separated query-param string. Must be: const aktionen = aktion.split(',').map(s => s.trim()).filter(Boolean); where.aktion = aktionen.length === 1 ? aktionen[0] : { in: aktionen };"
    missing:
      - "Split the aktion query param on commas and use Prisma { in: [...] } filter when multiple values are present"
human_verification: null
---

# Phase 08: Integration Hardening Verification Report

**Phase Goal:** All cross-phase integration gaps from the 5th milestone audit are closed -- RBAC enforcement covers finance, ki-chat, and dashboard routes; Versand-Gate prevents sending ENTWURF documents; beA operations are audit-logged; and Finance KPI dashboard displays correct data.
**Verified:** 2026-02-25T14:00:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PRAKTIKANT role no longer exists -- UserRole enum has exactly 4 values | VERIFIED | `prisma/schema.prisma` lines 14-19: enum UserRole { ADMIN ANWALT SACHBEARBEITER SEKRETARIAT } |
| 2 | canSeeKanzleiFinanzen Boolean field exists on User model with default false | VERIFIED | `prisma/schema.prisma` line 388: `canSeeKanzleiFinanzen Boolean @default(false)` |
| 3 | No PRAKTIKANT references remain in active TypeScript source | VERIFIED | Grep across `src/**/*.ts` and `src/**/*.tsx` returns zero matches |
| 4 | RBAC PERMISSIONS constant has 4 role entries, not 5 | VERIFIED | `src/lib/rbac.ts` lines 21-66: exactly 4 keys (ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT) |
| 5 | Sidebar nav items no longer reference PRAKTIKANT in hideForRoles arrays | VERIFIED | `src/components/layout/sidebar.tsx`: only SEKRETARIAT appears in hideForRoles |
| 6 | Finance API routes enforce Akte-level access via buildAkteAccessFilter | VERIFIED | `rechnungen/route.ts`, `aktenkonto/route.ts`, `zeiterfassung/route.ts` all import and apply buildAkteAccessFilter |
| 7 | ADMIN sees kanzlei-wide; ANWALT with canSeeKanzleiFinanzen=true sees kanzlei-wide | VERIFIED | `rechnungen/route.ts` lines 54-63: canSeeKanzleiFinanzen lookup with showKanzleiweit boolean |
| 8 | Dashboard Prisma queries are user-scoped with accessFilter | VERIFIED | `dashboard/page.tsx` lines 22-80: all 6 Prisma queries apply accessFilter via akte relation |
| 9 | Finance KPI cards display correct values -- API stats key matches frontend | VERIFIED | `rechnungen/route.ts` response has `stats: { gesamtUmsatz, offeneForderungen, ueberfaellig }`; `finanzen/page.tsx` reads `invoiceData.stats` |
| 10 | SEKRETARIAT/SACHBEARBEITER see only operative KPIs; ANWALT/ADMIN see Gesamtumsatz | VERIFIED | `finanzen/page.tsx` lines 38, 103: canSeeAllKpis gates Gesamtumsatz KPI card |
| 11 | ENTWURF documents cannot be sent via email -- checkDokumenteFreigegeben returns 400 | VERIFIED | `email-send/route.ts` lines 6, 68-82: filters dms- attachments, calls checkDokumenteFreigegeben, returns 400 on failure |
| 12 | ENTWURF documents cannot be sent via beA -- same gate returns 400 | VERIFIED | `bea/messages/route.ts` lines 8, 98-110: Versand-Gate check on dokumentIds before creating beA message |
| 13 | All beA API operations create audit log entries via logAuditEvent | VERIFIED | `bea/messages/route.ts:216`, `bea/messages/[id]/route.ts:41,59,133`, `bea/messages/[id]/eeb/route.ts:48`, `bea/auto-assign/route.ts:65`, `kontakte/[id]/route.ts:187` all call logAuditEvent with beA action types |
| 14 | 8 beA-specific audit action types defined in audit.ts with German labels | VERIFIED | `src/lib/audit.ts` lines 55-62: BEA_NACHRICHT_GESENDET, BEA_NACHRICHT_EMPFANGEN, BEA_EEB_BESTAETIGT, BEA_NACHRICHT_GELESEN, BEA_ZUORDNUNG_GEAENDERT, BEA_ANHANG_HERUNTERGELADEN, BEA_SAFEID_GEAENDERT, BEA_POSTFACH_GEWECHSELT all present with German AKTION_LABELS |
| 15 | Pruefprotokoll tab shows chronological beA audit log from auditLog | FAILED | `akte-detail-tabs.tsx` BeaPruefprotokoll passes comma-separated aktion list to `?aktion=...` query param. The `historie` route at `src/app/api/akten/[id]/historie/route.ts` line 23 assigns `where.aktion = aktion` (raw string), not `{ in: [...] }`. Prisma exact-matches the literal comma-separated string -- returns 0 rows. Pruefprotokoll always shows empty state. |

**Score:** 14/15 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | UserRole enum without PRAKTIKANT; canSeeKanzleiFinanzen field | VERIFIED | Lines 14-19 (enum), line 388 (field) |
| `prisma/migrations/20260225120000_remove_praktikant_add_kanzleifinanz/migration.sql` | Safe migration: UPDATE users, ALTER enum, ADD column | VERIFIED | UPDATE "users" -> SACHBEARBEITER, CREATE TYPE UserRole_new, ALTER column, ADD COLUMN canSeeKanzleiFinanzen |
| `src/lib/rbac.ts` | PERMISSIONS without PRAKTIKANT; ROLE_LABELS with 4 roles | VERIFIED | 4-role PERMISSIONS object, 4-role ROLE_LABELS map |
| `src/app/api/finanzen/rechnungen/route.ts` | GET with buildAkteAccessFilter on akte relation; stats key in response | VERIFIED | Lines 8, 63 (filter); lines 169-173 (stats key) |
| `src/app/(dashboard)/dashboard/page.tsx` | User-scoped Prisma queries with access filter | VERIFIED | All 6 queries use accessFilter via akte relation |
| `src/app/(dashboard)/finanzen/page.tsx` | Role-based KPI visibility; reads stats key from API | VERIFIED | canSeeAllKpis gates Gesamtumsatz; reads invoiceData.stats |
| `src/lib/audit.ts` | 8 beA AuditAktion types: BEA_NACHRICHT_GESENDET, etc. | VERIFIED | Lines 55-62 type union; lines 120-127 AKTION_LABELS |
| `src/app/api/email-send/route.ts` | Versand-Gate check for DMS attachments | VERIFIED | Lines 6, 68-82: dms- prefix filter + checkDokumenteFreigegeben call + 400 response |
| `src/app/api/bea/messages/route.ts` | Versand-Gate on POST + logAuditEvent | VERIFIED | Lines 8-9 imports; lines 98-110 gate; line 216 audit log |
| `src/app/api/bea/messages/[id]/route.ts` | BEA_NACHRICHT_GELESEN + BEA_ANHANG_HERUNTERGELADEN audit | VERIFIED | Lines 41-51 (GELESEN), lines 59-71 (?download param handling) |
| `src/app/api/kontakte/[id]/route.ts` | BEA_SAFEID_GEAENDERT audit on PATCH | VERIFIED | Lines 179-198: detects beaSafeId change, calls logAuditEvent |
| `src/components/akten/akte-detail-tabs.tsx` (Pruefprotokoll) | Pruefprotokoll tab with beA audit timeline | STUB | Tab exists with BeaPruefprotokoll component and correct UI rendering (line 184, 363-365, 760+), but the underlying API call is broken -- see Truth 15 |
| `src/components/bea/bea-compose.tsx` | ENTWURF greyed out with Quick-Release | VERIFIED | Lines 531-669: all documents fetched, ENTWURF greyed with opacity-50 and Quick-Release button |
| `src/components/email/email-compose-view.tsx` | ENTWURF greyed out with Quick-Release | VERIFIED | Lines 347-479: same pattern as bea-compose |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `prisma/schema.prisma` | `src/lib/rbac.ts` | UserRole enum values match PERMISSIONS keys | VERIFIED | Both have exactly: ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT |
| `src/lib/rbac.ts` | `src/components/layout/sidebar.tsx` | hideForRoles references valid role names | VERIFIED | Only SEKRETARIAT remains in hideForRoles array |
| `src/app/api/finanzen/rechnungen/route.ts` | `src/lib/rbac.ts` | import buildAkteAccessFilter | VERIFIED | Line 8: `import { requireAuth, requireAkteAccess, buildAkteAccessFilter } from '@/lib/rbac'` |
| `src/app/(dashboard)/dashboard/page.tsx` | `src/lib/rbac.ts` | import buildAkteAccessFilter | VERIFIED | Line 4: `import { buildAkteAccessFilter } from "@/lib/rbac"` |
| `src/app/api/finanzen/rechnungen/route.ts` | prisma.user | canSeeKanzleiFinanzen lookup | VERIFIED | Lines 54-57: findUnique with canSeeKanzleiFinanzen select |
| `src/app/(dashboard)/finanzen/page.tsx` | `/api/finanzen/rechnungen` | fetch reads stats key from API response | VERIFIED | Line 56: `const stats = invoiceData.stats` |
| `src/app/api/email-send/route.ts` | `src/lib/versand-gate.ts` | import checkDokumenteFreigegeben | VERIFIED | Line 6: `import { checkDokumenteFreigegeben } from "@/lib/versand-gate"` |
| `src/app/api/bea/messages/route.ts` | `src/lib/versand-gate.ts` | import checkDokumenteFreigegeben | VERIFIED | Line 8: `import { checkDokumenteFreigegeben } from "@/lib/versand-gate"` |
| `src/app/api/bea/messages/route.ts` | `src/lib/audit.ts` | import logAuditEvent | VERIFIED | Line 9: `import { logAuditEvent } from "@/lib/audit"` |
| `src/app/api/bea/messages/[id]/route.ts` | `src/lib/audit.ts` | import logAuditEvent for BEA_NACHRICHT_GELESEN and BEA_ANHANG_HERUNTERGELADEN | VERIFIED | Line 5: import; Lines 41-71: both actions logged |
| `src/app/api/kontakte/[id]/route.ts` | `src/lib/audit.ts` | import logAuditEvent for BEA_SAFEID_GEAENDERT | VERIFIED | Line 5: import; Line 189: BEA_SAFEID_GEAENDERT action used |
| `src/components/akten/akte-detail-tabs.tsx` | `src/app/api/akten/[id]/historie` | auditLog query with beA aktion filter | FAILED | Component calls `/api/akten/${akteId}/historie?aktion=BEA_NACHRICHT_GESENDET,BEA_NACHRICHT_EMPFANGEN,...` but the route does `where.aktion = aktion` (string assignment), not `where.aktion = { in: aktionen }`. No beA audit entries will ever be returned. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|-------------|-------------|--------|---------|
| REQ-RS-001 | 08-01 | Akten-Zugriff: Persoenlich + Gruppen/Dezernate + Admin-Override | SATISFIED | buildAkteAccessFilter applies personal/group/admin-override logic; used in finance routes and dashboard |
| REQ-RS-002 | 08-01 | SEKRETARIAT als eingeschraenkter Sachbearbeiter (kein Freigeben) | SATISFIED | PERMISSIONS.SEKRETARIAT.canFreigeben = false in rbac.ts; sidebar hides Einstellungen for SEKRETARIAT |
| REQ-RS-003 | 08-01 | PRAKTIKANT: Nur Lesen + Entwerfe erstellen (zugewiesene Akten) | SATISFIED (by elimination) | PRAKTIKANT role removed entirely per user decision; REQ-RS-003 obsoleted -- all TypeScript source clean of PRAKTIKANT references |
| REQ-RS-004 | 08-03 | Systemweiter Audit-Trail (Wer/Wann/Was -- Admin-Ansicht + pro Akte) | PARTIALLY SATISFIED | 8 beA audit types defined; logAuditEvent called in all beA routes and kontakte PATCH; Pruefprotokoll tab UI exists but beA filter query is broken due to aktion comma-split bug |
| REQ-KI-003 | 08-03 | Akten-spezifischer Document Chat (Fragen an Dokumente einer Akte) | SATISFIED | `/api/ki-chat/route.ts` uses `auth()` only (no role restriction); confirmed canUseKI not referenced in ki-chat or helena routes |
| REQ-KI-009 | 08-03 | KI-Entwurf-Workflow: Jedes KI-Ergebnis = ENTWURF, explizite Freigabe durch Mensch | SATISFIED | Versand-Gate blocks ENTWURF documents from being sent via both email and beA; ENTWURF greyed out in attach dialogs with Quick-Release; checkDokumenteFreigegeben requires freigegebenDurchId to be set |
| REQ-FI-003 | 08-02 | Rechnungen: DB-Model, Nummernkreis, Status-Flow | SATISFIED | Finance routes with RBAC access filter; rechnungen route provides gesamtUmsatz, offeneForderungen, ueberfaellig counts |
| REQ-FI-005 | 08-02 | Aktenkonto: Buchungen, Saldo, Beleg-Verknuepfung | SATISFIED | aktenkonto route uses buildAkteAccessFilter; fremdgeldAlerts returned in cross-case response |
| REQ-FI-006 | 08-02 | Fremdgeld-Compliance: 5-Werktage-Weiterleitungswarnung, separate Anzeige | SATISFIED | fremdgeldAlerts computed in aktenkonto route; finanzen/page.tsx shows Fremdgeld-Warnungen count for all roles |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/api/akten/[id]/historie/route.ts` | 23 | `where.aktion = aktion` with comma-separated string | BLOCKER | Pruefprotokoll ALWAYS returns 0 rows; beA audit history is unreachable through the Pruefprotokoll tab. The tab renders the UI correctly but no data is ever displayed. |

### Gaps Summary

**1 critical gap blocking full goal achievement:**

The Pruefprotokoll tab exists as a complete UI component in `akte-detail-tabs.tsx` with correct rendering logic, error highlighting, action labels, and icons. However, the underlying API query is broken.

The component fetches:
```
/api/akten/${akteId}/historie?aktion=BEA_NACHRICHT_GESENDET,BEA_NACHRICHT_EMPFANGEN,BEA_EEB_BESTAETIGT,BEA_NACHRICHT_GELESEN,BEA_ZUORDNUNG_GEAENDERT,BEA_ANHANG_HERUNTERGELADEN&take=100
```

The `histoire` route at `src/app/api/akten/[id]/historie/route.ts` handles this with:
```typescript
const aktion = searchParams.get("aktion"); // "BEA_NACHRICHT_GESENDET,BEA_NACHRICHT_EMPFANGEN,..."
if (aktion) {
  where.aktion = aktion; // exact string match in Prisma -- will never find any record
}
```

**Fix required** (one-line change in `src/app/api/akten/[id]/historie/route.ts`):
```typescript
if (aktion) {
  const aktionen = aktion.split(",").map((s) => s.trim()).filter(Boolean);
  where.aktion = aktionen.length === 1 ? aktionen[0] : { in: aktionen };
}
```

All other goals are fully achieved:
- Role simplification (PRAKTIKANT removal) is complete and clean
- Finance RBAC is properly enforced with buildAkteAccessFilter across all 7 finance routes and dashboard
- KPI key alignment is correct (stats key matches frontend consumption)
- Role-based KPI visibility works correctly
- Versand-Gate blocks ENTWURF documents in both email and beA send flows
- ENTWURF greyed-out UI with Quick-Release is implemented in both compose components
- All 8 beA audit action types are defined and used throughout beA routes
- Safe-ID change audit logging is wired in kontakte PATCH
- KI-Chat routes require only authentication with no role restriction

---

_Verified: 2026-02-25T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
