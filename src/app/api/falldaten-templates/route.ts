/**
 * Falldaten Templates API -- GET (list) + POST (create).
 *
 * GET  /api/falldaten-templates -- List templates visible to current user
 * POST /api/falldaten-templates -- Create a new template (any authenticated user)
 *
 * Visibility: GENEHMIGT/STANDARD visible to all; own templates in any status visible to creator; ADMIN sees all templates.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sachgebiet, FalldatenTemplateStatus } from "@prisma/client";
import { createTemplateSchema } from "@/lib/falldaten/validation";

/**
 * GET /api/falldaten-templates
 * Returns templates filtered by visibility rules plus optional query params.
 *
 * Query params:
 *   ?status=GENEHMIGT  -- filter by status
 *   ?sachgebiet=MIETRECHT -- filter by Sachgebiet
 *   ?eigene=true -- only own templates
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const userId = (session.user as any).id as string;
  const userRole = (session.user as any).role as string;
  const { searchParams } = request.nextUrl;

  const statusFilter = searchParams.get("status") as FalldatenTemplateStatus | null;
  const sachgebietFilter = searchParams.get("sachgebiet") as Sachgebiet | null;
  const eigene = searchParams.get("eigene") === "true";

  // Validate status filter if provided
  if (statusFilter && !Object.values(FalldatenTemplateStatus).includes(statusFilter)) {
    return NextResponse.json(
      { error: `Ungueltiger Status: ${statusFilter}` },
      { status: 400 }
    );
  }

  // Validate sachgebiet filter if provided
  if (sachgebietFilter && !Object.values(Sachgebiet).includes(sachgebietFilter)) {
    return NextResponse.json(
      { error: `Ungueltiges Sachgebiet: ${sachgebietFilter}` },
      { status: 400 }
    );
  }

  try {
    // Build where clause based on visibility rules
    const where: any = {};

    if (eigene) {
      // Only own templates
      where.erstelltVonId = userId;
    } else if (userRole === "ADMIN") {
      // Admins see ALL templates (needed for review queue)
    } else {
      // Regular users: public (GENEHMIGT/STANDARD) + own templates in any status
      where.OR = [
        { status: { in: [FalldatenTemplateStatus.GENEHMIGT, FalldatenTemplateStatus.STANDARD] } },
        { erstelltVonId: userId },
      ];
    }

    // Apply optional filters on top
    if (statusFilter) {
      where.status = statusFilter;
    }
    if (sachgebietFilter) {
      where.sachgebiet = sachgebietFilter;
    }

    const templates = await prisma.falldatenTemplate.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        erstelltVon: { select: { id: true, name: true } },
      },
    });

    // Add field count from schema JSON
    const result = templates.map((t) => {
      const schema = t.schema as any;
      const feldCount = Array.isArray(schema?.felder) ? schema.felder.length : 0;
      return {
        ...t,
        feldCount,
      };
    });

    return NextResponse.json({ templates: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Templates konnten nicht geladen werden: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/falldaten-templates
 * Create a new template with status ENTWURF.
 *
 * Body: { name, beschreibung?, sachgebiet?, schema: { felder: [...] } }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const userId = (session.user as any).id as string;

  try {
    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validierungsfehler", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, beschreibung, sachgebiet, schema } = parsed.data;

    // Validate sachgebiet is a valid Prisma enum value if provided
    if (sachgebiet && !Object.values(Sachgebiet).includes(sachgebiet as Sachgebiet)) {
      return NextResponse.json(
        { error: `Ungueltiges Sachgebiet: ${sachgebiet}` },
        { status: 400 }
      );
    }

    const template = await prisma.falldatenTemplate.create({
      data: {
        name,
        beschreibung: beschreibung ?? null,
        sachgebiet: sachgebiet ? (sachgebiet as Sachgebiet) : null,
        schema: schema as any,
        status: FalldatenTemplateStatus.ENTWURF,
        erstelltVonId: userId,
      },
      include: {
        erstelltVon: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Template konnte nicht erstellt werden: ${message}` },
      { status: 500 }
    );
  }
}
