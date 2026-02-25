# Phase 7: Rollen/Sicherheit + Compliance + Observability - Research

**Researched:** 2026-02-25
**Domain:** RBAC enforcement, audit trail UI, DSGVO compliance, observability
**Confidence:** HIGH

## Summary

Phase 7 applies a security and compliance layer to all existing features (Phases 1-6). The codebase already has the foundational pieces: NextAuth v5 with JWT-based sessions carrying `UserRole` (5 roles defined), an `AuditLog` model with `logAuditEvent()` used across 25+ API routes, a Pino logger with JSON Lines output, and a health check endpoint monitoring 6 services. What is missing is: (1) a `Dezernat` entity for group-based case access, (2) `requireRole()` / `requireAkteAccess()` helper functions enforced across ~90 API routes, (3) role-based sidebar filtering, (4) a system-wide Audit-Trail UI (timeline/activity stream), (5) DSGVO anonymization workflow and Auskunftsrecht PDF export, and (6) extended health checks for Ollama and Stirling-PDF.

The primary risk is the breadth of enforcement -- every Akte-related API route must be retrofitted with access checks, and the sidebar/UI must hide features per role. The approach should be: build reusable helper functions first, then systematically apply them.

**Primary recommendation:** Build `requireRole()` and `requireAkteAccess()` as thin server-side helpers that wrap existing `auth()` calls, create the Dezernat schema entity, then systematically apply enforcement across all API routes and UI components.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 404 Not Found on unauthorized Akte access (hide existence entirely)
- Lists/search only show authorized Akten (no lock icons, no visibility of restricted items)
- Rollenbasierte Sidebar: navigation items hidden for roles without access (PRAKTIKANT sees no Einstellungen, no Admin)
- Finanzdaten visible for all roles with Akte access (no separate finance RBAC)
- Dezernat as real DB entity in Prisma (not tag-based): Name, Mitglieder (Users), zugewiesene Akten
- Admin manages Dezernate in Einstellungen
- Akte access: personal assignment OR Dezernat membership OR explicit Admin-Override
- Explicit "Zugriff uebernehmen" button for Admin (not automatic visibility)
- Admin-Override logged in Audit-Trail with timestamp and reason
- Override grants temporary access to specific Akte
- Fixed Role Permission Matrix (no feature flags):
  - ADMIN: Full access to everything, explicit override for restricted Akten
  - ANWALT: Full access to assigned Akten + Dezernate, beA send + eEB, KI features
  - SACHBEARBEITER: Full access to assigned Akten + Dezernate, beA read-only, KI features
  - SEKRETARIAT: Like SACHBEARBEITER but NO Freigeben, NO Loeschen (documents, Akten)
  - PRAKTIKANT: Read-only + create Entwuerfe on assigned Akten (via direct assignment or Dezernat), NO KI features, NO beA
- beA: SACHBEARBEITER+ can read, only ANWALT can send/eEB
- Middleware for authentication check + role extraction
- requireRole() / requireAkteAccess() helper functions in API routes for granular checks
- Permission changes take effect immediately (live, not after re-login)
- Rollen-Matrix table in Einstellungen: rows = roles, columns = actions (read-only display)
- Per-User permission overview: shows all accessible Akten with access source (direkt, Dezernat, Admin-Override)
- System-wide: Timeline/Activity Stream format (not table) -- "Max Mustermann hat Akte 123/2026 geoeffnet" with avatars and grouping
- All events logged including read access (Akte geoeffnet, Dokument angesehen) -- comprehensive tracking
- Per-Akte: dedicated 'Historie' tab on Akte detail page
- Vorher/Nachher Diff for changed fields ("Status: OFFEN -> ARCHIVIERT")
- 10 Jahre Aufbewahrung (BRAO/GoBD), archiving of older entries
- Export: CSV + PDF for Behoerdenanfragen and internal audits
- Security section: highlighted failed logins, brute-force detection, unusual access patterns (red markers)
- Admin Dashboard widget: last 5-10 activities with link to full Audit-Trail
- NEVER delete data -- anonymization only (personenbezogene Daten replaced with "Geloeschter Mandant" etc.)
- 10-year retention period (Aufbewahrungspflicht) before anonymization can be requested
- Auskunftsrecht: PDF export per person -- all stored data (Kontaktdaten, Akten, Dokumente, E-Mails, Kalender, Buchungen)
- No Einwilligungsmanagement needed for v1 (processing based on Mandatsvertrag, Art. 6 Abs. 1 lit. b DSGVO)
- No Verarbeitungsverzeichnis in the software (maintained externally)
- Extend existing Admin System Health page with all Docker services: App, Worker, Redis, PostgreSQL, MinIO, Meilisearch, Ollama, OnlyOffice, Stirling-PDF -- Statusampel per service
- Public /api/health endpoint (unauthenticated): basic status (ok/degraded/down); detailed info only with admin auth
- Structured logging: JSON Lines on stdout -- standard for Docker, parsable with jq/Loki
- E-Mail alert to admins on service failure (using existing email system, with cooldown to prevent spam)

### Claude's Discretion
- Exact Dezernat UI design in Einstellungen
- Audit-Trail pagination/infinite-scroll strategy for large datasets
- JSON Lines logger implementation (Pino vs custom)
- Anonymization field-by-field strategy (which fields get anonymized, which kept)
- Security event detection thresholds (how many failed logins = suspicious)
- Health check polling interval
- Dashboard widget design

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-RS-001 | Akten-Zugriff: Persoenlich + Gruppen/Dezernate + Admin-Override | Dezernat schema entity + requireAkteAccess() helper + AdminOverride model; Prisma query patterns for multi-path access check |
| REQ-RS-002 | SEKRETARIAT als eingeschraenkter Sachbearbeiter (kein Freigeben) | Permission matrix constant + requireRole() helper; existing FREIGABE_ROLES pattern in dokumente routes already partially enforces this |
| REQ-RS-003 | PRAKTIKANT: Nur Lesen + Entwuerfe erstellen (zugewiesene Akten) | requireAkteAccess() + action-level permission check; sidebar filtering for navigation hiding |
| REQ-RS-004 | Systemweiter Audit-Trail (Wer/Wann/Was -- Admin-Ansicht + pro Akte) | Existing AuditLog model + logAuditEvent() function; new admin Audit-Trail page with timeline UI + per-Akte Historie tab (already has API route) |
| REQ-RS-005 | DSGVO: Loeschkonzept, Auskunftsrecht, Einwilligungsmanagement | Anonymization workflow (Prisma transaction to null/replace PII fields); Auskunftsrecht PDF export via pdf-lib; no Einwilligungsmanagement needed for v1 |
| REQ-RS-006 | Observability: Health-Checks (App/Ollama/Worker/Redis) + strukturierte Logs | Extend existing /api/health + admin system page; Pino already installed with JSON Lines; add Ollama + Stirling-PDF health checks; email alerts on failure |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | v5 | Authentication, JWT sessions with role | Already in use; session.user.role available |
| pino | latest | Structured JSON logging | Already installed and configured in src/lib/logger.ts |
| pino-pretty | latest (dev) | Development log formatting | Already in devDependencies |
| pino-roll | latest | Log file rotation in production | Already in dependencies |
| pdf-lib | v1.17.1 | PDF generation for exports | Already used for Rechnungs-PDF and Fristenzettel |
| @prisma/client | latest | Database ORM | Core data layer |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nodemailer | v7 | Email alerts for service failures | Already used for Frist reminders |
| date-fns | latest | Date formatting in audit trail | Already in dependencies |
| zod | latest | Input validation for new API routes | Already in dependencies |
| lucide-react | latest | Icons for audit trail and UI | Already in dependencies |

### No New Dependencies Needed
This phase requires **zero new npm packages**. Every library needed is already installed:
- Pino for logging (installed, configured)
- pdf-lib for PDF export (installed, patterns exist)
- nodemailer for email alerts (installed, patterns exist)
- All UI primitives from existing shadcn/ui components

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── auth.ts              # Existing NextAuth config (extend with role helpers)
│   ├── rbac.ts              # NEW: requireRole(), requireAkteAccess(), permission matrix
│   ├── audit.ts             # Existing (extend with read-access logging + new event types)
│   ├── logger.ts            # Existing Pino config (already JSON Lines in production)
│   ├── dsgvo/
│   │   ├── anonymize.ts     # NEW: Anonymization logic per entity type
│   │   └── auskunft.ts      # NEW: Auskunftsrecht PDF export
│   └── health/
│       └── checks.ts        # NEW: Extended health check functions (Ollama, Stirling-PDF)
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── audit-trail/route.ts    # NEW: System-wide audit trail API
│   │   │   └── dezernate/route.ts      # NEW: Dezernat CRUD
│   │   ├── dsgvo/
│   │   │   ├── anonymize/route.ts      # NEW: Anonymization request
│   │   │   └── auskunft/route.ts       # NEW: Auskunftsrecht export
│   │   └── health/route.ts             # Existing (extend with auth-gated details)
│   ├── (dashboard)/
│   │   ├── admin/
│   │   │   ├── audit-trail/page.tsx    # NEW: System-wide audit timeline
│   │   │   ├── dezernate/page.tsx      # NEW: Dezernat management
│   │   │   ├── rollen/page.tsx         # NEW: Rollen-Matrix + per-user overview
│   │   │   └── dsgvo/page.tsx          # NEW: DSGVO compliance tools
│   │   └── ...existing pages
│   └── middleware.ts                    # Existing (extend with role-based route protection)
└── components/
    ├── audit/
    │   ├── audit-timeline.tsx           # NEW: Timeline/activity stream component
    │   └── audit-export.tsx             # NEW: CSV/PDF export component
    └── admin/
        └── dezernat-dialog.tsx          # NEW: Dezernat CRUD dialog
```

### Pattern 1: RBAC Helper Functions
**What:** Centralized permission enforcement via composable helper functions
**When to use:** Every API route that touches Akte data or role-restricted operations

```typescript
// src/lib/rbac.ts

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

// Permission matrix -- code-defined, not configurable
export const PERMISSIONS: Record<UserRole, {
  canFreigeben: boolean;
  canLoeschen: boolean;
  canSendBeA: boolean;
  canReadBeA: boolean;
  canUseKI: boolean;
  canAccessAdmin: boolean;
  canAccessEinstellungen: boolean;
  canCreateAkte: boolean;
  canEditAkte: boolean;
}> = {
  ADMIN: {
    canFreigeben: true, canLoeschen: true, canSendBeA: true,
    canReadBeA: true, canUseKI: true, canAccessAdmin: true,
    canAccessEinstellungen: true, canCreateAkte: true, canEditAkte: true,
  },
  ANWALT: {
    canFreigeben: true, canLoeschen: true, canSendBeA: true,
    canReadBeA: true, canUseKI: true, canAccessAdmin: false,
    canAccessEinstellungen: true, canCreateAkte: true, canEditAkte: true,
  },
  SACHBEARBEITER: {
    canFreigeben: true, canLoeschen: true, canSendBeA: false,
    canReadBeA: true, canUseKI: true, canAccessAdmin: false,
    canAccessEinstellungen: true, canCreateAkte: true, canEditAkte: true,
  },
  SEKRETARIAT: {
    canFreigeben: false, canLoeschen: false, canSendBeA: false,
    canReadBeA: true, canUseKI: true, canAccessAdmin: false,
    canAccessEinstellungen: false, canCreateAkte: true, canEditAkte: true,
  },
  PRAKTIKANT: {
    canFreigeben: false, canLoeschen: false, canSendBeA: false,
    canReadBeA: false, canUseKI: false, canAccessAdmin: false,
    canAccessEinstellungen: false, canCreateAkte: false, canEditAkte: false,
  },
};

/** Get authenticated session or return 401 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: NextResponse.json(
      { error: "Nicht authentifiziert" }, { status: 401 }
    )};
  }
  return { session, error: null };
}

/** Check if user has required role(s) */
export async function requireRole(...roles: UserRole[]) {
  const { session, error } = await requireAuth();
  if (error) return { session: null, error };

  if (!roles.includes(session!.user.role)) {
    return { session: null, error: NextResponse.json(
      { error: "Keine Berechtigung" }, { status: 403 }
    )};
  }
  return { session: session!, error: null };
}

/**
 * Check if user can access a specific Akte.
 * Access paths: personal assignment, Dezernat membership, Admin override.
 * Returns 404 (not 403) to hide existence.
 */
export async function requireAkteAccess(akteId: string) {
  const { session, error } = await requireAuth();
  if (error) return { session: null, akte: null, error };

  const user = session!.user;

  // ADMIN with active override -- check AdminOverride table
  if (user.role === "ADMIN") {
    const akte = await prisma.akte.findUnique({ where: { id: akteId } });
    if (!akte) {
      return { session: null, akte: null, error: NextResponse.json(
        { error: "Akte nicht gefunden" }, { status: 404 }
      )};
    }
    return { session: session!, akte, error: null };
  }

  // Check: personal assignment OR Dezernat membership
  const akte = await prisma.akte.findFirst({
    where: {
      id: akteId,
      OR: [
        { anwaltId: user.id },
        { sachbearbeiterId: user.id },
        { beteiligte: { some: { kontakt: { /* linked user */ } } } },
        { dezernate: { some: { mitglieder: { some: { id: user.id } } } } },
      ],
    },
  });

  if (!akte) {
    // Return 404 to hide existence
    return { session: null, akte: null, error: NextResponse.json(
      { error: "Akte nicht gefunden" }, { status: 404 }
    )};
  }

  return { session: session!, akte, error: null };
}
```

### Pattern 2: Akte List Filtering (Authorized Only)
**What:** Inject access filter into every Akte list/search query
**When to use:** GET /api/akten, search endpoints, any listing

```typescript
// Helper to build Prisma where clause for authorized Akten
export function buildAkteAccessFilter(userId: string, role: UserRole): any {
  if (role === "ADMIN") return {}; // Admin sees all (until explicit override model)

  return {
    OR: [
      { anwaltId: userId },
      { sachbearbeiterId: userId },
      { dezernate: { some: { mitglieder: { some: { id: userId } } } } },
    ],
  };
}
```

### Pattern 3: Sidebar Role Filtering
**What:** Filter navigation items based on user role from session
**When to use:** Sidebar component (already client-side with useSession)

```typescript
// Extend existing sidebar.tsx navigation with role visibility
const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, minRole: null },
  { name: "Akten", href: "/akten", icon: FolderOpen, minRole: null },
  // ...
  { name: "Helena", href: "/ki-chat", icon: Sparkles, hideForRoles: ["PRAKTIKANT"] },
  { name: "beA", href: "/bea", icon: Shield, hideForRoles: ["PRAKTIKANT", "SEKRETARIAT"] },
  { name: "Einstellungen", href: "/einstellungen", icon: Settings, hideForRoles: ["PRAKTIKANT"] },
];
```

### Pattern 4: Audit-Trail Timeline Component
**What:** Activity stream UI like GitHub activity feed
**When to use:** System-wide admin audit page and per-Akte Historie tab

```typescript
// Timeline item structure
interface AuditTimelineItem {
  id: string;
  userName: string;
  userAvatar?: string;
  aktion: string;        // e.g. "AKTE_ERSTELLT"
  aktionLabel: string;   // e.g. "hat Akte erstellt"
  akteAktenzeichen?: string;
  details?: {
    aenderungen?: { feld: string; alt: string; neu: string }[];
  };
  createdAt: string;
}
// Group by date for display: "Heute", "Gestern", "25. Februar 2026"
```

### Pattern 5: Anonymization Transaction
**What:** Atomic anonymization of all personal data for a Kontakt
**When to use:** DSGVO deletion request after 10-year retention

```typescript
// Anonymize all PII for a Kontakt in a single transaction
await prisma.$transaction(async (tx) => {
  // Anonymize Kontakt fields
  await tx.kontakt.update({
    where: { id: kontaktId },
    data: {
      vorname: "Geloeschter",
      nachname: "Mandant",
      email: null,
      telefon: null,
      // ... all PII fields
      anonymisiertAm: new Date(),
    },
  });

  // Anonymize related records (Adressen, etc.)
  await tx.adresse.updateMany({
    where: { kontaktId },
    data: { strasse: "***", plz: "***", ort: "***" },
  });

  // Audit log the anonymization
  await tx.auditLog.create({
    data: {
      userId: adminUserId,
      aktion: "DSGVO_ANONYMISIERT",
      details: { kontaktId, grund: reason },
    },
  });
});
```

### Anti-Patterns to Avoid
- **Client-side only RBAC:** Never trust the frontend for authorization. All checks must be server-side in API routes. The sidebar hiding is UX only, not security.
- **403 on unauthorized Akte access:** User decision is to return 404 (hide existence). Never reveal that an Akte exists but is forbidden.
- **Hard-deleting personal data:** NEVER delete -- always anonymize. The 10-year retention period is legally mandatory (BRAO/GoBD).
- **Role checks via string comparison everywhere:** Centralize in PERMISSIONS constant and helper functions, not scattered `if (role === "ADMIN")` checks.
- **Blocking health checks behind auth:** The public /api/health must remain unauthenticated for Docker healthcheck. Only detailed info should require admin auth.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured logging | Custom JSON logger | Pino (already installed) | Battle-tested, async I/O, child logger pattern |
| PDF generation | HTML-to-PDF via puppeteer | pdf-lib (already installed) | No headless browser, works in serverless, patterns exist in codebase |
| Email sending | Raw SMTP client | nodemailer via existing send.ts | Already configured with lazy transport pattern |
| Date formatting | Manual German date strings | date-fns format with 'de' locale | Already in dependencies, handles edge cases |
| Permission matrix | Database-configurable permissions | Code-constant PERMISSIONS object | User decision: fixed matrix, no feature flags |

**Key insight:** This phase requires no new libraries. Every tool is already installed. The work is about building enforcement helpers and systematically applying them.

## Common Pitfalls

### Pitfall 1: Inconsistent Access Enforcement
**What goes wrong:** Some API routes check access, others don't, creating security holes.
**Why it happens:** With ~90 API routes, it's easy to miss one during the retrofit.
**How to avoid:** Create a checklist of ALL Akte-related routes. Use `requireAkteAccess()` as a mandatory first call in every handler. The helper returns early with 404 if unauthorized.
**Warning signs:** Any API route that calls `prisma.akte.findUnique()` without going through `requireAkteAccess()`.

### Pitfall 2: N+1 Queries in Access Checks
**What goes wrong:** Checking Dezernat membership for every Akte in a list query triggers N+1.
**Why it happens:** Naive implementation checks access per-item instead of filtering at query level.
**How to avoid:** Use `buildAkteAccessFilter()` to inject the access WHERE clause into the Prisma query itself, so PostgreSQL handles the filtering in a single query.
**Warning signs:** Slow Akten list page, many small database queries in logs.

### Pitfall 3: JWT Session Stale After Permission Change
**What goes wrong:** User's role changes but their JWT still has the old role until re-login.
**Why it happens:** JWT-based sessions encode role at sign-in time.
**How to avoid:** User decision says "permission changes take effect immediately." For role changes, either: (a) use a short JWT expiry (e.g., 5 minutes) so it refreshes frequently, or (b) check the database role in `requireRole()` on every request for critical operations. Option (b) is recommended for this use case since role changes are rare but must be immediate.
**Warning signs:** Changed user role in admin but user still has old permissions.

### Pitfall 4: Audit Trail Performance at Scale
**What goes wrong:** System-wide audit trail becomes slow with millions of entries.
**Why it happens:** No pagination, no index optimization, loading all entries.
**How to avoid:** Cursor-based pagination (already used in per-Akte historie route). Composite index on `(createdAt DESC, id)`. Partitioning after 1M+ rows. Archive entries older than 2 years to cold storage.
**Warning signs:** Audit trail page takes >3 seconds to load.

### Pitfall 5: Anonymization Missing Related Records
**What goes wrong:** PII remains in related tables (Adressen, Bankverbindungen, AuditLog details JSON).
**Why it happens:** Forgetting to anonymize all tables that reference the Kontakt.
**How to avoid:** Map ALL tables with PII references before implementation. Use a Prisma transaction to atomically anonymize everything. Include a "dry run" mode that lists what would be anonymized.
**Warning signs:** After anonymization, searching for the person's name still returns results.

### Pitfall 6: Health Check Timeout Cascading
**What goes wrong:** One slow service check (e.g., Ollama with 5s timeout) delays the entire health response.
**Why it happens:** Sequential health checks instead of parallel.
**How to avoid:** Already solved -- existing /api/health uses `Promise.all()` for parallel checks. Maintain this pattern when adding new services.
**Warning signs:** Health endpoint takes >10 seconds.

## Code Examples

### Existing Patterns to Extend

#### AuditLog already works (src/lib/audit.ts)
```typescript
// Existing -- logAuditEvent already used in 25+ routes
await logAuditEvent({
  userId,
  akteId,
  aktion: "AKTE_ERSTELLT",
  details: { aktenzeichen, kurzrubrum },
});
```

#### Health checks already parallel (src/app/api/health/route.ts)
```typescript
// Existing -- extend with checkOllama() and checkStirlingPdf()
const [postgres, redis, minio, meilisearch, onlyoffice, worker] =
  await Promise.all([
    checkPostgres(), checkRedis(), checkMinio(),
    checkMeilisearch(), checkOnlyOffice(), checkWorker(),
  ]);
```

#### Logger already configured (src/lib/logger.ts)
```typescript
// Existing -- Pino with JSON Lines in production, pino-pretty in dev
export const rootLogger: Logger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: "ai-lawyer" },
  transport: buildTransport(),
});
```

#### Document Freigabe RBAC already partially exists
```typescript
// Existing in src/app/api/dokumente/[id]/route.ts
const FREIGABE_ROLES = ["ADMIN", "ANWALT", "SACHBEARBEITER"];
if (targetStatus === "FREIGEGEBEN" && !FREIGABE_ROLES.includes(userRole)) {
  return NextResponse.json(
    { error: "Nur Anwaelte, Sachbearbeiter oder Administratoren..." },
    { status: 403 }
  );
}
// Phase 7: SEKRETARIAT must be explicitly excluded from FREIGABE_ROLES
```

### New Prisma Schema Additions

#### Dezernat Entity
```prisma
model Dezernat {
  id          String   @id @default(cuid())
  name        String
  beschreibung String?
  kanzleiId   String?
  kanzlei     Kanzlei? @relation(fields: [kanzleiId], references: [id])
  mitglieder  User[]   @relation("DezernatMitglieder")
  akten       Akte[]   @relation("DezernatAkten")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("dezernate")
}

// Add to User model:
//   dezernate Dezernat[] @relation("DezernatMitglieder")

// Add to Akte model:
//   dezernate Dezernat[] @relation("DezernatAkten")
```

#### Admin Override Model
```prisma
model AdminOverride {
  id        String   @id @default(cuid())
  adminId   String
  admin     User     @relation("AdminOverrides", fields: [adminId], references: [id])
  akteId    String
  akte      Akte     @relation(fields: [akteId], references: [id])
  grund     String   // Reason for override
  gueltigBis DateTime? // Optional expiry
  createdAt DateTime @default(now())

  @@unique([adminId, akteId])
  @@index([akteId])
  @@map("admin_overrides")
}
```

#### Kontakt Anonymization Fields
```prisma
// Add to Kontakt model:
//   anonymisiertAm   DateTime?
//   anonymisiertVon  String?
```

### Audit Trail Timeline API
```typescript
// GET /api/admin/audit-trail?take=50&cursor=xxx&userId=xxx&akteId=xxx&aktion=xxx&von=xxx&bis=xxx
// Returns grouped timeline items with user avatars
export async function GET(request: NextRequest) {
  const { session, error } = await requireRole("ADMIN");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const take = Math.min(parseInt(searchParams.get("take") ?? "50"), 100);
  const cursor = searchParams.get("cursor");
  const userId = searchParams.get("userId");
  const akteId = searchParams.get("akteId");
  const aktion = searchParams.get("aktion");
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");

  const where: any = {};
  if (userId) where.userId = userId;
  if (akteId) where.akteId = akteId;
  if (aktion) where.aktion = aktion;
  if (von || bis) {
    where.createdAt = {};
    if (von) where.createdAt.gte = new Date(von);
    if (bis) where.createdAt.lte = new Date(bis);
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: { select: { name: true, avatarUrl: true, role: true } },
      akte: { select: { aktenzeichen: true, kurzrubrum: true } },
    },
  });

  const hasMore = logs.length > take;
  const items = hasMore ? logs.slice(0, take) : logs;

  return NextResponse.json({
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
    hasMore,
  });
}
```

### Health Check Extension for Ollama
```typescript
/** Check Ollama health endpoint */
async function checkOllama(): Promise<ServiceStatus> {
  const start = Date.now();
  const url = process.env.OLLAMA_URL || "http://localhost:11434";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return { status: res.ok ? "healthy" : "unhealthy", latency: Date.now() - start };
  } catch (err) {
    return {
      status: "unhealthy", latency: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/** Check Stirling-PDF health */
async function checkStirlingPdf(): Promise<ServiceStatus> {
  const start = Date.now();
  const url = process.env.STIRLING_PDF_URL || "http://localhost:8081";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url}/api/v1/info/status`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return { status: res.ok ? "healthy" : "unhealthy", latency: Date.now() - start };
  } catch (err) {
    return {
      status: "unhealthy", latency: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
```

### Auskunftsrecht PDF Export Pattern
```typescript
// Using existing pdf-lib patterns from the codebase
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function generateAuskunftPdf(kontaktId: string): Promise<Buffer> {
  const kontakt = await prisma.kontakt.findUnique({
    where: { id: kontaktId },
    include: {
      adressen: true,
      beteiligte: { include: { akte: { select: { aktenzeichen: true, kurzrubrum: true } } } },
      // ... all relations
    },
  });

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  // ... build pages with all stored data

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Scattered role checks | Centralized PERMISSIONS constant + helpers | Best practice 2024+ | Single source of truth for all role decisions |
| console.log everywhere | Pino structured JSON logging | Already implemented | Existing logger.ts is production-ready |
| Health checks per-service | Parallel Promise.all health checks | Already implemented | Existing pattern is correct |
| Hard delete for GDPR | Anonymization (NEVER delete) | BRAO/GoBD requirement | Legally mandated for law firms |

**Deprecated/outdated:**
- Custom role middleware in Next.js middleware.ts: Too coarse for per-resource access control. Use helper functions in route handlers instead.
- Client-side permission checks without server enforcement: Security theater -- always enforce server-side.

## Discretion Recommendations

### Pino Logger (Discretion Area)
**Recommendation:** Use Pino (already installed and configured). No changes needed to `src/lib/logger.ts`. The existing setup already outputs JSON Lines in production and pretty-prints in development. Just ensure all remaining `console.log` calls are migrated to use `createLogger()`.
**Confidence:** HIGH -- Pino is already the project's logger.

### Audit-Trail Pagination Strategy (Discretion Area)
**Recommendation:** Cursor-based pagination (already used in the per-Akte historie API). Load 50 items initially, "Load more" button at bottom. Group entries by date ("Heute", "Gestern", date). This is simpler than infinite scroll and works well with the timeline format.
**Confidence:** HIGH -- cursor-based pagination already proven in the codebase.

### Anonymization Field Strategy (Discretion Area)
**Recommendation:** Anonymize all personenbezogene Daten fields on Kontakt:
- Replace: vorname -> "Geloeschter", nachname -> "Mandant" (or "Kontakt"), firma -> "Anonymisiert"
- Null out: email, telefon, mobilnummer, fax, geburtsdatum, geburtsname, geburtsort, geburtsland, beruf, branche, steuernr
- Null out Adressen: strasse -> null, hausnummer -> null, plz -> null, ort -> null
- Keep: id (needed for referential integrity), typ (NATUERLICH/JURISTISCH), createdAt
- Mark: set anonymisiertAm and anonymisiertVon fields
- AuditLog details JSON: scan for PII and replace (name patterns -> "Anonymisiert")
**Confidence:** MEDIUM -- field-by-field strategy needs legal review but aligns with DSGVO Art. 17 + BRAO retention.

### Security Event Detection Thresholds (Discretion Area)
**Recommendation:** 5 failed logins from same IP within 15 minutes = "suspicious". 10+ = "brute force". Log failed login attempts in AuditLog with new event type `LOGIN_FEHLGESCHLAGEN`. Display as red markers in audit trail security section.
**Confidence:** MEDIUM -- thresholds are configurable later, these are reasonable starting points.

### Health Check Polling Interval (Discretion Area)
**Recommendation:** 30 seconds for auto-refresh on admin page (already implemented). 60 seconds for email alert cooldown (prevent spam). Polling from admin page, not server-side background job.
**Confidence:** HIGH -- existing 30s interval is proven.

### Dashboard Widget Design (Discretion Area)
**Recommendation:** Card on admin dashboard showing last 5 audit events with timestamp, user avatar, action label. "Alle anzeigen" link to full audit trail page. Reuse the AuditTimeline component in compact mode.
**Confidence:** HIGH -- standard dashboard pattern.

## Codebase Assessment

### What Already Exists (Reuse)
1. **AuditLog model** -- `prisma/schema.prisma` -- fully functional with indexes on akteId, userId, createdAt
2. **logAuditEvent()** -- `src/lib/audit.ts` -- used in 25+ API routes, has `computeChanges()` for diffs
3. **Per-Akte historie API** -- `src/app/api/akten/[id]/historie/route.ts` -- cursor-based pagination, working
4. **Health check endpoint** -- `src/app/api/health/route.ts` -- 6 service checks, parallel, public
5. **Admin system page** -- `src/app/(dashboard)/admin/system/page.tsx` -- health dashboard with log viewer
6. **Pino logger** -- `src/lib/logger.ts` -- JSON Lines production, pino-pretty dev, child loggers
7. **Sidebar with ADMIN check** -- `src/components/layout/sidebar.tsx` -- already hides admin nav for non-admins
8. **Document Freigabe RBAC** -- `src/app/api/dokumente/[id]/route.ts` -- role-based status transitions
9. **Versand-Gate** -- `src/lib/versand-gate.ts` -- document approval enforcement
10. **Email sending** -- `src/lib/email/send.ts` -- nodemailer with lazy transport
11. **NextAuth session types** -- `src/types/next-auth.d.ts` -- role and kanzleiId on session

### What Needs to Be Built
1. **Dezernat entity** -- new Prisma model + CRUD API + admin UI
2. **AdminOverride entity** -- new Prisma model for explicit access override
3. **RBAC helper library** -- `src/lib/rbac.ts` with requireRole(), requireAkteAccess(), PERMISSIONS matrix
4. **Retrofit all API routes** -- add access checks to ~40 Akte-related routes
5. **Sidebar role filtering** -- extend navigation items with role visibility rules
6. **System-wide audit trail UI** -- admin page with timeline/activity stream, filtering, export
7. **Audit trail read-access logging** -- log AKTE_GEOEFFNET, DOKUMENT_ANGESEHEN events
8. **Failed login logging** -- extend authorize() in auth.ts to log failures
9. **DSGVO anonymization workflow** -- API route + admin UI + Prisma transaction
10. **Auskunftsrecht PDF export** -- collect all personal data, generate PDF with pdf-lib
11. **Extended health checks** -- add Ollama, Stirling-PDF, PostgreSQL to checks
12. **Health endpoint auth gating** -- basic status public, details behind admin auth
13. **Email alerts on service failure** -- detect unhealthy, send email with cooldown
14. **Admin dashboard widget** -- compact audit trail on admin landing page
15. **Dezernat management UI** -- CRUD in Einstellungen with member/Akte assignment
16. **Rollen-Matrix UI** -- read-only permission table in Einstellungen
17. **Per-user permission overview** -- show accessible Akten with access source

### Scope Estimate
- **Schema changes:** 2 new models (Dezernat, AdminOverride), 2 relation additions, 2 fields on Kontakt
- **New API routes:** ~8 (audit-trail, dezernate CRUD, dsgvo anonymize, dsgvo auskunft, rollen)
- **Retrofitted API routes:** ~40 Akte-related routes need access filter injection
- **New UI pages:** ~4 (audit-trail, dezernate, rollen, dsgvo)
- **Modified UI components:** sidebar, admin layout, akte detail tabs (historie)

## Open Questions

1. **Admin Override Expiry**
   - What we know: User wants explicit "Zugriff uebernehmen" button with audit logging
   - What's unclear: Should overrides auto-expire? After how long?
   - Recommendation: Add optional `gueltigBis` field. Default to no expiry but log a warning in audit trail if override is >30 days old.

2. **Read-Access Logging Volume**
   - What we know: User wants "all events including read access" (Akte geoeffnet, Dokument angesehen)
   - What's unclear: This will generate massive log volume -- every page view is a log entry
   - Recommendation: Log read-access but implement efficient batch insert (collect reads for 5s, then flush). Add a retention policy to archive/compress read-only events after 90 days.

3. **Sidebar Items for SEKRETARIAT**
   - What we know: PRAKTIKANT sees no Einstellungen/Admin. SEKRETARIAT is "like SACHBEARBEITER but no Freigeben/Loeschen."
   - What's unclear: Should SEKRETARIAT see Einstellungen? Currently unclear from decisions.
   - Recommendation: Hide Einstellungen for SEKRETARIAT as well (since they can't configure meaningful settings without admin access). Show everything else.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `prisma/schema.prisma` -- full schema with 50+ models, AuditLog, User roles
- Codebase analysis: `src/lib/audit.ts` -- existing audit event system with 45+ event types
- Codebase analysis: `src/lib/auth.ts` -- NextAuth v5 JWT session with role/kanzleiId
- Codebase analysis: `src/app/api/health/route.ts` -- 6-service parallel health checks
- Codebase analysis: `src/lib/logger.ts` -- Pino with JSON Lines production config
- Codebase analysis: `src/components/layout/sidebar.tsx` -- existing ADMIN-only section pattern
- Codebase analysis: `docker-compose.yml` -- 9 services (app, worker, db, redis, minio, meilisearch, onlyoffice, stirling-pdf, ollama)

### Secondary (MEDIUM confidence)
- [Auth.js RBAC Guide](https://authjs.dev/guides/role-based-access-control) -- official NextAuth role-based access patterns
- [Pino Logger Guide](https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/) -- production Pino patterns
- [Structured Logging for Next.js](https://blog.arcjet.com/structured-logging-in-json-for-next-js/) -- Next.js + Pino integration
- [PostgreSQL Anonymizer](https://postgresql-anonymizer.readthedocs.io/) -- DSGVO anonymization patterns (not using extension, but patterns inform approach)

### Tertiary (LOW confidence)
- Security event thresholds (5 failed logins = suspicious) -- based on general security best practices, not law-firm-specific guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, everything already installed
- Architecture: HIGH -- extending proven patterns (audit, health, logger, auth)
- RBAC enforcement: HIGH -- clear permission matrix from user decisions, straightforward implementation
- DSGVO anonymization: MEDIUM -- field-by-field strategy needs validation against legal requirements
- Pitfalls: HIGH -- based on direct codebase analysis, known patterns

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable domain, no fast-moving dependencies)
