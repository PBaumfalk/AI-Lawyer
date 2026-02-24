import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { emailSendQueue } from "@/lib/queue/queues";

const cancelSchema = z.object({
  emailId: z.string().min(1, "emailId ist erforderlich"),
});

/**
 * POST /api/email-send/cancel — Cancel a queued send (undo).
 * Accepts emailId in the body. Removes the BullMQ job and sets
 * the EmailNachricht.sendeStatus back to "ENTWURF".
 * Returns 200 on success, 409 if already sent.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = cancelSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Ungueltige Eingabe", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { emailId } = parsed.data;

  // Verify the email exists and belongs to the user's accessible mailboxes
  const email = await prisma.emailNachricht.findUnique({
    where: { id: emailId },
    select: { id: true, emailKontoId: true, sendeStatus: true },
  });

  if (!email) {
    return Response.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
  }

  // Try to remove the job from the queue
  const jobId = `send-${emailId}`;
  const job = await emailSendQueue.getJob(jobId);

  if (!job) {
    // Job may have already been processed
    if (email.sendeStatus === "GESENDET") {
      return Response.json(
        { error: "E-Mail wurde bereits gesendet" },
        { status: 409 }
      );
    }
    return Response.json(
      { error: "Sendevorgang nicht gefunden" },
      { status: 404 }
    );
  }

  // Check if job is still waiting/delayed (can be cancelled)
  const state = await job.getState();
  if (state !== "waiting" && state !== "delayed") {
    return Response.json(
      { error: "E-Mail wird bereits gesendet oder wurde bereits gesendet" },
      { status: 409 }
    );
  }

  // Remove the job
  await job.remove();

  // Update email status back to draft
  await prisma.emailNachricht.update({
    where: { id: emailId },
    data: { sendeStatus: "ENTWURF" },
  });

  return Response.json({ cancelled: true, emailId });
}
