import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";

const renameSchema = z.object({
  name: z.string().min(1, "Neuer Name ist erforderlich"),
});

/**
 * PATCH /api/email-folders/[id] — Rename a folder.
 * Only custom folders can be renamed, not special folders.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = renameSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Ungültige Eingabe", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const folder = await prisma.emailOrdner.findUnique({
    where: { id },
    select: { kontoId: true, spezialTyp: true, pfad: true },
  });

  if (!folder) {
    return Response.json({ error: "Ordner nicht gefunden" }, { status: 404 });
  }

  if (folder.spezialTyp !== "CUSTOM") {
    return Response.json(
      { error: "Standard-Ordner können nicht umbenannt werden" },
      { status: 400 }
    );
  }

  // Verify access
  const isAdmin = (session.user as any).role === "ADMIN";
  if (!isAdmin) {
    const hasAccess = await prisma.emailKontoZuweisung.findFirst({
      where: { kontoId: folder.kontoId, userId: session.user.id },
    });
    if (!hasAccess) {
      return Response.json({ error: "Kein Zugriff" }, { status: 403 });
    }
  }

  const updated = await prisma.emailOrdner.update({
    where: { id },
    data: {
      name: parsed.data.name,
      pfad: parsed.data.name, // Will be synced with IMAP
    },
  });

  return Response.json(updated);
}

/**
 * DELETE /api/email-folders/[id] — Delete a custom folder.
 * Only custom folders can be deleted, not special folders.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;

  const folder = await prisma.emailOrdner.findUnique({
    where: { id },
    select: { kontoId: true, spezialTyp: true },
  });

  if (!folder) {
    return Response.json({ error: "Ordner nicht gefunden" }, { status: 404 });
  }

  if (folder.spezialTyp !== "CUSTOM") {
    return Response.json(
      { error: "Standard-Ordner können nicht gelöscht werden" },
      { status: 400 }
    );
  }

  // Verify access
  const isAdmin = (session.user as any).role === "ADMIN";
  if (!isAdmin) {
    const hasAccess = await prisma.emailKontoZuweisung.findFirst({
      where: { kontoId: folder.kontoId, userId: session.user.id },
    });
    if (!hasAccess) {
      return Response.json({ error: "Kein Zugriff" }, { status: 403 });
    }
  }

  // Move emails in this folder to the parent INBOX before deleting
  await prisma.emailNachricht.updateMany({
    where: { emailOrdnerId: id },
    data: { emailOrdnerId: null },
  });

  await prisma.emailOrdner.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
