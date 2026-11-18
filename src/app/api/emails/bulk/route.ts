import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { emailBulkSchema, type EmailBulkResponse } from "@/lib/email/bulk-contract";
import { emailNachrichtZugriffWhere } from "@/lib/email/zugriff";

/**
 * POST /api/emails/bulk — Bulk actions on multiple emails.
 * Actions: markRead, markUnread, delete, restore, archive, spam, move.
 * Contract: src/lib/email/bulk-contract.ts
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = emailBulkSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Ungültige Eingabe", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { action, targetFolderId } = parsed.data;
  const emailIds = Array.from(new Set(parsed.data.emailIds));
  const user = { id: session.user.id!, role: (session.user as any).role };

  // Every email must exist and belong to a mailbox assigned to the user
  const emails = await prisma.emailNachricht.findMany({
    where: { AND: [{ id: { in: emailIds } }, emailNachrichtZugriffWhere(user)] },
    select: { id: true, emailKontoId: true },
  });
  if (emails.length !== emailIds.length) {
    return Response.json(
      { error: "Kein Zugriff auf eine oder mehrere E-Mails" },
      { status: 403 }
    );
  }

  let updated = 0;
  const where = { id: { in: emailIds } };

  switch (action) {
    case "markRead":
    case "markUnread":
      ({ count: updated } = await prisma.emailNachricht.updateMany({
        where,
        data: { gelesen: action === "markRead" },
      }));
      break;

    case "delete":
      ({ count: updated } = await prisma.emailNachricht.updateMany({
        where,
        data: { geloescht: true, geloeschtAm: new Date() },
      }));
      break;

    case "restore":
      ({ count: updated } = await prisma.emailNachricht.updateMany({
        where,
        data: { geloescht: false, geloeschtAm: null },
      }));
      break;

    case "archive":
    case "spam":
    case "move": {
      // Resolve the target folder per mailbox: emails of different mailboxes
      // must land in their own mailbox's folder.
      const kontoIds = Array.from(new Set(emails.map((e) => e.emailKontoId)));
      const zielProKonto = new Map<string, string>();

      if (action === "move") {
        const ordner = await prisma.emailOrdner.findUnique({
          where: { id: targetFolderId! },
          select: { id: true, kontoId: true },
        });
        if (!ordner || kontoIds.some((k) => k !== ordner.kontoId)) {
          return Response.json(
            { error: "Zielordner gehört nicht zum Postfach der E-Mails" },
            { status: 400 }
          );
        }
        zielProKonto.set(ordner.kontoId, ordner.id);
      } else {
        const spezialTyp = action === "archive" ? "ARCHIVE" : "JUNK";
        const ordner = await prisma.emailOrdner.findMany({
          where: { kontoId: { in: kontoIds }, spezialTyp },
          select: { id: true, kontoId: true },
        });
        for (const o of ordner) if (!zielProKonto.has(o.kontoId)) zielProKonto.set(o.kontoId, o.id);
        if (zielProKonto.size !== kontoIds.length) {
          return Response.json(
            {
              error:
                action === "archive"
                  ? "Für das Postfach ist kein Archiv-Ordner vorhanden"
                  : "Für das Postfach ist kein Spam-Ordner vorhanden",
            },
            { status: 409 }
          );
        }
      }

      for (const [kontoId, ordnerId] of Array.from(zielProKonto)) {
        const { count } = await prisma.emailNachricht.updateMany({
          where: { id: { in: emailIds }, emailKontoId: kontoId },
          data: { emailOrdnerId: ordnerId },
        });
        updated += count;
      }
      break;
    }
  }

  const response: EmailBulkResponse = { updated, action };
  return Response.json(response);
}
