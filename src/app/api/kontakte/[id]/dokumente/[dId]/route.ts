import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/kontakte/[id]/dokumente/[dId] — get document metadata
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id, dId } = await params;
  const dokument = await prisma.kontaktDokument.findFirst({
    where: { id: dId, kontaktId: id },
  });

  if (!dokument) {
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json(dokument);
}

// DELETE /api/kontakte/[id]/dokumente/[dId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id, dId } = await params;
  const dokument = await prisma.kontaktDokument.findFirst({
    where: { id: dId, kontaktId: id },
  });

  if (!dokument) {
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  await prisma.kontaktDokument.delete({ where: { id: dId } });
  return NextResponse.json({ success: true });
}
