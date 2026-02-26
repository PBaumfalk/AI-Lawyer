import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// DELETE /api/kontakte/[id]/beziehungen/[bId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id, bId } = await params;
  const beziehung = await prisma.kontaktBeziehung.findFirst({
    where: {
      id: bId,
      OR: [{ vonKontaktId: id }, { zuKontaktId: id }],
    },
  });

  if (!beziehung) {
    return NextResponse.json({ error: "Beziehung nicht gefunden" }, { status: 404 });
  }

  await prisma.kontaktBeziehung.delete({ where: { id: bId } });
  return NextResponse.json({ success: true });
}
