/**
 * Falldaten Template detail API -- GET (detail) + PATCH (edit) + DELETE.
 *
 * GET    /api/falldaten-templates/[id] -- Get template detail
 * PATCH  /api/falldaten-templates/[id] -- Edit template (creator only, ENTWURF/ABGELEHNT)
 * DELETE /api/falldaten-templates/[id] -- Delete template (creator only, ENTWURF only)
 *
 * Visibility: GENEHMIGT/STANDARD visible to all authenticated; others only to creator or ADMIN.
 * STANDARD templates are fully immutable (no edit, no delete, no status change).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FalldatenTemplateStatus, Sachgebiet } from "@prisma/client";
import { updateTemplateSchema } from "@/lib/falldaten/validation";

/**
 * GET /api/falldaten-templates/[id]
 * Returns template detail if visible to current user.
 */
export async function GET(
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
  const userRole = (session.user as any).role as string;

  try {
    const template = await prisma.falldatenTemplate.findUnique({
      where: { id },
      include: {
        erstelltVon: { select: { id: true, name: true } },
        geprueftVon: { select: { id: true, name: true } },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template nicht gefunden" },
        { status: 404 }
      );
    }

    // Visibility check: GENEHMIGT/STANDARD visible to all; others only to creator or ADMIN
    const isPublic =
      template.status === FalldatenTemplateStatus.GENEHMIGT ||
      template.status === FalldatenTemplateStatus.STANDARD;
    const isCreator = template.erstelltVonId === userId;
    const isAdmin = userRole === "ADMIN";

    if (!isPublic && !isCreator && !isAdmin) {
      return NextResponse.json(
        { error: "Template nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Template konnte nicht geladen werden: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/falldaten-templates/[id]
 * Edit template -- creator only, ENTWURF or ABGELEHNT status.
 */
export async function PATCH(
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

    // STANDARD templates are immutable
    if (template.status === FalldatenTemplateStatus.STANDARD) {
      return NextResponse.json(
        { error: "Standard-Templates koennen nicht bearbeitet werden" },
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

    // Only ENTWURF or ABGELEHNT can be edited
    if (
      template.status !== FalldatenTemplateStatus.ENTWURF &&
      template.status !== FalldatenTemplateStatus.ABGELEHNT
    ) {
      return NextResponse.json(
        {
          error:
            "Template kann nur im Entwurf oder nach Ablehnung bearbeitet werden",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validierungsfehler", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, beschreibung, sachgebiet, schema } = parsed.data;

    // Validate sachgebiet if provided
    if (sachgebiet && !Object.values(Sachgebiet).includes(sachgebiet as Sachgebiet)) {
      return NextResponse.json(
        { error: `Ungueltiges Sachgebiet: ${sachgebiet}` },
        { status: 400 }
      );
    }

    // Build update data -- partial update, keep status as-is
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (beschreibung !== undefined) updateData.beschreibung = beschreibung;
    if (sachgebiet !== undefined)
      updateData.sachgebiet = sachgebiet ? (sachgebiet as Sachgebiet) : null;
    if (schema !== undefined) updateData.schema = schema as any;

    const updated = await prisma.falldatenTemplate.update({
      where: { id },
      data: updateData,
      include: {
        erstelltVon: { select: { id: true, name: true } },
        geprueftVon: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ template: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Template konnte nicht bearbeitet werden: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/falldaten-templates/[id]
 * Delete template -- creator only, ENTWURF status only.
 */
export async function DELETE(
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

    // STANDARD templates cannot be deleted
    if (template.status === FalldatenTemplateStatus.STANDARD) {
      return NextResponse.json(
        { error: "Standard-Templates koennen nicht geloescht werden" },
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

    // Only ENTWURF can be deleted
    if (template.status !== FalldatenTemplateStatus.ENTWURF) {
      return NextResponse.json(
        { error: "Nur Entwuerfe koennen geloescht werden" },
        { status: 403 }
      );
    }

    // Check if any Akte references this template
    const akteCount = await prisma.akte.count({
      where: { falldatenTemplateId: id },
    });

    if (akteCount > 0) {
      return NextResponse.json(
        { error: "Template wird von Akten verwendet" },
        { status: 409 }
      );
    }

    await prisma.falldatenTemplate.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Template konnte nicht geloescht werden: ${message}` },
      { status: 500 }
    );
  }
}
