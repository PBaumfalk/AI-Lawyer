/**
 * POST /api/caldav-konten/[id]/sync
 * Manual sync trigger for a CalDAV account.
 * Enqueues an immediate sync job via BullMQ.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { caldavSyncQueue } from "@/lib/queue/queues";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(
  _req: NextRequest,
  context: RouteParams
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await context.params;

  // Verify konto belongs to user
  const konto = await (prisma as any).calDavKonto.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, aktiv: true, syncStatus: true },
  });

  if (!konto) {
    return Response.json({ error: "CalDAV-Konto nicht gefunden" }, { status: 404 });
  }

  if (!konto.aktiv) {
    return Response.json(
      { error: "CalDAV-Konto ist deaktiviert" },
      { status: 400 }
    );
  }

  // Prevent duplicate concurrent syncs
  if (konto.syncStatus === "SYNCHRONISIEREND") {
    return Response.json(
      { message: "Synchronisation laeuft bereits" },
      { status: 200 }
    );
  }

  // Enqueue immediate sync job
  await caldavSyncQueue.add("sync-single-caldav", { kontoId: id }, {
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 20 },
  });

  return Response.json({ message: "Synchronisation gestartet" }, { status: 200 });
}
