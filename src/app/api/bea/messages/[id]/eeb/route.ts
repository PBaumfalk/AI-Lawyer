import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, akteAccessDenied } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { pruefeEebDatum } from "@/lib/bea/regeln";
import { getBeaProvider } from "@/lib/bea/provider";
import { mitBeaSitzung, BeaNichtEingerichtetError } from "@/lib/bea/sitzung";
import { createLogger } from "@/lib/logger";

const log = createLogger("bea-eeb");

const eebSchema = z.object({ abgabeDatum: z.string().trim().min(1) });

/** Claim marker while a submission runs; stays set if the outcome is unclear. */
const ABGABE_LAEUFT = "WIRD_ABGEGEBEN";

const NICHT_MOEGLICH = "Für diese Nachricht kann kein eEB abgegeben werden";

/**
 * POST /api/bea/messages/[id]/eeb — submits the eEB (elektronisches
 * Empfangsbekenntnis) server-side through the beA provider.
 *
 * Requires an interactive user session with canSendBeA (agents never send).
 * The provider is called at most once (wiederholen: false); on any provider
 * error the eEB status stays unchanged and 502 is returned.
 *
 * eEB references: aktenzeichenAbsender = our own Aktenzeichen (if the message
 * is assigned to an Akte), aktenzeichenEmpfaenger = the court's file number,
 * which is the sender's number (nachricht.aktenzeichenAbsender) of the
 * incoming message.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requirePermission("canSendBeA");
  if (result.error) return result.error;
  const userId = result.session.user.id;

  const { id } = await params;

  const parsed = eebSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler", details: parsed.error.flatten() }, { status: 400 });
  }
  const { abgabeDatum } = parsed.data;

  const nachricht = await prisma.beaNachricht.findUnique({ where: { id } });
  if (!nachricht) {
    return NextResponse.json({ error: "Nachricht nicht gefunden" }, { status: 404 });
  }
  if (nachricht.akteId) {
    const denied = await akteAccessDenied(result.session, nachricht.akteId);
    if (denied) return denied;
  }

  if (
    nachricht.richtung !== "EINGANG" ||
    !nachricht.eebAngefordert ||
    nachricht.eebStatus === "BESTAETIGT" ||
    !nachricht.xjustizNachrichtenId ||
    !nachricht.postfachSafeId ||
    !nachricht.safeIdAbsender
  ) {
    return NextResponse.json({ error: NICHT_MOEGLICH }, { status: 422 });
  }

  const datumFehler = pruefeEebDatum(abgabeDatum);
  if (datumFehler) {
    return NextResponse.json({ error: datumFehler }, { status: 422 });
  }

  if (!getBeaProvider()) {
    return NextResponse.json({ error: "beA ist nicht eingerichtet" }, { status: 503 });
  }

  const akte = nachricht.akteId
    ? await prisma.akte.findUnique({ where: { id: nachricht.akteId }, select: { aktenzeichen: true } })
    : null;

  const auftrag = {
    postfachSafeId: nachricht.postfachSafeId,
    empfaengerSafeId: nachricht.safeIdAbsender,
    betreff: "Elektronisches Empfangsbekenntnis zu " + (nachricht.aktenzeichenJustiz ?? nachricht.betreff),
    aktenzeichenAbsender: akte?.aktenzeichen || undefined,
    aktenzeichenEmpfaenger: nachricht.aktenzeichenAbsender || undefined,
    fremdId: nachricht.xjustizNachrichtenId,
    abgabeDatum,
  };

  // Atomic claim before the irreversible provider call: of two concurrent
  // requests only one gets count 1 and may submit.
  const vorher = nachricht.eebStatus;
  const claim = await prisma.beaNachricht.updateMany({
    where: { id, eebStatus: { notIn: ["BESTAETIGT", ABGABE_LAEUFT] } },
    data: { eebStatus: ABGABE_LAEUFT },
  });
  if (claim.count === 0) {
    return NextResponse.json({ error: "Das eEB wird bereits abgegeben oder wurde schon abgegeben." }, { status: 409 });
  }
  const zuruecksetzen = async () => {
    try {
      await prisma.beaNachricht.updateMany({ where: { id, eebStatus: ABGABE_LAEUFT }, data: { eebStatus: vorher } });
    } catch (err) {
      log.error({ nachrichtId: id, err: err instanceof Error ? err.message : "Unbekannter Fehler" }, "eEB-Status konnte nicht zurückgesetzt werden");
    }
  };

  try {
    await mitBeaSitzung(userId, (s, p) => p.gibEebAb(s, auftrag), { wiederholen: false });
  } catch (e) {
    await zuruecksetzen();
    if (e instanceof BeaNichtEingerichtetError) {
      return NextResponse.json(
        { error: "Für Ihren Benutzer ist kein gültiges beA-Softwarezertifikat hinterlegt", details: e.message },
        { status: 409 },
      );
    }
    log.warn({ err: e instanceof Error ? e.message : "Unbekannter Fehler" }, "eEB konnte nicht abgegeben werden");
    return NextResponse.json(
      { error: "Das eEB konnte nicht abgegeben werden. Bitte im beA-Webclient prüfen, bevor Sie es erneut versuchen." },
      { status: 502 },
    );
  }

  // Stored as noon UTC so the calendar day is the same in every time zone.
  const eebDatum = new Date(`${abgabeDatum}T12:00:00Z`);
  let warnung: string | undefined;
  try {
    await prisma.beaNachricht.update({
      where: { id },
      data: { eebStatus: "BESTAETIGT", eebDatum },
    });
  } catch (e) {
    // Submitted but not recorded: WIRD_ABGEGEBEN stays and signals "status unclear".
    log.error({ nachrichtId: id, err: e instanceof Error ? e.message : "Unbekannter Fehler" }, "eEB abgegeben, Status nicht gespeichert");
    warnung = "eEB wurde abgegeben, der Status konnte aber nicht gespeichert werden.";
  }

  logAuditEvent({
    userId,
    akteId: nachricht.akteId,
    aktion: "BEA_EEB_BESTAETIGT",
    details: { nachrichtId: id, abgabeDatum, ergebnis: "ERFOLG" },
  }).catch(() => {});

  return NextResponse.json({ success: true, eebDatum: eebDatum.toISOString(), ...(warnung ? { warnung } : {}) });
}
