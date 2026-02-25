import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, PERMISSIONS, ROLE_LABELS, PERMISSION_LABELS } from "@/lib/rbac";
import type { UserRole } from "@prisma/client";
import { z } from "zod";

// GET /api/admin/rollen -- returns PERMISSIONS matrix and per-user data
export async function GET() {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  // Build permission matrix for display
  const roles: UserRole[] = ["ADMIN", "ANWALT", "SACHBEARBEITER", "SEKRETARIAT"];
  const permissionKeys = Object.keys(PERMISSIONS.ADMIN) as Array<keyof typeof PERMISSIONS.ADMIN>;

  const matrix = roles.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    permissions: Object.fromEntries(
      permissionKeys.map((key) => [key, PERMISSIONS[role][key]])
    ),
  }));

  // Get all users with their roles and accessible Akten
  const users = await prisma.user.findMany({
    where: { aktiv: true, isSystem: false },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      canSeeKanzleiFinanzen: true,
      aktenAlsAnwalt: {
        select: { id: true, aktenzeichen: true, kurzrubrum: true },
        take: 100,
      },
      aktenAlsSachbearbeiter: {
        select: { id: true, aktenzeichen: true, kurzrubrum: true },
        take: 100,
      },
      dezernate: {
        select: {
          id: true,
          name: true,
          akten: {
            select: { id: true, aktenzeichen: true, kurzrubrum: true },
            take: 100,
          },
        },
      },
      adminOverrides: {
        select: {
          akteId: true,
          akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
          grund: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Build per-user access overview
  const userOverview = users.map((user) => {
    // Collect all accessible Akten with source
    const aktenMap = new Map<string, { akte: any; sources: string[] }>();

    // Direct assignment as Anwalt
    for (const akte of user.aktenAlsAnwalt) {
      const entry = aktenMap.get(akte.id) || { akte, sources: [] };
      entry.sources.push("direkt (Anwalt)");
      aktenMap.set(akte.id, entry);
    }

    // Direct assignment as Sachbearbeiter
    for (const akte of user.aktenAlsSachbearbeiter) {
      const entry = aktenMap.get(akte.id) || { akte, sources: [] };
      entry.sources.push("direkt (Sachbearbeiter)");
      aktenMap.set(akte.id, entry);
    }

    // Via Dezernat
    for (const dezernat of user.dezernate) {
      for (const akte of dezernat.akten) {
        const entry = aktenMap.get(akte.id) || { akte, sources: [] };
        entry.sources.push(`Dezernat: ${dezernat.name}`);
        aktenMap.set(akte.id, entry);
      }
    }

    // Via Admin-Override
    for (const override of user.adminOverrides) {
      const entry = aktenMap.get(override.akteId) || {
        akte: override.akte,
        sources: [],
      };
      entry.sources.push(`Admin-Override: ${override.grund}`);
      aktenMap.set(override.akteId, entry);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role],
      permissions: PERMISSIONS[user.role],
      canSeeKanzleiFinanzen: user.canSeeKanzleiFinanzen,
      accessibleAkten: Array.from(aktenMap.values()).map((entry) => ({
        id: entry.akte.id,
        aktenzeichen: entry.akte.aktenzeichen,
        kurzrubrum: entry.akte.kurzrubrum,
        sources: entry.sources,
      })),
    };
  });

  return NextResponse.json({
    matrix,
    permissionLabels: PERMISSION_LABELS,
    roleLabels: ROLE_LABELS,
    users: userOverview,
  });
}

// PATCH /api/admin/rollen -- toggle canSeeKanzleiFinanzen for a user
const patchSchema = z.object({
  userId: z.string().min(1),
  canSeeKanzleiFinanzen: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { userId, canSeeKanzleiFinanzen } = parsed.data;

  // Verify user exists and is ANWALT (only ANWALTs can have this flag)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  if (user.role !== "ANWALT") {
    return NextResponse.json(
      { error: "Kanzleiweite Finanzen ist nur fuer Anwaelte verfuegbar" },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { canSeeKanzleiFinanzen },
    select: { id: true, canSeeKanzleiFinanzen: true },
  });

  return NextResponse.json(updated);
}
