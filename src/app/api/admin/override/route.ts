import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { requireRole } from "@/lib/rbac";
import { z } from "zod";

const createOverrideSchema = z.object({
  akteId: z.string().min(1, "Akte-ID ist erforderlich"),
  grund: z.string().min(1, "Grund ist erforderlich"),
  gueltigBis: z.string().datetime().optional(),
});

// GET /api/admin/override -- list active overrides for current admin
export async function GET() {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;
  const { session } = result;

  const overrides = await prisma.adminOverride.findMany({
    where: { adminId: session.user.id },
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(overrides);
}

// POST /api/admin/override -- create admin override for a specific Akte
export async function POST(request: NextRequest) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;
  const { session } = result;

  const body = await request.json();
  const parsed = createOverrideSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Check Akte exists
  const akte = await prisma.akte.findUnique({
    where: { id: parsed.data.akteId },
    select: { id: true, aktenzeichen: true },
  });
  if (!akte) {
    return NextResponse.json({ error: "Akte nicht gefunden" }, { status: 404 });
  }

  // Check for existing override
  const existing = await prisma.adminOverride.findUnique({
    where: {
      adminId_akteId: {
        adminId: session.user.id,
        akteId: parsed.data.akteId,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Zugriffsueberschreibung existiert bereits" },
      { status: 409 }
    );
  }

  const override = await prisma.adminOverride.create({
    data: {
      adminId: session.user.id,
      akteId: parsed.data.akteId,
      grund: parsed.data.grund,
      gueltigBis: parsed.data.gueltigBis ? new Date(parsed.data.gueltigBis) : null,
    },
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
    },
  });

  await logAuditEvent({
    userId: session.user.id,
    akteId: parsed.data.akteId,
    aktion: "ADMIN_OVERRIDE_ERSTELLT",
    details: {
      grund: parsed.data.grund,
      gueltigBis: parsed.data.gueltigBis || null,
    },
  });

  return NextResponse.json(override, { status: 201 });
}

// DELETE /api/admin/override -- revoke admin override
export async function DELETE(request: NextRequest) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;
  const { session } = result;

  const { searchParams } = new URL(request.url);
  const overrideId = searchParams.get("id");

  if (!overrideId) {
    return NextResponse.json({ error: "Override-ID ist erforderlich" }, { status: 400 });
  }

  const override = await prisma.adminOverride.findFirst({
    where: { id: overrideId, adminId: session.user.id },
    select: { id: true, akteId: true, grund: true },
  });

  if (!override) {
    return NextResponse.json({ error: "Override nicht gefunden" }, { status: 404 });
  }

  await prisma.adminOverride.delete({ where: { id: overrideId } });

  await logAuditEvent({
    userId: session.user.id,
    akteId: override.akteId,
    aktion: "ADMIN_OVERRIDE_ENTFERNT",
    details: { grund: override.grund },
  });

  return NextResponse.json({ success: true });
}
