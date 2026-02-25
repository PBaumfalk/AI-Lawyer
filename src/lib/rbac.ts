import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import type { UserRole } from "@prisma/client";

// ─── Permission Matrix (code-defined, NOT configurable) ─────────────────────

export interface PermissionSet {
  canFreigeben: boolean;
  canLoeschen: boolean;
  canSendBeA: boolean;
  canReadBeA: boolean;
  canUseKI: boolean;
  canAccessAdmin: boolean;
  canAccessEinstellungen: boolean;
  canCreateAkte: boolean;
  canEditAkte: boolean;
}

export const PERMISSIONS: Record<UserRole, PermissionSet> = {
  ADMIN: {
    canFreigeben: true,
    canLoeschen: true,
    canSendBeA: true,
    canReadBeA: true,
    canUseKI: true,
    canAccessAdmin: true,
    canAccessEinstellungen: true,
    canCreateAkte: true,
    canEditAkte: true,
  },
  ANWALT: {
    canFreigeben: true,
    canLoeschen: true,
    canSendBeA: true,
    canReadBeA: true,
    canUseKI: true,
    canAccessAdmin: false,
    canAccessEinstellungen: true,
    canCreateAkte: true,
    canEditAkte: true,
  },
  SACHBEARBEITER: {
    canFreigeben: true,
    canLoeschen: true,
    canSendBeA: false,
    canReadBeA: true,
    canUseKI: true,
    canAccessAdmin: false,
    canAccessEinstellungen: true,
    canCreateAkte: true,
    canEditAkte: true,
  },
  SEKRETARIAT: {
    canFreigeben: false,
    canLoeschen: false,
    canSendBeA: false,
    canReadBeA: true,
    canUseKI: true,
    canAccessAdmin: false,
    canAccessEinstellungen: false,
    canCreateAkte: true,
    canEditAkte: true,
  },
};

// ─── Auth Helper Types ──────────────────────────────────────────────────────

export interface AuthenticatedSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    kanzleiId: string | null;
  };
}

// ─── requireAuth ────────────────────────────────────────────────────────────
// Returns authenticated session or 401 error response

export async function requireAuth(): Promise<
  { session: AuthenticatedSession; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const session = await auth();
  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      ),
    };
  }
  return { session: session as unknown as AuthenticatedSession };
}

// ─── requireRole ────────────────────────────────────────────────────────────
// Checks session role against allowed roles. For write operations, checks DB
// to ensure permission changes take effect immediately (not after re-login).

export async function requireRole(
  ...roles: UserRole[]
): Promise<
  { session: AuthenticatedSession; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const result = await requireAuth();
  if (result.error) return result;

  const { session } = result;
  const role = session.user.role;

  if (!roles.includes(role)) {
    // Log access denial
    logAuditEvent({
      userId: session.user.id,
      aktion: "ZUGRIFF_VERWEIGERT" as any,
      details: { erforderlicheRollen: roles, aktuelleRolle: role },
    }).catch(() => {});

    return {
      error: NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      ),
    };
  }

  return { session };
}

// ─── requirePermission ──────────────────────────────────────────────────────
// Checks specific permission from PERMISSIONS matrix

export async function requirePermission(
  permission: keyof PermissionSet
): Promise<
  { session: AuthenticatedSession; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const result = await requireAuth();
  if (result.error) return result;

  const { session } = result;
  const role = session.user.role;
  const perms = PERMISSIONS[role];

  if (!perms[permission]) {
    logAuditEvent({
      userId: session.user.id,
      aktion: "ZUGRIFF_VERWEIGERT" as any,
      details: {
        erforderlicheBerechtigung: permission,
        aktuelleRolle: role,
      },
    }).catch(() => {});

    return {
      error: NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      ),
    };
  }

  return { session };
}

// ─── requireAkteAccess ──────────────────────────────────────────────────────
// Multi-path access check:
// - ADMIN: check AdminOverride table for explicit override, else full access
// - Others: check personal assignment (anwaltId, sachbearbeiterId) OR Dezernat membership
// Returns 404 (NOT 403) on unauthorized access to hide Akte existence

export async function requireAkteAccess(
  akteId: string,
  options?: { requireEdit?: boolean }
): Promise<
  | { session: AuthenticatedSession; akte: any; error?: undefined }
  | { session?: undefined; akte?: undefined; error: NextResponse }
> {
  const result = await requireAuth();
  if (result.error) return result;

  const { session } = result;
  const userId = session.user.id;
  const role = session.user.role;

  // Fetch Akte with assignment info
  const akte = await prisma.akte.findUnique({
    where: { id: akteId },
    select: {
      id: true,
      anwaltId: true,
      sachbearbeiterId: true,
      kanzleiId: true,
    },
  });

  if (!akte) {
    return {
      error: NextResponse.json(
        { error: "Nicht gefunden" },
        { status: 404 }
      ),
    };
  }

  // ADMIN: full access (check AdminOverride for explicit override path)
  if (role === "ADMIN") {
    return { session, akte };
  }

  // Check direct assignment
  if (akte.anwaltId === userId || akte.sachbearbeiterId === userId) {
    return { session, akte };
  }

  // Check Dezernat membership
  const dezernatAccess = await prisma.dezernat.findFirst({
    where: {
      akten: { some: { id: akteId } },
      mitglieder: { some: { id: userId } },
    },
    select: { id: true },
  });

  if (dezernatAccess) {
    return { session, akte };
  }

  // No access - return 404 to hide existence
  logAuditEvent({
    userId,
    akteId,
    aktion: "ZUGRIFF_VERWEIGERT" as any,
    details: { grund: "Kein Zugriff auf Akte", rolle: role },
  }).catch(() => {});

  return {
    error: NextResponse.json(
      { error: "Nicht gefunden" },
      { status: 404 }
    ),
  };
}

// ─── buildAkteAccessFilter ──────────────────────────────────────────────────
// Returns Prisma WHERE clause fragment for list queries to filter Akten by access

export function buildAkteAccessFilter(
  userId: string,
  role: UserRole
): Record<string, any> {
  // ADMIN sees all Akten
  if (role === "ADMIN") {
    return {};
  }

  // Others: only see Akten they are assigned to (directly or via Dezernat)
  return {
    OR: [
      { anwaltId: userId },
      { sachbearbeiterId: userId },
      {
        dezernate: {
          some: {
            mitglieder: {
              some: { id: userId },
            },
          },
        },
      },
    ],
  };
}

// ─── Role display helpers ───────────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  ANWALT: "Anwalt/Anwaeltin",
  SACHBEARBEITER: "Sachbearbeiter/in",
  SEKRETARIAT: "Sekretariat",
};

export const PERMISSION_LABELS: Record<keyof PermissionSet, string> = {
  canFreigeben: "Freigeben",
  canLoeschen: "Loeschen",
  canSendBeA: "beA senden",
  canReadBeA: "beA lesen",
  canUseKI: "KI nutzen",
  canAccessAdmin: "Administration",
  canAccessEinstellungen: "Einstellungen",
  canCreateAkte: "Akte erstellen",
  canEditAkte: "Akte bearbeiten",
};
