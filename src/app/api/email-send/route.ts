import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { emailSendQueue } from "@/lib/queue/queues";
import { checkDokumenteFreigegeben } from "@/lib/versand-gate";

const sendSchema = z.object({
  kontoId: z.string().cuid("Ungültige Konto-ID"),
  empfaenger: z.array(z.string().email()).min(1, "Mindestens ein Empfänger"),
  cc: z.array(z.string().email()).default([]),
  bcc: z.array(z.string().email()).default([]),
  betreff: z.string().min(1, "Betreff ist erforderlich"),
  inhalt: z.string().min(1, "Inhalt ist erforderlich"),
  inhaltText: z.string().optional(),
  akteId: z.string().optional(),
  anhaenge: z.array(z.string()).default([]), // File IDs from DMS or uploaded
  prioritaet: z.enum(["NIEDRIG", "NORMAL", "HOCH"]).default("NORMAL"),
  lesebestaetigung: z.boolean().default(false),
  geplanterVersand: z.string().datetime().optional(), // ISO DateTime for scheduled send
});

/**
 * POST /api/email-send — Queue an outgoing email.
 * Creates EmailNachricht with richtung=AUSGEHEND, adds to BullMQ emailSendQueue.
 * Supports 10-second undo window (delay) and scheduled sending.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = sendSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Ungültige Eingabe", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Verify user has access to the sender mailbox
  const isAdmin = (session.user as any).role === "ADMIN";
  if (!isAdmin) {
    const hasAccess = await prisma.emailKontoZuweisung.findFirst({
      where: { kontoId: data.kontoId, userId: session.user.id },
    });
    if (!hasAccess) {
      return Response.json({ error: "Kein Zugriff auf dieses Postfach" }, { status: 403 });
    }
  }

  // Get sender mailbox info
  const konto = await prisma.emailKonto.findUnique({
    where: { id: data.kontoId },
    select: { emailAdresse: true, name: true },
  });

  if (!konto) {
    return Response.json({ error: "E-Mail-Konto nicht gefunden" }, { status: 404 });
  }

  // Versand-Gate: check that all DMS attachments are FREIGEGEBEN
  // DMS attachments use the format "dms-{dokumentId}", direct uploads use "upload-{random}"
  const dmsIds = data.anhaenge
    .filter((a) => a.startsWith("dms-"))
    .map((a) => a.replace(/^dms-/, ""));

  if (dmsIds.length > 0) {
    const check = await checkDokumenteFreigegeben(dmsIds);
    if (!check.ok) {
      return Response.json(
        {
          error: "Nicht freigegebene Dokumente koennen nicht versendet werden",
          details: check.errors,
        },
        { status: 400 }
      );
    }
  }

  // Calculate delay
  let delay: number;
  let sendeStatus: "GEPLANT" | "WIRD_GESENDET";

  if (data.geplanterVersand) {
    const scheduledDate = new Date(data.geplanterVersand);
    delay = Math.max(scheduledDate.getTime() - Date.now(), 0);
    sendeStatus = "GEPLANT";
  } else {
    delay = 10_000; // 10-second undo window
    sendeStatus = "WIRD_GESENDET";
  }

  // Create the outgoing email record
  const email = await prisma.emailNachricht.create({
    data: {
      emailKontoId: data.kontoId,
      richtung: "AUSGEHEND",
      betreff: data.betreff,
      absender: konto.emailAdresse,
      absenderName: konto.name,
      empfaenger: data.empfaenger,
      cc: data.cc,
      bcc: data.bcc,
      inhalt: data.inhalt,
      inhaltText: data.inhaltText ?? null,
      prioritaet: data.prioritaet,
      sendeStatus,
      geplanterVersand: data.geplanterVersand
        ? new Date(data.geplanterVersand)
        : null,
    },
  });

  // Auto-verakten if akteId provided
  if (data.akteId) {
    await prisma.emailVeraktung.create({
      data: {
        emailNachrichtId: email.id,
        akteId: data.akteId,
        userId: session.user.id,
        notiz: "Automatisch beim Senden veraktet",
      },
    });
    await prisma.emailNachricht.update({
      where: { id: email.id },
      data: { veraktet: true },
    });
  }

  // Add to send queue with delay
  const job = await emailSendQueue.add(
    "send-email",
    {
      emailNachrichtId: email.id,
      kontoId: data.kontoId,
      userId: session.user.id,
    },
    {
      delay,
      jobId: `send-${email.id}`,
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 604_800 },
    }
  );

  return Response.json(
    {
      emailId: email.id,
      jobId: job.id,
      delay,
      sendeStatus,
    },
    { status: 201 }
  );
}

/**
 * DELETE /api/email-send — Cancel a queued send (undo).
 * Only works if the BullMQ job hasn't started processing yet.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const emailId = searchParams.get("emailId");

  if (!emailId) {
    return Response.json({ error: "emailId Parameter erforderlich" }, { status: 400 });
  }

  // Try to remove the job from the queue
  const jobId = `send-${emailId}`;
  const job = await emailSendQueue.getJob(jobId);

  if (!job) {
    return Response.json({ error: "Sendevorgang nicht gefunden" }, { status: 404 });
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
