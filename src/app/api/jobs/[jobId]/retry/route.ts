import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ALL_QUEUES } from "@/lib/queue/queues";

/**
 * POST /api/jobs/:jobId/retry — Retry a failed BullMQ job.
 *
 * Accessible by the job owner or any ADMIN.
 * Called by the "Erneut versuchen" button in notification-center.tsx.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const { jobId } = params;
  const userRole = (session.user as any).role as string;
  const userId = session.user.id!;

  // Search for the job across all queues
  let foundJob = null;
  for (const queue of ALL_QUEUES) {
    const job = await queue.getJob(jobId);
    if (job) {
      foundJob = job;
      break;
    }
  }

  if (!foundJob) {
    return NextResponse.json(
      { error: "Job nicht gefunden" },
      { status: 404 }
    );
  }

  // Check the job is in failed state
  const state = await foundJob.getState();
  if (state !== "failed") {
    return NextResponse.json(
      { error: "Job ist nicht fehlgeschlagen" },
      { status: 400 }
    );
  }

  // Security: only the job owner or an ADMIN can retry
  if (foundJob.data.userId !== userId && userRole !== "ADMIN") {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    );
  }

  await foundJob.retry();

  return NextResponse.json({
    success: true,
    jobId: foundJob.id,
    queue: foundJob.queueName,
  });
}
