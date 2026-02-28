/**
 * Falldaten Template submit-for-review API.
 *
 * POST /api/falldaten-templates/[id]/einreichen -- Submit template for admin review
 *
 * Transitions: ENTWURF -> EINGEREICHT, ABGELEHNT -> EINGEREICHT
 * Auth: Creator only. STANDARD templates cannot be submitted.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FalldatenTemplateStatus } from "@prisma/client";

/**
 * POST /api/falldaten-templates/[id]/einreichen
 * Submit template for review (ENTWURF/ABGELEHNT -> EINGEREICHT).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const userId = (session.user as any).id as string;

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

    // STANDARD templates cannot be submitted
    if (template.status === FalldatenTemplateStatus.STANDARD) {
      return NextResponse.json(
        { error: "Standard-Templates koennen nicht eingereicht werden" },
        { status: 403 }
      );
    }

    // Creator only
    if (template.erstelltVonId !== userId) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    // Only from ENTWURF or ABGELEHNT
    if (
      template.status !== FalldatenTemplateStatus.ENTWURF &&
      template.status !== FalldatenTemplateStatus.ABGELEHNT
    ) {
      return NextResponse.json(
        {
          error:
            "Template kann nur aus dem Entwurf oder nach Ablehnung eingereicht werden",
        },
        { status: 400 }
      );
    }

    const updated = await prisma.falldatenTemplate.update({
      where: { id },
      data: {
        status: FalldatenTemplateStatus.EINGEREICHT,
        // Clear rejection reason on resubmission
        ablehnungsgrund: null,
      },
      include: {
        erstelltVon: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ template: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Template konnte nicht eingereicht werden: ${message}` },
      { status: 500 }
    );
  }
}
