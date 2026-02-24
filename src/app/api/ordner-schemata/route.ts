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

// Helper moved to @/lib/ordner-schemata.ts
// PATCH/DELETE handlers moved to /api/ordner-schemata/[id]/route.ts
