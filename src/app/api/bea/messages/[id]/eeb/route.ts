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

  try {
    await mitBeaSitzung(userId, (s, p) => p.gibEebAb(s, auftrag), { wiederholen: false });
  } catch (e) {
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
  await prisma.beaNachricht.update({
    where: { id },
    data: { eebStatus: "BESTAETIGT", eebDatum },
  });

  logAuditEvent({
    userId,
    akteId: nachricht.akteId,
    aktion: "BEA_EEB_BESTAETIGT",
    details: { nachrichtId: id, abgabeDatum, ergebnis: "ERFOLG" },
  }).catch(() => {});

  return NextResponse.json({ success: true, eebDatum: eebDatum.toISOString() });
}
