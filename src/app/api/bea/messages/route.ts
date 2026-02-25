import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { autoAssignToAkte } from "@/lib/bea/auto-assign";
import { parseXJustiz } from "@/lib/xjustiz/parser";
import { aiScanQueue } from "@/lib/queue/queues";
import { requirePermission } from "@/lib/rbac";
import { checkDokumenteFreigegeben } from "@/lib/versand-gate";
import { logAuditEvent } from "@/lib/audit";

// --- Validation ---

const createBeaMessageSchema = z.object({
  nachrichtenId: z.string().optional(),
  betreff: z.string().min(1, "Betreff ist erforderlich"),
  absender: z.string().min(1, "Absender ist erforderlich"),
  empfaenger: z.string().min(1, "Empfaenger ist erforderlich"),
  inhalt: z.string().optional(),
  status: z.enum(["EINGANG", "GELESEN", "ZUGEORDNET", "GESENDET", "FEHLER"]).default("EINGANG"),
  safeIdAbsender: z.string().optional(),
  safeIdEmpfaenger: z.string().optional(),
  pruefprotokoll: z.any().optional(),
  anhaenge: z.any().optional(),
  dokumentIds: z.array(z.string()).optional(), // DMS document IDs for Versand-Gate check
  empfangenAm: z.string().optional(),
  gesendetAm: z.string().optional(),
  eebErforderlich: z.boolean().optional(),
  xjustizXml: z.string().optional(),
});

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

  const body = await request.json();
  const parsed = createBeaMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

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
      akteId: assignResult.confidence !== "UNSICHER" ? assignResult.akteId : null,
    },
    include: {
      akte: {
        select: { id: true, aktenzeichen: true, kurzrubrum: true },
      },
    },
  });

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
        confidence: assignResult.confidence,
        reason: assignResult.reason,
      },
    },
    { status: 201 }
  );
}
