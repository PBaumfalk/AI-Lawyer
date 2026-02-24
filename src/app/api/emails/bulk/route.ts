import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";

const bulkActionSchema = z.object({
  emailIds: z.array(z.string()).min(1, "Mindestens eine E-Mail-ID erforderlich"),
  action: z.enum(["markRead", "markUnread", "delete", "archive", "spam", "move"]),
  targetFolderId: z.string().optional(), // Required for "move" action
});

/**
 * POST /api/emails/bulk — Bulk actions on multiple emails.
 * Actions: markRead, markUnread, delete, archive, spam, move.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = bulkActionSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Ungültige Eingabe", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { emailIds, action, targetFolderId } = parsed.data;
  const isAdmin = (session.user as any).role === "ADMIN";

  // Verify user has access to all emails
  if (!isAdmin) {
    const zuweisungen = await prisma.emailKontoZuweisung.findMany({
      where: { userId: session.user.id },
      select: { kontoId: true },
    });
    const accessibleKontoIds = new Set(zuweisungen.map((z) => z.kontoId));

    const emails = await prisma.emailNachricht.findMany({
      where: { id: { in: emailIds } },
      select: { emailKontoId: true },
    });

    const unauthorized = emails.some((e) => !accessibleKontoIds.has(e.emailKontoId));
    if (unauthorized) {
      return Response.json(
        { error: "Kein Zugriff auf eine oder mehrere E-Mails" },
        { status: 403 }
      );
    }
  }

  let updated = 0;

  switch (action) {
    case "markRead":
      ({ count: updated } = await prisma.emailNachricht.updateMany({
        where: { id: { in: emailIds } },
        data: { gelesen: true },
      }));
      break;

    case "markUnread":
      ({ count: updated } = await prisma.emailNachricht.updateMany({
        where: { id: { in: emailIds } },
        data: { gelesen: false },
      }));
      break;

    case "delete":
      ({ count: updated } = await prisma.emailNachricht.updateMany({
        where: { id: { in: emailIds } },
        data: { geloescht: true, geloeschtAm: new Date() },
      }));
      break;

    case "archive":
    case "spam":
    case "move": {
      let folderId = targetFolderId;

      // For archive/spam, find the corresponding special folder
      if (action === "archive" || action === "spam") {
        // Get the kontoId from the first email to find the right folder
        const firstEmail = await prisma.emailNachricht.findFirst({
          where: { id: { in: emailIds } },
          select: { emailKontoId: true },
        });

        if (firstEmail) {
          const spezialTyp = action === "archive" ? "ARCHIVE" : "JUNK";
          const folder = await prisma.emailOrdner.findFirst({
            where: {
              kontoId: firstEmail.emailKontoId,
              spezialTyp,
            },
          });
          folderId = folder?.id ?? undefined;
        }
      }

      if (folderId) {
        ({ count: updated } = await prisma.emailNachricht.updateMany({
          where: { id: { in: emailIds } },
          data: { emailOrdnerId: folderId },
        }));
      }
      break;
    }
  }

  return Response.json({ updated, action });
}
