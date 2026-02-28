/**
 * Falldaten Template rejection API.
 *
 * POST /api/falldaten-templates/[id]/ablehnen -- Reject template with reason (ADMIN only)
 *
 * Transition: EINGEREICHT -> ABGELEHNT
 * Auth: ADMIN role required.
 * Side effects: Creates DB notification + emits Socket.IO event to template creator.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FalldatenTemplateStatus } from "@prisma/client";
import { rejectTemplateSchema } from "@/lib/falldaten/validation";
import { createNotification } from "@/lib/notifications/service";

/**
 * POST /api/falldaten-templates/[id]/ablehnen
 * Reject a submitted template with a reason.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const userRole = (session.user as any).role as string;
  if (userRole !== "ADMIN") {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const adminUserId = (session.user as any).id as string;

  try {
    const template = await prisma.falldatenTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template nicht gefunden" },
        { status: 404 }
      );
    }

    // Only EINGEREICHT can be rejected
    if (template.status !== FalldatenTemplateStatus.EINGEREICHT) {
      return NextResponse.json(
        { error: "Nur eingereichte Templates koennen abgelehnt werden" },
        { status: 400 }
      );
    }

    // Parse rejection reason
    const body = await request.json();
    const parsed = rejectTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validierungsfehler", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { ablehnungsgrund } = parsed.data;

    // Reject template
    const updated = await prisma.falldatenTemplate.update({
      where: { id },
      data: {
        status: FalldatenTemplateStatus.ABGELEHNT,
        geprueftVonId: adminUserId,
        geprueftAt: new Date(),
        ablehnungsgrund,
      },
      include: {
        erstelltVon: { select: { id: true, name: true } },
        geprueftVon: { select: { id: true, name: true } },
      },
    });

    // Create notification for template creator (DB + Socket.IO via service)
    await createNotification({
      userId: template.erstelltVonId,
      type: "template:rejected",
      title: "Falldaten-Template abgelehnt",
      message: `Ihr Template "${template.name}" wurde abgelehnt. Grund: ${ablehnungsgrund}`,
      data: { templateId: template.id, ablehnungsgrund },
    });

    return NextResponse.json({ template: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Template konnte nicht abgelehnt werden: ${message}` },
      { status: 500 }
    );
  }
}
