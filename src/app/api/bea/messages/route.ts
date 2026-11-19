import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { autoAssignToAkte } from "@/lib/bea/auto-assign";
import { parseXJustiz } from "@/lib/xjustiz/parser";
import { aiScanQueue } from "@/lib/queue/queues";
import { requirePermission, akteAccessDenied } from "@/lib/rbac";
import { beaNachrichtSchema } from "@/lib/bea/versand";
import { checkDokumenteFreigegeben, markDokumenteVersendet } from "@/lib/versand-gate";
import { logAuditEvent } from "@/lib/audit";

// --- Validation ---

// Contract shared with bea-compose: src/lib/bea/versand.ts
const createBeaMessageSchema = beaNachrichtSchema;

// --- GET /api/bea/messages ---

export async function GET(request: NextRequest) {
  // RBAC: reading beA requires canReadBeA permission
  const result = await requirePermission("canReadBeA");
  if (result.error) return result.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const akteId = searchParams.get("akteId");
  const q = searchParams.get("q");
  const take = Math.min(parseInt(searchParams.get("take") ?? "50"), 100);
  const skip = parseInt(searchParams.get("skip") ?? "0");

  const where: any = {};

  if (status) {
    where.status = status;
  }
  if (akteId) {
    where.akteId = akteId;
  }
  if (q) {
    where.OR = [
      { betreff: { contains: q, mode: "insensitive" } },
      { absender: { contains: q, mode: "insensitive" } },
      { empfaenger: { contains: q, mode: "insensitive" } },
    ];
  }

  const [nachrichten, total] = await Promise.all([
    prisma.beaNachricht.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        akte: {
          select: { id: true, aktenzeichen: true, kurzrubrum: true },
        },
      },
    }),
    prisma.beaNachricht.count({ where }),
  ]);

  return NextResponse.json({ nachrichten, total });
}

// --- POST /api/bea/messages ---

export async function POST(request: NextRequest) {
  // RBAC: sending beA messages requires canSendBeA (only ANWALT+)
  const result = await requirePermission("canSendBeA");
  if (result.error) return result.error;

  const body = await request.json().catch(() => null);
  const parsed = createBeaMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (data.akteId) {
    const denied = await akteAccessDenied(result.session, data.akteId);
    if (denied) return denied;
  }

  // Versand-Gate: check that all attached DMS documents are FREIGEGEBEN
  if (data.dokumentIds && data.dokumentIds.length > 0) {
    const check = await checkDokumenteFreigegeben(data.dokumentIds);
    if (!check.ok) {
      return NextResponse.json(
        {
          error: "Nicht freigegebene Dokumente koennen nicht versendet werden",
          details: check.errors,
        },
        { status: 400 }
      );
    }
  }

  // Check for duplicate nachrichtenId
  if (data.nachrichtenId) {
    const existing = await prisma.beaNachricht.findUnique({
      where: { nachrichtenId: data.nachrichtenId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Nachricht bereits gespeichert", id: existing.id },
        { status: 409 }
      );
    }
  }

  // Parse XJustiz if XML attachment detected
  let xjustizData: any = null;
  if (data.xjustizXml) {
    xjustizData = parseXJustiz(data.xjustizXml);
  }

  // Check attachments for XJustiz content
  if (!xjustizData && data.anhaenge && Array.isArray(data.anhaenge)) {
    for (const anhang of data.anhaenge) {
      const name = (anhang.name || "").toLowerCase();
      const mime = (anhang.mimeType || "").toLowerCase();
      if (
        name.endsWith(".xml") &&
        (name.includes("xjustiz") || name.includes("nachricht") || mime.includes("xml"))
      ) {
        // Try to parse if content is available as base64
        if (anhang.content) {
          try {
            const xmlString = Buffer.from(anhang.content, "base64").toString("utf-8");
            const parsed = parseXJustiz(xmlString);
            if (parsed.beteiligte.length > 0 || parsed.grunddaten || parsed.termine.length > 0) {
              xjustizData = parsed;
              break;
            }
          } catch {
            // Not valid XJustiz, skip
          }
        }
      }
    }
  }

  // Auto-assign to Akte
  const assignResult = await autoAssignToAkte({
    betreff: data.betreff,
    absender: data.absender,
    inhalt: data.inhalt,
    safeIdAbsender: data.safeIdAbsender,
  });

  // Determine eEB status
  const eebStatus = data.eebErforderlich ? "AUSSTEHEND" : "NICHT_ERFORDERLICH";

  // Create BeaNachricht
  const nachricht = await prisma.beaNachricht.create({
    data: {
      nachrichtenId: data.nachrichtenId || null,
      betreff: data.betreff,
      absender: data.absender,
      empfaenger: data.empfaenger,
      inhalt: data.inhalt || null,
      status: data.status,
      safeIdAbsender: data.safeIdAbsender || null,
      safeIdEmpfaenger: data.safeIdEmpfaenger || null,
      pruefprotokoll: data.pruefprotokoll || null,
      anhaenge: data.anhaenge || null,
      empfangenAm: data.empfangenAm ? new Date(data.empfangenAm) : null,
      gesendetAm: data.gesendetAm ? new Date(data.gesendetAm) : null,
      eebStatus,
      xjustizData: xjustizData || null,
      // Auto-assignment
      // Explicit Akte from the sender wins. Otherwise only an unambiguous
      // match (SICHER) is filed; WAHRSCHEINLICH is returned as a suggestion
      // that a user has to confirm (see auto-assign.ts header).
      akteId: data.akteId ?? (assignResult.confidence === "SICHER" ? assignResult.akteId : null),
    },
    include: {
      akte: {
        select: { id: true, aktenzeichen: true, kurzrubrum: true },
      },
    },
  });

  // Mark DMS documents as VERSENDET after confirmed beA send
  if (data.status === "GESENDET" && data.dokumentIds && data.dokumentIds.length > 0) {
    try {
      await markDokumenteVersendet(data.dokumentIds);
    } catch {
      // Non-fatal: document status update failure should not fail beA message creation
    }
  }

  // Trigger Helena AI scan for beA message content
  if (data.inhalt && data.inhalt.trim().length >= 50) {
    try {
      await aiScanQueue.add("scan-bea", {
        type: "bea" as const,
        id: nachricht.id,
        akteId: nachricht.akteId || undefined,
        content: data.inhalt,
        metadata: {
          betreff: data.betreff,
          absender: data.absender,
        },
      });
    } catch {
      // Non-fatal: don't fail message creation if scan enqueue fails
    }
  }

  // Audit log: beA message sent or received
  const isOutgoing = data.status === "GESENDET";
  logAuditEvent({
    userId: result.session!.user.id,
    akteId: nachricht.akteId,
    aktion: isOutgoing ? "BEA_NACHRICHT_GESENDET" : "BEA_NACHRICHT_EMPFANGEN",
    details: {
      nachrichtId: nachricht.id,
      betreff: data.betreff,
      empfaengerSafeId: data.safeIdEmpfaenger || null,
      anhaengeAnzahl: Array.isArray(data.anhaenge) ? data.anhaenge.length : 0,
      nachrichtenTyp: "NORMAL",
      ergebnis: "ERFOLG",
    },
  }).catch(() => {});

  return NextResponse.json(
    {
      nachricht,
      assignment: {
        vorschlagAkteId: assignResult.akteId,
        confidence: assignResult.confidence,
        reason: assignResult.reason,
      },
    },
    { status: 201 }
  );
}
