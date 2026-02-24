import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/ordner-schemata -- list all folder schemas
 * Query: sachgebiet (filter by Sachgebiet)
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const sachgebiet = searchParams.get("sachgebiet");

  const where: any = {};
  if (sachgebiet) where.sachgebiet = sachgebiet;

  const schemata = await prisma.ordnerSchema.findMany({
    where,
    orderBy: [{ istStandard: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ schemata });
}

/**
 * POST /api/ordner-schemata -- create a new folder schema
 * Body: { name: string, sachgebiet?: string, ordner: string[], istStandard?: boolean }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  let body: {
    name?: string;
    sachgebiet?: string;
    ordner?: string[];
    istStandard?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 }
    );
  }

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Name ist erforderlich" },
      { status: 400 }
    );
  }

  if (!body.ordner || !Array.isArray(body.ordner) || body.ordner.length === 0) {
    return NextResponse.json(
      { error: "Mindestens ein Ordner ist erforderlich" },
      { status: 400 }
    );
  }

  // If setting as default for this Sachgebiet, unset previous defaults
  if (body.istStandard && body.sachgebiet) {
    await prisma.ordnerSchema.updateMany({
      where: {
        sachgebiet: body.sachgebiet as any,
        istStandard: true,
      },
      data: { istStandard: false },
    });
  }

  const schema = await prisma.ordnerSchema.create({
    data: {
      name: body.name.trim(),
      sachgebiet: (body.sachgebiet as any) || null,
      ordner: body.ordner.filter(Boolean),
      istStandard: body.istStandard ?? false,
    },
  });

  return NextResponse.json({ schema }, { status: 201 });
}

/**
 * PUT /api/ordner-schemata -- update a folder schema
 * Body: { id: string, name?: string, sachgebiet?: string, ordner?: string[], istStandard?: boolean }
 */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  let body: {
    id?: string;
    name?: string;
    sachgebiet?: string;
    ordner?: string[];
    istStandard?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 }
    );
  }

  if (!body.id) {
    return NextResponse.json(
      { error: "ID ist erforderlich" },
      { status: 400 }
    );
  }

  const existing = await prisma.ordnerSchema.findUnique({
    where: { id: body.id },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "OrdnerSchema nicht gefunden" },
      { status: 404 }
    );
  }

  const updateData: any = {};
  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.sachgebiet !== undefined)
    updateData.sachgebiet = body.sachgebiet || null;
  if (body.ordner !== undefined)
    updateData.ordner = body.ordner.filter(Boolean);

  // Handle istStandard toggle
  if (body.istStandard !== undefined) {
    if (body.istStandard) {
      // Unset other defaults for the same sachgebiet
      const targetSachgebiet = body.sachgebiet ?? existing.sachgebiet;
      if (targetSachgebiet) {
        await prisma.ordnerSchema.updateMany({
          where: {
            sachgebiet: targetSachgebiet as any,
            istStandard: true,
            NOT: { id: body.id },
          },
          data: { istStandard: false },
        });
      }
    }
    updateData.istStandard = body.istStandard;
  }

  const updated = await prisma.ordnerSchema.update({
    where: { id: body.id },
    data: updateData,
  });

  return NextResponse.json({ schema: updated });
}

/**
 * DELETE /api/ordner-schemata -- delete a folder schema
 * Query: id (the schema ID)
 * Cannot delete if istStandard is true.
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "ID ist erforderlich" },
      { status: 400 }
    );
  }

  const schema = await prisma.ordnerSchema.findUnique({ where: { id } });
  if (!schema) {
    return NextResponse.json(
      { error: "OrdnerSchema nicht gefunden" },
      { status: 404 }
    );
  }

  if (schema.istStandard) {
    return NextResponse.json(
      {
        error:
          "Ein Standard-Schema kann nicht geloescht werden. Entfernen Sie zuerst den Standard-Status.",
      },
      { status: 400 }
    );
  }

  await prisma.ordnerSchema.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

// ─── Helper: Apply OrdnerSchema to new Akte ──────────────────────────────────

/**
 * Get the default folder structure for a given Sachgebiet.
 * Can be called when creating new Akten to set initial ordner structure.
 */
export async function getDefaultOrdnerForSachgebiet(
  sachgebiet: string
): Promise<string[] | null> {
  // First try to find a schema specific to this Sachgebiet
  let schema = await prisma.ordnerSchema.findFirst({
    where: {
      sachgebiet: sachgebiet as any,
      istStandard: true,
    },
  });

  // Fall back to a general default (no sachgebiet)
  if (!schema) {
    schema = await prisma.ordnerSchema.findFirst({
      where: {
        sachgebiet: null,
        istStandard: true,
      },
    });
  }

  return schema?.ordner ?? null;
}
