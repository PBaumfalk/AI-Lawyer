import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";

const createFolderSchema = z.object({
  kontoId: z.string().cuid("Ungültige Konto-ID"),
  name: z.string().min(1, "Ordnername ist erforderlich"),
});

/**
 * GET /api/email-folders — List all EmailOrdner for given kontoId(s).
 * Includes ungeleseneAnzahl and gesamtAnzahl per folder.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const kontoId = searchParams.get("kontoId");
  const isAdmin = (session.user as any).role === "ADMIN";

  let where: any = {};

  if (kontoId) {
    // Verify access to this mailbox
    if (!isAdmin) {
      const hasAccess = await prisma.emailKontoZuweisung.findFirst({
        where: { kontoId, userId: session.user.id },
      });
      if (!hasAccess) {
        return Response.json({ error: "Kein Zugriff auf dieses Postfach" }, { status: 403 });
      }
    }
    where.kontoId = kontoId;
  } else {
    // Return folders for all accessible mailboxes
    if (!isAdmin) {
      const zuweisungen = await prisma.emailKontoZuweisung.findMany({
        where: { userId: session.user.id },
        select: { kontoId: true },
      });
      where.kontoId = { in: zuweisungen.map((z) => z.kontoId) };
    }
  }

  const folders = await prisma.emailOrdner.findMany({
    where,
    include: {
      konto: { select: { id: true, name: true, emailAdresse: true, istKanzlei: true } },
    },
    orderBy: [{ kontoId: "asc" }, { sortierung: "asc" }, { name: "asc" }],
  });

  // Group by konto for tree view
  const grouped = new Map<string, { konto: any; folders: any[] }>();
  for (const folder of folders) {
    const key = folder.kontoId;
    if (!grouped.has(key)) {
      grouped.set(key, { konto: folder.konto, folders: [] });
    }
    grouped.get(key)!.folders.push({
      id: folder.id,
      name: folder.name,
      pfad: folder.pfad,
      spezialTyp: folder.spezialTyp,
      ungeleseneAnzahl: folder.ungeleseneAnzahl,
      gesamtAnzahl: folder.gesamtAnzahl,
      sortierung: folder.sortierung,
    });
  }

  const result = Array.from(grouped.values());
  return Response.json(result);
}

/**
 * POST /api/email-folders — Create a new IMAP folder.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createFolderSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Ungültige Eingabe", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { kontoId, name } = parsed.data;

  // Verify access
  const isAdmin = (session.user as any).role === "ADMIN";
  if (!isAdmin) {
    const hasAccess = await prisma.emailKontoZuweisung.findFirst({
      where: { kontoId, userId: session.user.id },
    });
    if (!hasAccess) {
      return Response.json({ error: "Kein Zugriff" }, { status: 403 });
    }
  }

  // Create folder in DB (IMAP creation happens via connection-manager in background)
  const folder = await prisma.emailOrdner.create({
    data: {
      kontoId,
      name,
      pfad: name, // Will be updated by IMAP folder sync
      spezialTyp: "CUSTOM",
      sortierung: 10,
      ungeleseneAnzahl: 0,
      gesamtAnzahl: 0,
    },
  });

  return Response.json(folder, { status: 201 });
}
