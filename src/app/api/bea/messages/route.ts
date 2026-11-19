import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission, akteAccessDenied } from "@/lib/rbac";
import { beaVersandSchema, VERSANDSTATUS_UNKLAR, type BeaVersandRequest } from "@/lib/bea/versand";
import { pruefeVersand } from "@/lib/bea/regeln";
import { loeseVersandDokumenteAuf, type VersandDokument } from "@/lib/bea/versand-dokumente";
import { getBeaProvider, type BeaVersandAuftrag } from "@/lib/bea/provider";
import { mitBeaSitzung, BeaNichtEingerichtetError } from "@/lib/bea/sitzung";
import { markDokumenteVersendet } from "@/lib/versand-gate";
import { getFileStream } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { createLogger } from "@/lib/logger";

const log = createLogger("bea-versand");

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

async function ladeInhalt(dateipfad: string): Promise<Buffer> {
  const body = await getFileStream(dateipfad);
  if (!body) throw new Error("Datei nicht gefunden im Speicher");
  return Buffer.from(await body.transformToByteArray());
}

function pruefe(data: BeaVersandRequest, anhaenge: { name: string; groesse: number }[]) {
  return pruefeVersand({ ...data, anhaenge });
}

function fehlermeldung(e: unknown): string {
  return e instanceof Error ? e.message : "Unbekannter Fehler";
}

/**
 * POST /api/bea/messages — sends a beA message (or saves it as a draft in beA)
 * server-side through the beA provider. Requires an interactive user session
 * with canSendBeA; system users (Helena, agents) cannot log in and never send.
 *
 * The provider is called at most once (mitBeaSitzung with wiederholen: false).
 * If it fails after the call started, the outcome is unknown: the message is
 * stored as FEHLER with the hint VERSANDSTATUS_UNKLAR and 502 is returned.
 * Failures before the call (e.g. beA outage during the session check) store
 * nothing, because nothing can have been sent; they also answer 502.
 */
export async function POST(request: NextRequest) {
  const result = await requirePermission("canSendBeA");
  if (result.error) return result.error;
  const userId = result.session.user.id;

  const parsed = beaVersandSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.akteId) {
    const denied = await akteAccessDenied(result.session, data.akteId);
    if (denied) return denied;
  }

  if (!getBeaProvider()) {
    return NextResponse.json({ error: "beA ist nicht eingerichtet" }, { status: 503 });
  }

  // Versand-Gate: every attachment must be accessible and FREIGEGEBEN
  const user = { id: userId, role: result.session.user.role as UserRole };
  const doks = await loeseVersandDokumenteAuf(user, data.anhaenge);
  if (!doks.ok) {
    return NextResponse.json({ error: doks.error, details: doks.errors }, { status: doks.status });
  }

  // Rules check on DMS metadata first, so oversized sets are rejected without loading them.
  const vorab = pruefe(data, doks.dokumente.map((d) => ({ name: d.name, groesse: d.groesse })));
  if (vorab.fehler.length > 0 || vorab.verstoesse.length > 0) {
    return NextResponse.json(vorab, { status: 422 });
  }

  let anhaenge: (VersandDokument & { inhalt: Buffer })[];
  try {
    anhaenge = await Promise.all(doks.dokumente.map(async (d) => ({ ...d, inhalt: await ladeInhalt(d.dateipfad) })));
  } catch (e) {
    log.error({ err: fehlermeldung(e) }, "beA-Anhang konnte nicht geladen werden");
    return NextResponse.json(
      { error: "Ein Anhang konnte nicht geladen werden. Es wurde nichts gesendet." },
      { status: 500 },
    );
  }

  // Final check with the real sizes of the loaded contents.
  const pruefung = pruefe(data, anhaenge.map((a) => ({ name: a.name, groesse: a.inhalt.length })));
  if (pruefung.fehler.length > 0 || pruefung.verstoesse.length > 0) {
    return NextResponse.json(pruefung, { status: 422 });
  }

  const auftrag: BeaVersandAuftrag = {
    postfachSafeId: data.postfachSafeId,
    empfaengerSafeIds: data.empfaengerSafeIds,
    betreff: data.betreff,
    text: data.text,
    aktenzeichenAbsender: data.aktenzeichenAbsender || undefined,
    aktenzeichenEmpfaenger: data.aktenzeichenEmpfaenger || undefined,
    nachrichtenTyp: data.nachrichtenTyp,
    eebAnfordern: data.eebAnfordern,
    dringend: data.dringend,
    anhaenge: anhaenge.map((a) => ({ name: a.name, inhalt: a.inhalt, art: a.art })),
  };

  const datensatz = (status: "GESENDET" | "EINGANG" | "FEHLER", nachrichtenId: string | null) => ({
    akteId: data.akteId ?? null,
    nachrichtenId,
    richtung: "AUSGANG" as const,
    status,
    betreff: data.betreff,
    absender: data.postfachSafeId,
    empfaenger: data.empfaengerSafeIds.join(", "),
    inhalt: status === "FEHLER" ? `${VERSANDSTATUS_UNKLAR}\n\n${data.text}` : data.text || null,
    postfachSafeId: data.postfachSafeId,
    safeIdAbsender: data.postfachSafeId,
    safeIdEmpfaenger: data.empfaengerSafeIds.join(", "),
    aktenzeichenAbsender: data.aktenzeichenAbsender || null,
    aktenzeichenJustiz: data.aktenzeichenEmpfaenger || null,
    eebAngefordert: data.eebAnfordern,
    gesendetAm: status === "GESENDET" ? new Date() : null,
    anhaenge: anhaenge.map((a) => ({
      name: a.name, storageKey: a.dateipfad, mimeType: a.mimeType, groesse: a.inhalt.length, art: a.art, dokumentId: a.id,
    })),
  });

  const auditDetails = {
    betreff: data.betreff,
    empfaengerSafeIds: data.empfaengerSafeIds,
    anhaengeAnzahl: anhaenge.length,
    nachrichtenTyp: data.nachrichtenTyp,
    entwurf: data.alsEntwurf,
  };

  let gestartet = false;
  let messageId: string | null;
  try {
    const ergebnis = await mitBeaSitzung(
      userId,
      (s, p) => {
        gestartet = true;
        return data.alsEntwurf ? p.speichereEntwurf(s, auftrag) : p.sende(s, auftrag);
      },
      { wiederholen: false },
    );
    messageId = ergebnis.messageId;
  } catch (e) {
    if (!gestartet) {
      if (e instanceof BeaNichtEingerichtetError) {
        return NextResponse.json(
          { error: "Für Ihren Benutzer ist kein gültiges beA-Softwarezertifikat hinterlegt", details: e.message },
          { status: 409 },
        );
      }
      log.warn({ err: fehlermeldung(e) }, "beA vor dem Versand nicht erreichbar");
      return NextResponse.json(
        { error: "beA ist derzeit nicht erreichbar. Es wurde nichts gesendet." },
        { status: 502 },
      );
    }
    return versandUnklar(userId, datensatz("FEHLER", null), auditDetails, fehlermeldung(e));
  }

  // A send without beA message ID cannot be confirmed: treat it as unclear.
  if (!data.alsEntwurf && !messageId) {
    return versandUnklar(userId, datensatz("FEHLER", null), auditDetails, "Keine Nachrichten-ID vom beA erhalten");
  }

  let nachricht;
  try {
    nachricht = await prisma.beaNachricht.create({
      data: datensatz(data.alsEntwurf ? "EINGANG" : "GESENDET", messageId),
    });
  } catch (e) {
    log.error({ err: fehlermeldung(e), messageId }, "beA-Nachricht konnte nach dem Versand nicht gespeichert werden");
    return NextResponse.json(
      {
        error: data.alsEntwurf
          ? `Der Entwurf wurde im beA gespeichert (Nachrichten-ID ${messageId ?? "unbekannt"}), konnte aber hier nicht gespeichert werden.`
          : `Die Nachricht wurde über beA versendet (Nachrichten-ID ${messageId}), konnte aber nicht gespeichert werden. Bitte manuell in der Akte vermerken.`,
      },
      { status: 500 },
    );
  }

  if (!data.alsEntwurf && anhaenge.length > 0) {
    try {
      await markDokumenteVersendet(anhaenge.map((a) => a.id));
    } catch (e) {
      // Non-fatal: the message is sent and recorded
      log.warn({ err: fehlermeldung(e) }, "Dokumentstatus VERSENDET konnte nicht gesetzt werden");
    }
  }

  logAuditEvent({
    userId,
    akteId: nachricht.akteId,
    aktion: "BEA_NACHRICHT_GESENDET",
    details: { nachrichtId: nachricht.id, ...auditDetails, ergebnis: "ERFOLG" },
  }).catch(() => {});

  return NextResponse.json({ nachricht, warnungen: pruefung.warnungen }, { status: 201 });
}

/** Stores a message with unknown send outcome as FEHLER and answers 502. Never retries. */
async function versandUnklar(
  userId: string,
  data: Parameters<typeof prisma.beaNachricht.create>[0]["data"],
  auditDetails: Record<string, unknown>,
  ursache: string,
) {
  log.error({ err: ursache }, "beA-Versandstatus unklar");
  let nachricht = null;
  try {
    nachricht = await prisma.beaNachricht.create({ data });
  } catch (e) {
    log.error({ err: fehlermeldung(e) }, "beA-Nachricht mit unklarem Versandstatus konnte nicht gespeichert werden");
  }
  logAuditEvent({
    userId,
    akteId: nachricht?.akteId ?? null,
    aktion: "BEA_NACHRICHT_FEHLER",
    details: { nachrichtId: nachricht?.id ?? null, ...auditDetails, ursache, ergebnis: "UNKLAR" },
  }).catch(() => {});
  return NextResponse.json({ error: VERSANDSTATUS_UNKLAR, nachricht }, { status: 502 });
}
