import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * GET /api/emails — List EmailNachricht with cursor-based pagination.
 * Filters: kontoId, ordnerId, gelesen, veraktet, akteId, verantwortlichId, geloescht, search, richtung
 * Sort by: empfangenAm (default desc), absender, betreff
 * Only returns emails from mailboxes the user has access to.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const kontoId = searchParams.get("kontoId") ?? undefined;
  const ordnerId = searchParams.get("ordnerId") ?? undefined;
  const gelesen = searchParams.get("gelesen");
  const veraktet = searchParams.get("veraktet");
  const akteId = searchParams.get("akteId") ?? undefined;
  const verantwortlichId = searchParams.get("verantwortlichId") ?? undefined;
  const geloescht = searchParams.get("geloescht") === "true";
  const search = searchParams.get("search") ?? "";
  const richtung = searchParams.get("richtung") ?? undefined;
  const sortBy = searchParams.get("sortBy") ?? "empfangenAm";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const cursor = searchParams.get("cursor") ?? undefined;

  const isAdmin = (session.user as any).role === "ADMIN";

  // Get accessible mailbox IDs for non-admin users
  let accessibleKontoIds: string[] | undefined;
  if (!isAdmin) {
    const zuweisungen = await prisma.emailKontoZuweisung.findMany({
      where: { userId: session.user.id },
      select: { kontoId: true },
    });
    accessibleKontoIds = zuweisungen.map((z) => z.kontoId);
  }

  // Build where clause
  const where: any = {
    geloescht,
  };

  // Mailbox access control
  if (kontoId) {
    // Verify user has access to this specific mailbox
    if (!isAdmin && accessibleKontoIds && !accessibleKontoIds.includes(kontoId)) {
      return Response.json({ error: "Kein Zugriff auf dieses Postfach" }, { status: 403 });
    }
    where.emailKontoId = kontoId;
  } else if (!isAdmin && accessibleKontoIds) {
    where.emailKontoId = { in: accessibleKontoIds };
  }

  if (ordnerId) where.emailOrdnerId = ordnerId;
  if (gelesen !== null && gelesen !== undefined) where.gelesen = gelesen === "true";
  if (veraktet !== null && veraktet !== undefined) where.veraktet = veraktet === "true";
  if (akteId) {
    where.veraktungen = { some: { akteId } };
  }
  if (verantwortlichId) where.verantwortlichId = verantwortlichId;
  if (richtung === "EINGEHEND" || richtung === "AUSGEHEND") {
    where.richtung = richtung;
  }

  // Text search
  if (search) {
    where.OR = [
      { betreff: { contains: search, mode: "insensitive" } },
      { absender: { contains: search, mode: "insensitive" } },
      { absenderName: { contains: search, mode: "insensitive" } },
    ];
  }

  // Sort
  const orderBy: any = {};
  if (sortBy === "absender") {
    orderBy.absender = sortOrder;
  } else if (sortBy === "betreff") {
    orderBy.betreff = sortOrder;
  } else {
    orderBy.empfangenAm = sortOrder;
  }

  const emails = await prisma.emailNachricht.findMany({
    where,
    select: {
      id: true,
      betreff: true,
      absender: true,
      absenderName: true,
      empfangenAm: true,
      gesendetAm: true,
      gelesen: true,
      flagged: true,
      veraktet: true,
      prioritaet: true,
      groesse: true,
      richtung: true,
      sendeStatus: true,
      inhaltText: true,
      threadId: true,
      emailKontoId: true,
      emailOrdnerId: true,
      _count: { select: { anhaenge: true } },
      veraktungen: {
        select: {
          akte: { select: { id: true, aktenzeichen: true } },
        },
        where: { aufgehoben: false },
        take: 1,
      },
    },
    orderBy,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = emails.length > limit;
  const items = hasMore ? emails.slice(0, limit) : emails;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  // Map to response with preview and attachment count
  const mapped = items.map((e) => ({
    id: e.id,
    betreff: e.betreff,
    absender: e.absender,
    absenderName: e.absenderName,
    empfangenAm: e.empfangenAm,
    gesendetAm: e.gesendetAm,
    gelesen: e.gelesen,
    flagged: e.flagged,
    veraktet: e.veraktet,
    prioritaet: e.prioritaet,
    groesse: e.groesse,
    richtung: e.richtung,
    sendeStatus: e.sendeStatus,
    threadId: e.threadId,
    emailKontoId: e.emailKontoId,
    emailOrdnerId: e.emailOrdnerId,
    preview: e.inhaltText?.slice(0, 80) ?? "",
    anhaengeCount: e._count.anhaenge,
    veraktung: e.veraktungen[0]?.akte
      ? { akteId: e.veraktungen[0].akte.id, aktenzeichen: e.veraktungen[0].akte.aktenzeichen }
      : null,
  }));

  return Response.json({
    emails: mapped,
    nextCursor,
    hasMore,
  });
}
