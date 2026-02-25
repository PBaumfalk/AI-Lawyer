import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";

// --- Validation ---

const patchSchema = z.object({
  akteId: z.string().nullable().optional(),
  status: z.enum(["EINGANG", "GELESEN", "ZUGEORDNET", "GESENDET", "FEHLER"]).optional(),
  eebStatus: z.string().optional(),
});

// --- GET /api/bea/messages/[id] ---

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // RBAC: reading beA requires canReadBeA permission
  const result = await requirePermission("canReadBeA");
  if (result.error) return result.error;

  const { id } = await params;

  const nachricht = await prisma.beaNachricht.findUnique({
    where: { id },
    include: {
      akte: {
        select: { id: true, aktenzeichen: true, kurzrubrum: true },
      },
    },
  });

  if (!nachricht) {
    return NextResponse.json({ error: "Nachricht nicht gefunden" }, { status: 404 });
  }

  // Audit log: beA message read
  logAuditEvent({
    userId: result.session!.user.id,
    akteId: nachricht.akteId,
    aktion: "BEA_NACHRICHT_GELESEN",
    details: {
      nachrichtId: nachricht.id,
      betreff: nachricht.betreff,
      absender: nachricht.absender,
      ergebnis: "ERFOLG",
    },
  }).catch(() => {});

  // Check for attachment download logging
  const { searchParams } = new URL(_request.url);
  const downloadAttachmentId = searchParams.get("download");
  if (downloadAttachmentId) {
    const attachments = Array.isArray(nachricht.anhaenge) ? (nachricht.anhaenge as any[]) : [];
    const attachment = attachments.find((a) => a.id === downloadAttachmentId);
    logAuditEvent({
      userId: result.session!.user.id,
      akteId: nachricht.akteId,
      aktion: "BEA_ANHANG_HERUNTERGELADEN",
      details: {
        nachrichtId: nachricht.id,
        anhangId: downloadAttachmentId,
        anhangName: attachment?.name || "Unbekannt",
        anhangGroesse: attachment?.size || null,
        ergebnis: "ERFOLG",
      },
    }).catch(() => {});
  }

  return NextResponse.json(nachricht);
}

// --- PATCH /api/bea/messages/[id] ---

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // RBAC: modifying beA messages requires canSendBeA (ANWALT+)
  const result = await requirePermission("canSendBeA");
  if (result.error) return result.error;

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.beaNachricht.findUnique({
    where: { id },
    select: { id: true, akteId: true, betreff: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Nachricht nicht gefunden" }, { status: 404 });
  }

  const updateData: any = {};
  if (parsed.data.akteId !== undefined) {
    updateData.akteId = parsed.data.akteId;
    // If assigning to an Akte, set status to ZUGEORDNET
    if (parsed.data.akteId && !parsed.data.status) {
      updateData.status = "ZUGEORDNET";
    }
  }
  if (parsed.data.status) {
    updateData.status = parsed.data.status;
  }
  if (parsed.data.eebStatus) {
    updateData.eebStatus = parsed.data.eebStatus;
  }

  const nachricht = await prisma.beaNachricht.update({
    where: { id },
    data: updateData,
    include: {
      akte: {
        select: { id: true, aktenzeichen: true, kurzrubrum: true },
      },
    },
  });

  // Audit log: assignment change
  if (parsed.data.akteId !== undefined) {
    logAuditEvent({
      userId: result.session!.user.id,
      akteId: nachricht.akteId,
      aktion: "BEA_ZUORDNUNG_GEAENDERT",
      details: {
        nachrichtId: nachricht.id,
        betreff: existing.betreff,
        alteAkteId: existing.akteId || null,
        neueAkteId: parsed.data.akteId,
        ergebnis: "ERFOLG",
      },
    }).catch(() => {});
  }

  return NextResponse.json(nachricht);
}
