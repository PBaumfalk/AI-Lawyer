/**
 * Document tag category management API.
 * GET: List all tag categories.
 * POST: Create a new tag category (ADMIN only).
 * PATCH: Update a tag category.
 * DELETE: Delete a tag category (ADMIN only).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/dokumente/tags - List all tag categories ordered by sortierung.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const tags = await prisma.dokumentTagKategorie.findMany({
    orderBy: { sortierung: "asc" },
  });

  return NextResponse.json({ tags });
}

/**
 * POST /api/dokumente/tags - Create a new tag category.
 * Body: { name: string, farbe: string, system?: boolean }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, farbe, system } = body;

    if (!name || !farbe) {
      return NextResponse.json(
        { error: "Name und Farbe sind erforderlich" },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await prisma.dokumentTagKategorie.findUnique({
      where: { name },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Tag "${name}" existiert bereits` },
        { status: 409 }
      );
    }

    // Get next sortierung value
    const maxSort = await prisma.dokumentTagKategorie.aggregate({
      _max: { sortierung: true },
    });

    const tag = await prisma.dokumentTagKategorie.create({
      data: {
        name,
        farbe,
        system: system ?? false,
        sortierung: (maxSort._max.sortierung ?? 0) + 1,
      },
    });

    return NextResponse.json({ tag }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Tag konnte nicht erstellt werden: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/dokumente/tags - Update a tag category.
 * Body: { id: string, name?: string, farbe?: string, sortierung?: number }
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name, farbe, sortierung } = body;

    if (!id) {
      return NextResponse.json({ error: "Tag-ID erforderlich" }, { status: 400 });
    }

    const existing = await prisma.dokumentTagKategorie.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Tag nicht gefunden" }, { status: 404 });
    }

    // Check name uniqueness if changing
    if (name && name !== existing.name) {
      const duplicate = await prisma.dokumentTagKategorie.findUnique({
        where: { name },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: `Tag "${name}" existiert bereits` },
          { status: 409 }
        );
      }
    }

    const tag = await prisma.dokumentTagKategorie.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(farbe !== undefined && { farbe }),
        ...(sortierung !== undefined && { sortierung }),
      },
    });

    return NextResponse.json({ tag });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Tag konnte nicht aktualisiert werden: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dokumente/tags - Delete a tag category.
 * Body: { id: string }
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Tag-ID erforderlich" }, { status: 400 });
    }

    const existing = await prisma.dokumentTagKategorie.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Tag nicht gefunden" }, { status: 404 });
    }

    await prisma.dokumentTagKategorie.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Tag konnte nicht geloescht werden: ${message}` },
      { status: 500 }
    );
  }
}
