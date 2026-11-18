import { NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";
import { akteAccessDenied } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { emailSendQueue } from "@/lib/queue/queues";
import { emailSendSchema, type EmailSendResponse } from "@/lib/email/send-contract";
import { resolveEmailAnhaenge } from "@/lib/email/anhaenge";
import { emailNachrichtZugriffWhere, hatKontoZugriff } from "@/lib/email/zugriff";
import type { EmailSendJob } from "@/lib/email/types";

/**
 * POST /api/email-send — Queue an outgoing email.
 * Creates EmailNachricht (richtung=AUSGEHEND) together with its EmailAnhang
 * rows, then adds a job to the BullMQ emailSendQueue.
 * Supports 10-second undo window (delay) and scheduled sending.
 * Request/response contract: src/lib/email/send-contract.ts
 * Undo: POST /api/email-send/cancel.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  const user = { id: session.user.id!, role: (session.user as any).role as UserRole };

  const body = await req.json().catch(() => null);
  const parsed = emailSendSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Ungültige Eingabe", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (data.akteId) {
    const denied = await akteAccessDenied(session, data.akteId);
    if (denied) return denied;
  }

  // Verify user has access to the sender mailbox
  if (!(await hatKontoZugriff(user, data.kontoId))) {
    return Response.json({ error: "Kein Zugriff auf dieses Postfach" }, { status: 403 });
  }

  // Get sender mailbox info
  const konto = await prisma.emailKonto.findUnique({
    where: { id: data.kontoId },
    select: { emailAdresse: true, name: true },
  });

  if (!konto) {
    return Response.json({ error: "E-Mail-Konto nicht gefunden" }, { status: 404 });
  }

  // Attachments: access check + Versand-Gate for DMS documents
  const aufgeloest = await resolveEmailAnhaenge(user, data.anhaenge);
  if (!aufgeloest.ok) {
    return Response.json(
      { error: aufgeloest.error, details: aufgeloest.details },
      { status: aufgeloest.status }
    );
  }

  // Threading for replies (only within mailboxes the user can access)
  let threading: { inReplyTo: string | null; references: string[]; threadId: string | null } = {
    inReplyTo: null,
    references: [],
    threadId: null,
  };
  if (data.antwortAufId) {
    const original = await prisma.emailNachricht.findFirst({
      where: { AND: [{ id: data.antwortAufId }, emailNachrichtZugriffWhere(user)] },
      select: { messageId: true, references: true, threadId: true },
    });
    if (!original) {
      return Response.json({ error: "Ursprüngliche E-Mail nicht gefunden" }, { status: 404 });
    }
    threading = {
      inReplyTo: original.messageId,
      references: original.messageId ? [...original.references, original.messageId] : original.references,
      threadId: original.threadId,
    };
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

  // Create the outgoing email record with its attachments (and veraktung)
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
      geplanterVersand: data.geplanterVersand ? new Date(data.geplanterVersand) : null,
      inReplyTo: threading.inReplyTo,
      references: threading.references,
      threadId: threading.threadId,
      anhaenge: { create: aufgeloest.anhaenge },
      ...(data.akteId
        ? {
            veraktet: true,
            veraktungen: {
              create: {
                akteId: data.akteId,
                userId: user.id,
                notiz: "Automatisch beim Senden veraktet",
              },
            },
          }
        : {}),
    },
  });

  // Add to send queue with delay
  const jobData: EmailSendJob = {
    emailNachrichtId: email.id,
    kontoId: data.kontoId,
    userId: user.id,
    dmsDocumentIds: aufgeloest.dmsDokumentIds, // marked VERSENDET after confirmed send
  };
  const job = await emailSendQueue.add("send-email", jobData, {
    delay,
    jobId: `send-${email.id}`,
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  });

  const response: EmailSendResponse = {
    emailId: email.id,
    jobId: String(job.id),
    delay,
    sendeStatus,
  };
  return Response.json(response, { status: 201 });
}
