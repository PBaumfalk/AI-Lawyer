import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { requirePermission, akteAccessDenied } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { getFileStream } from "@/lib/storage";
import { legeDokumenteAn } from "@/lib/bea/abruf";

// --- Validation ---

const patchSchema = z.object({
  akteId: z.string().nullable().optional(),
  // GESENDET and eEB BESTAETIGT are only recorded by POST /api/bea/messages and
  // POST /api/bea/messages/[id]/eeb, after bea.expert confirmed the action.
  status: z.enum(["EINGANG", "GELESEN", "ZUGEORDNET", "FEHLER"]).optional(),
  eebStatus: z.enum(["AUSSTEHEND", "NICHT_ERFORDERLICH"]).optional(),
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
        anhangGroesse: attachment?.groesse ?? attachment?.size ?? null,
        ergebnis: "ERFOLG",
      },
    }).catch(() => {});

    // Attachments retrieved via bea.expert are stored in MinIO under storageKey
    if (attachment?.storageKey) {
      try {
        const stream = await getFileStream(attachment.storageKey);
        if (!stream) {
          return NextResponse.json({ error: "Datei nicht gefunden im Speicher" }, { status: 404 });
        }
        return new NextResponse(stream.transformToWebStream() as any, {
          headers: {
            "Content-Type": attachment.mimeType || "application/octet-stream",
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
          },
        });
      } catch {
        return NextResponse.json({ error: "Datei konnte nicht geladen werden" }, { status: 500 });
      }
    }
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
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  if (parsed.data.akteId) {
    const denied = await akteAccessDenied(result.session, parsed.data.akteId);
    if (denied) return denied;
  }

  const existing = await prisma.beaNachricht.findUnique({
    where: { id },
    select: { id: true, akteId: true, betreff: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Nachricht nicht gefunden" }, { status: 404 });
  }

  // On (re)assignment create the Akte documents first, so a failure changes nothing.
  // Idempotent: attachments that already have a document are skipped.
  if (parsed.data.akteId && parsed.data.akteId !== existing.akteId) {
    try {
      await legeDokumenteAn(id, parsed.data.akteId, result.session!.user.id);
    } catch (e) {
      console.error(`[bea] Dokumente für Nachricht ${id} nicht angelegt:`, e instanceof Error ? e.message : e);
      return NextResponse.json(
        { error: "Die Anhänge konnten nicht in der Akte abgelegt werden" },
        { status: 500 }
      );
    }
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
