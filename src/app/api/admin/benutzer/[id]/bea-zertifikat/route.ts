import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { findeKanzleiKonto } from "@/lib/benutzer/service";
import { fehlerAntwort } from "@/lib/benutzer/http";
import { logAuditEvent } from "@/lib/audit";
import { P12_FEHLER } from "@/lib/bea/expert/krypto";
import {
  speichereZertifikat,
  zertifikatInfo,
  entferneZertifikat,
  ZERTIFIKAT_ABGELAUFEN,
} from "@/lib/bea/zertifikat";

// A beA software certificate is a few KB; anything larger is not a .p12.
const MAX_GROESSE = 100 * 1024;
// Headroom for multipart boundaries and the PIN field
const MAX_ANFRAGE = MAX_GROESSE + 8 * 1024;
const ERLAUBTE_ENDUNGEN = [".p12", ".pfx"];
const ZU_GROSS = "Die Datei ist zu groß für ein beA-Softwarezertifikat (höchstens 100 KB)";

type Kontext = { params: Promise<{ id: string }> };

// GET /api/admin/benutzer/[id]/bea-zertifikat -- certificate metadata (no secrets)
export async function GET(_request: NextRequest, { params }: Kontext) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;
  const { id } = await params;
  try {
    await findeKanzleiKonto(id);
    return NextResponse.json({ zertifikat: await zertifikatInfo(id) });
  } catch (e) {
    return fehlerAntwort(e);
  }
}

// POST /api/admin/benutzer/[id]/bea-zertifikat -- multipart/form-data (datei, pin)
export async function POST(request: NextRequest, { params }: Kontext) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;
  const { id } = await params;
  try {
    await findeKanzleiKonto(id);
  } catch (e) {
    return fehlerAntwort(e);
  }

  // Reject oversized bodies before buffering them in request.formData()
  const laenge = Number(request.headers.get("content-length"));
  if (Number.isFinite(laenge) && laenge > MAX_ANFRAGE) {
    return NextResponse.json({ error: ZU_GROSS }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Bitte Zertifikatsdatei und PIN angeben" }, { status: 400 });
  }
  const datei = form.get("datei");
  const pin = form.get("pin");
  if (!(datei instanceof File) || typeof pin !== "string" || pin.length === 0) {
    return NextResponse.json({ error: "Bitte Zertifikatsdatei und PIN angeben" }, { status: 400 });
  }
  const name = datei.name.toLowerCase();
  if (!ERLAUBTE_ENDUNGEN.some((endung) => name.endsWith(endung))) {
    return NextResponse.json({ error: "Bitte eine .p12- oder .pfx-Datei hochladen" }, { status: 400 });
  }
  if (datei.size > MAX_GROESSE) {
    return NextResponse.json({ error: ZU_GROSS }, { status: 413 });
  }

  let info: Awaited<ReturnType<typeof speichereZertifikat>>;
  try {
    info = await speichereZertifikat(id, Buffer.from(await datei.arrayBuffer()), pin);
  } catch (e) {
    const meldung = e instanceof Error ? e.message : "";
    if (meldung === P12_FEHLER || meldung === ZERTIFIKAT_ABGELAUFEN) {
      return NextResponse.json({ error: meldung }, { status: 400 });
    }
    throw e;
  }

  await logAuditEvent({
    userId: result.session.user.id,
    aktion: "BEA_ZERTIFIKAT_HINTERLEGT",
    details: { benutzerId: id, seriennummer: info.seriennummer, inhaber: info.inhaber, gueltigBis: info.gueltigBis.toISOString() },
  });
  return NextResponse.json({ zertifikat: await zertifikatInfo(id) });
}

// DELETE /api/admin/benutzer/[id]/bea-zertifikat
export async function DELETE(_request: NextRequest, { params }: Kontext) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;
  const { id } = await params;
  try {
    await findeKanzleiKonto(id);
  } catch (e) {
    return fehlerAntwort(e);
  }
  const entfernt = await entferneZertifikat(id);
  if (!entfernt) return NextResponse.json({ error: "Kein Zertifikat hinterlegt" }, { status: 404 });
  await logAuditEvent({
    userId: result.session.user.id,
    aktion: "BEA_ZERTIFIKAT_ENTFERNT",
    details: { benutzerId: id },
  });
  return NextResponse.json({ ok: true });
}
