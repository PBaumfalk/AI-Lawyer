import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emailSyncQueue } from "@/lib/queue/queues";

/**
 * POST /api/email-konten/[id]/sync — Trigger immediate sync for a mailbox.
 * Admin only. Adds a job to emailSyncQueue and returns 202 Accepted.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  if ((session.user as any).role !== "ADMIN") {
    return Response.json(
      { error: "Nur Administratoren koennen die Synchronisation starten" },
      { status: 403 }
    );
  }

  const { id } = await params;

  // Verify mailbox exists and is active
  const konto = await prisma.emailKonto.findUnique({
    where: { id },
    select: { id: true, aktiv: true, name: true },
  });

  if (!konto) {
    return Response.json({ error: "E-Mail-Konto nicht gefunden" }, { status: 404 });
  }

  if (!konto.aktiv) {
    return Response.json(
      { error: "E-Mail-Konto ist deaktiviert" },
      { status: 400 }
    );
  }

  // Add sync job to queue
  await emailSyncQueue.add(
    "manual-sync",
    {
      kontoId: id,
    },
    {
      jobId: `sync-${id}-${Date.now()}`,
      removeOnComplete: { age: 3_600 },
      removeOnFail: { age: 86_400 },
    }
  );

  return Response.json(
    { message: "Synchronisation gestartet", kontoId: id },
    { status: 202 }
  );
}
