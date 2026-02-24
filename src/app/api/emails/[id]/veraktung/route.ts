import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import {
  suggestAktenForEmail,
  verakteEmail,
  hebeVeraktungAuf,
} from "@/lib/email/veraktung";

/**
 * GET /api/emails/[id]/veraktung — List Veraktungen for an email (including aufgehoben for audit).
 * Also returns auto-suggestions when ?suggest=true is passed.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const suggest = searchParams.get("suggest") === "true";

  const email = await prisma.emailNachricht.findUnique({
    where: { id },
    select: {
      id: true,
      absender: true,
      betreff: true,
      empfaenger: true,
      threadId: true,
      anhaenge: {
        select: {
          id: true,
          dateiname: true,
          mimeType: true,
          groesse: true,
        },
      },
      veraktungen: {
        include: {
          akte: {
            select: { id: true, aktenzeichen: true, kurzrubrum: true },
          },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!email) {
    return Response.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
  }

  let suggestions = null;
  if (suggest) {
    suggestions = await suggestAktenForEmail({
      absender: email.absender,
      betreff: email.betreff,
      empfaenger: email.empfaenger,
      threadId: email.threadId,
    });
  }

  return Response.json({
    veraktungen: email.veraktungen,
    anhaenge: email.anhaenge,
    suggestions,
  });
}

/**
 * POST /api/emails/[id]/veraktung — Create new Veraktung.
 * Body: { akteId, anhangIds?: string[], dmsOrdner?: string, notiz?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { akteId, anhangIds, dmsOrdner, notiz } = body;

  if (!akteId) {
    return Response.json({ error: "akteId ist erforderlich" }, { status: 400 });
  }

  // Verify email exists
  const email = await prisma.emailNachricht.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!email) {
    return Response.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
  }

  // Verify Akte exists
  const akte = await prisma.akte.findUnique({
    where: { id: akteId },
    select: { id: true, aktenzeichen: true },
  });
  if (!akte) {
    return Response.json({ error: "Akte nicht gefunden" }, { status: 404 });
  }

  try {
    const veraktung = await verakteEmail({
      emailId: id,
      akteId,
      userId: session.user.id!,
      anhangIds,
      dmsOrdner,
      notiz,
    });

    await logAuditEvent({
      userId: session.user.id,
      akteId,
      aktion: "EMAIL_VERAKTET",
      details: {
        emailNachrichtId: id,
        aktenzeichen: akte.aktenzeichen,
        anhangIds: anhangIds ?? [],
        dmsOrdner: dmsOrdner ?? "Korrespondenz",
        notiz,
      },
    });

    return Response.json(veraktung, { status: 201 });
  } catch (error) {
    console.error("Veraktung error:", error);
    return Response.json(
      { error: "Fehler beim Verakten" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/emails/[id]/veraktung — Reverse a Veraktung.
 * Body: { veraktungId }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { veraktungId } = body;

  if (!veraktungId) {
    return Response.json(
      { error: "veraktungId ist erforderlich" },
      { status: 400 }
    );
  }

  // Verify the veraktung belongs to this email
  const existing = await prisma.emailVeraktung.findFirst({
    where: { id: veraktungId, emailNachrichtId: id, aufgehoben: false },
    include: {
      akte: { select: { aktenzeichen: true } },
    },
  });
  if (!existing) {
    return Response.json(
      { error: "Veraktung nicht gefunden" },
      { status: 404 }
    );
  }

  try {
    await hebeVeraktungAuf(veraktungId, session.user.id!);

    await logAuditEvent({
      userId: session.user.id,
      akteId: existing.akteId,
      aktion: "EMAIL_VERAKTUNG_AUFGEHOBEN",
      details: {
        emailNachrichtId: id,
        veraktungId,
        aktenzeichen: existing.akte.aktenzeichen,
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Veraktung aufheben error:", error);
    return Response.json(
      { error: "Fehler beim Aufheben der Veraktung" },
      { status: 500 }
    );
  }
}
