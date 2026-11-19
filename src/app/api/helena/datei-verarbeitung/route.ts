/**
 * POST /api/helena/datei-verarbeitung
 *
 * multipart/form-data: dateien (1..10 files), auftrag (string), aufgabe (see modelle.ts),
 * akteId (optional: known values of the Beteiligte for the egress guard)
 *
 * Runs the privacy-first Datei-Pipeline: local conversion, anymize
 * anonymisation, local egress guard, LLM on placeholders only, local
 * re-identification. The result is a draft for human review.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAkteAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { verarbeiteDateien, MAX_DATEIEN } from "@/lib/helena/datei-pipeline/pipeline";
import { pipelineAbhaengigkeiten, bekannteWerteDerAkte } from "@/lib/helena/datei-pipeline/aus-einstellungen";
import { AUFGABEN, type Aufgabe } from "@/lib/helena/datei-pipeline/modelle";
import { PipelineFehler, type EingangsDatei } from "@/lib/helena/datei-pipeline/types";
import { MAX_DATEI_BYTES } from "@/lib/helena/datei-pipeline/konvertieren";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Authenticate before accepting any upload body.
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (auth.session.user.role === "MANDANT") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage (multipart/form-data erwartet)" }, { status: 400 });
  }

  const akteId = typeof form.get("akteId") === "string" ? String(form.get("akteId")) : "";
  const zugriff = akteId ? await requireAkteAccess(akteId, { requireEdit: true }) : auth;
  if (zugriff.error) return zugriff.error;
  const { session } = zugriff;

  const auftrag = String(form.get("auftrag") ?? "").slice(0, 4000);
  const aufgabeRoh = String(form.get("aufgabe") ?? "allgemein");
  if (!(AUFGABEN as readonly string[]).includes(aufgabeRoh)) {
    return NextResponse.json({ error: `Unbekannte Aufgabe, erlaubt: ${AUFGABEN.join(", ")}` }, { status: 400 });
  }
  const aufgabe = aufgabeRoh as Aufgabe;
  const eintraege = form.getAll("dateien").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (eintraege.length === 0 || eintraege.length > MAX_DATEIEN) {
    return NextResponse.json({ error: `1 bis ${MAX_DATEIEN} Dateien erforderlich` }, { status: 400 });
  }
  if (eintraege.some((f) => f.size > MAX_DATEI_BYTES)) {
    return NextResponse.json({ error: "Eine Datei überschreitet 25 MB" }, { status: 413 });
  }

  const dateien: EingangsDatei[] = await Promise.all(
    eintraege.map(async (f) => ({ daten: Buffer.from(await f.arrayBuffer()), dateiname: f.name, mimeType: f.type })),
  );

  try {
    const { auswahl, ...abh } = await pipelineAbhaengigkeiten({ aufgabe });
    const bekannteWerte = akteId ? await bekannteWerteDerAkte(akteId) : [];
    const r = await verarbeiteDateien({
      dateien,
      auftrag,
      aufgabe,
      bekannteWerte,
      zusatzHinweise: auswahl.hinweise,
      ...abh,
    });

    await logAuditEvent({
      userId: session.user.id,
      akteId: akteId || null,
      aktion: "HELENA_DATEI_VERARBEITET",
      details: { ...auditDetails(r.protokoll), modell: auswahl.modell },
    });
    return NextResponse.json({ ergebnis: r.ergebnis, protokoll: oeffentlich(r.protokoll) });
  } catch (e) {
    const f = e instanceof PipelineFehler ? e : new PipelineFehler("einlesen", "INTERNER_FEHLER", "Interner Fehler");
    await logAuditEvent({
      userId: session.user.id,
      akteId: akteId || null,
      aktion: "HELENA_DATEI_GESTOPPT",
      details: { schritt: f.schritt, code: f.code, ...(f.protokoll ? auditDetails(f.protokoll) : {}) },
    }).catch(() => {});
    const status = f.code === "NICHT_EINGERICHTET" ? 503 : f.code === "PII_IM_AUSGANG" ? 422 : f.schritt === "einlesen" || f.schritt === "konvertieren" ? 400 : 502;
    return NextResponse.json(
      { error: f.message, code: f.code, schritt: f.schritt, protokoll: f.protokoll ? oeffentlich(f.protokoll) : undefined },
      { status },
    );
  } finally {
    for (const d of dateien) d.daten.fill(0);
  }
}

type Protokoll = NonNullable<PipelineFehler["protokoll"]>;

function auditDetails(p: Protokoll) {
  return {
    laufId: p.laufId,
    format: p.format,
    bytes: p.bytes,
    ersetzungen: p.ersetzungen,
    guardOk: p.guardOk,
    guardFunde: p.guardFunde.map((g) => g.kategorie),
    anymizeJobsGeloescht: p.anymizeJobsGeloescht,
    nichtGeloeschteJobs: p.nichtGeloeschteJobs,
    verarbeiter: p.verarbeiter,
    aufgabe: p.aufgabe,
    nutzung: p.nutzung,
  };
}

function oeffentlich(p: Protokoll) {
  const { nichtGeloeschteJobs: _n, ...rest } = p;
  return rest;
}
