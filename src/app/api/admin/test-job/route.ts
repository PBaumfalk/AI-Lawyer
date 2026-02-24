import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { testQueue } from "@/lib/queue/queues";

/**
 * POST /api/admin/test-job — Enqueue a test BullMQ job (ADMIN only).
 *
 * Used to verify the full pipeline:
 * app enqueues -> Redis -> worker picks up -> processes -> emits notification
 */
export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json(
      { error: "Keine Berechtigung — nur Administratoren" },
      { status: 403 }
    );
  }

  const job = await testQueue.add("test-job", {
    userId: session.user.id!,
    message: "Test job from admin",
  });

  return NextResponse.json(
    { jobId: job.id, queue: "test" },
    { status: 201 }
  );
}
