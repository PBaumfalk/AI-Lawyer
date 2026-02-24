import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * PATCH /api/ordner-schemata/[id] -- partial update of a folder schema
 * Body: { name?, sachgebiet?, ordner?, istStandard? }
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

  // Validate: name must not be empty if provided
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: { name: "Name darf nicht leer sein" },
      },
      { status: 400 }
    );
  }

  const existing = await prisma.ordnerSchema.findUnique({
    where: { id },
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
            NOT: { id },
          },
          data: { istStandard: false },
        });
      }
    }
    updateData.istStandard = body.istStandard;
  }

  const updated = await prisma.ordnerSchema.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ schema: updated });
}

/**
 * DELETE /api/ordner-schemata/[id] -- delete a folder schema
 * Cannot delete if istStandard is true.
 * Returns 204 No Content on success.
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

  return new NextResponse(null, { status: 204 });
}
