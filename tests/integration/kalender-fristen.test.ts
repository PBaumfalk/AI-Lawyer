import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createUser, createAkte, asUser, req, params } from "./helpers";
import { buildErledigtRequest, erledigungsAnforderungen } from "@/lib/fristen/erledigung";
import { filterKalenderEintraege, type KalenderListenEintrag } from "@/lib/kalender/eintrag";
import { fristVorlageAusRechnerErgebnis } from "@/lib/fristen/als-frist";
import { buildKalenderPayload } from "@/lib/kalender/payload";

let anwalt: any, akte: any;
const TAG = 864e5;

beforeEach(async () => {
  await resetDb();
  anwalt = await createUser("ANWALT");
  akte = await createAkte({ anwaltId: anwalt.id });
  asUser(anwalt);
});

const frist = (datum: Date, extra: Record<string, unknown> = {}) =>
  prisma.kalenderEintrag.create({
    data: { akteId: akte.id, typ: "FRIST", titel: "Berufungsbegründung", datum, ganztaegig: true, verantwortlichId: anwalt.id, ...extra } as any,
  });

const patchErledigt = async (id: string, json: unknown) => {
  const { PATCH } = await import("@/app/api/kalender/[id]/erledigt/route");
  const r = await PATCH(req("/x", { method: "PATCH", json }) as any, params({ id }));
  return { status: r.status, body: await r.json() };
};

/** Exactly what ErledigungDialog sends: the reasons the shared rules ask for. */
const dialogNutzlast = (e: { typ: string; datum: Date }) => {
  const anf = erledigungsAnforderungen(e);
  return buildErledigtRequest(true, {
    erledigungsgrund: anf.erledigungsgrund ? "Schriftsatz per beA eingereicht" : undefined,
    ueberschreitungsgrund: anf.ueberschreitungsgrund ? "Rechtzeitig eingereicht, Eintrag verspätet abgehakt" : undefined,
  });
};

const heuteUtcMitternacht = () => new Date(new Date().toISOString().slice(0, 10));

describe("Fristen erledigen: Oberfläche fragt genau die Gründe ab, die die Route verlangt", () => {
  it("künftige, heutige und überfällige Fristen sowie Wiedervorlagen lassen sich mit der Dialog-Nutzlast erledigen", async () => {
    const eintraege = [
      await frist(new Date(Date.now() + 5 * TAG)),
      await frist(heuteUtcMitternacht()),
      await frist(new Date(Date.now() - 3 * TAG)),
      await frist(new Date(Date.now() - 3 * TAG), { typ: "WIEDERVORLAGE" }),
    ];
    for (const e of eintraege) {
      const r = await patchErledigt(e.id, dialogNutzlast(e));
      expect(r.status, `${e.typ} ${e.datum.toISOString()}: ${JSON.stringify(r.body)}`).toBe(200);
      expect(r.body.erledigt).toBe(true);
    }
  });

  it("Frist mit Ablauf heute braucht keinen Überschreitungsgrund (§ 188 Abs. 1 BGB)", async () => {
    const f = await frist(heuteUtcMitternacht());
    expect(erledigungsAnforderungen(f).ueberschreitungsgrund).toBe(false);
    const r = await patchErledigt(f.id, { erledigt: true, erledigungsgrund: "fristgerecht eingereicht" });
    expect(r.status).toBe(200);
  });

  it("Pflicht bleibt: Frist ohne Grund und überfällige Frist ohne Überschreitungsgrund werden abgelehnt", async () => {
    const f = await frist(new Date(Date.now() + 5 * TAG));
    expect((await patchErledigt(f.id, buildErledigtRequest(true))).status).toBe(400);
    const alt = await frist(new Date(Date.now() - 3 * TAG));
    const ohne = await patchErledigt(alt.id, { erledigt: true, erledigungsgrund: "eingereicht" });
    expect(ohne.status).toBe(400);
    expect(ohne.body.error).toMatch(/Überschreitungsgrund/);
    const leer = await patchErledigt(alt.id, { erledigt: true, erledigungsgrund: "eingereicht", ueberschreitungsgrund: "   " });
    expect(leer.status).toBe(400);
    expect((await prisma.kalenderEintrag.findUniqueOrThrow({ where: { id: alt.id } })).erledigt).toBe(false);
  });

  it("Überschreitungsgrund landet im Audit-Log, Wiedereröffnen braucht keinen Grund", async () => {
    const alt = await frist(new Date(Date.now() - 3 * TAG));
    expect((await patchErledigt(alt.id, dialogNutzlast(alt))).status).toBe(200);
    const log = await prisma.auditLog.findFirst({ where: { aktion: "FRIST_ERLEDIGT" }, orderBy: { createdAt: "desc" } });
    expect((log?.details as any)?.ueberschreitungsgrund).toMatch(/verspätet/);
    expect((log?.details as any)?.istUeberfaellig).toBe(true);
    const r = await patchErledigt(alt.id, buildErledigtRequest(false));
    expect(r.status).toBe(200);
    expect(r.body.erledigungsgrund).toBeNull();
  });

  it("ungültiges JSON ergibt 400 statt 500", async () => {
    const f = await frist(new Date(Date.now() + TAG));
    const { PATCH } = await import("@/app/api/kalender/[id]/erledigt/route");
    const r = await PATCH(req("/x", { method: "PATCH", body: "{kaputt", headers: { "content-type": "application/json" } }) as any, params({ id: f.id }));
    expect(r.status).toBe(400);
  });
});

describe("Kalender mit externen CalDAV-Terminen", () => {
  beforeEach(async () => {
    const konto = await prisma.calDavKonto.create({ data: { userId: anwalt.id, name: "Google privat", provider: "GOOGLE", serverUrl: "https://x", benutzername: "u", aktiv: true } as any });
    const m = (uid: string, externalData: any) =>
      prisma.calDavSyncMapping.create({ data: { kontoId: konto.id, richtung: "PULL", externalUid: uid, letzterSync: new Date(), externalData } });
    await m("ok", { summary: "Zahnarzt", dtstart: new Date().toISOString() });
    await m("ohne-start", { summary: "Kaputt" });
    await m("ungueltig", { summary: "Kaputt", dtstart: "kein Datum" });
    await frist(new Date(Date.now() + TAG));
  });
  const get = async (qs: string) => {
    const { GET } = await import("@/app/api/kalender/route");
    const r = await GET(req(`/api/kalender${qs}`) as any);
    expect(r.status).toBe(200);
    return (await r.json()) as KalenderListenEintrag[];
  };

  it("Gesamtliste enthält den externen Termin ohne Verantwortlichen; Suche stürzt nicht ab", async () => {
    const items = await get("?erledigt=false");
    const ext = items.filter((i) => i.typ === "EXTERN");
    expect(ext.map((i) => i.titel)).toEqual(["Zahnarzt"]);
    expect(ext[0].verantwortlich).toBeNull();
    expect(ext[0].kontoName).toBe("Google privat");
    expect(filterKalenderEintraege(items, "zahn").map((i) => i.titel)).toEqual(["Zahnarzt"]);
    expect(filterKalenderEintraege(items, anwalt.name.slice(0, 6))).toHaveLength(1);
  });

  it("Akte-Kalender und gefilterte Ansichten enthalten keine externen Termine", async () => {
    for (const qs of [`?akteId=${akte.id}`, "?typ=FRIST", "?erledigt=true", "?istNotfrist=true", "?prioritaet=HOCH"]) {
      const items = await get(qs);
      expect(items.some((i) => i.typ === "EXTERN"), qs).toBe(false);
      expect(items.every((i) => i.verantwortlich?.name), qs).toBe(true);
    }
  });

  it("externe Termine anderer Benutzer erscheinen nicht", async () => {
    asUser(await createUser("ANWALT"));
    expect((await get("")).some((i) => i.typ === "EXTERN")).toBe(false);
  });
});

describe("Fristenrechner „Als Frist speichern“", () => {
  it("die berechnete Frist wird mit Vorfristen und Halbfrist im Kalender angelegt", async () => {
    const formData = {
      zustellungsdatum: new Date("2026-11-03T00:00:00").toISOString(),
      fristArt: "EREIGNISFRIST", dauer: { monate: 1 }, bundesland: "NW",
      section193: true, richtung: "vorwaerts", sonderfall: null,
    };
    const rechner = await import("@/app/api/fristen/rechner/route");
    const rr = await rechner.POST(req("/x", { method: "POST", json: formData }) as any);
    expect(rr.status).toBe(200);
    // As FristenRechnerForm hands it to the result view (JSON + form fields)
    const result = { ...(await rr.json()), istNotfrist: true, formData };

    const vorlage = fristVorlageAusRechnerErgebnis(result);
    expect(vorlage).not.toBeNull();
    const payload = buildKalenderPayload(
      { typ: vorlage!.typ, titel: vorlage!.titel, beschreibung: vorlage!.beschreibung, datum: vorlage!.datum, datumBis: "", ganztaegig: true, akteId: akte.id, verantwortlichId: anwalt.id, fristablauf: vorlage!.fristablauf, vorfrist: "" },
      vorlage!.zusatz,
    );
    const kal = await import("@/app/api/kalender/route");
    const r = await kal.POST(req("/x", { method: "POST", json: payload }) as any);
    const body = await r.json();
    expect(r.status, JSON.stringify(body)).toBe(201);

    // 03.11.2026 + 1 Monat = 03.12.2026 (Do), kein Feiertag NW
    const gespeichert = await prisma.kalenderEintrag.findUniqueOrThrow({ where: { id: body.id } });
    expect(gespeichert.datum.toISOString().slice(0, 10)).toBe("2026-12-03");
    expect(gespeichert.istNotfrist).toBe(true);
    expect(gespeichert.fristArt).toBe("EREIGNISFRIST");
    expect(gespeichert.vorfristen.length).toBe(result.vorfristen.length);
    expect(gespeichert.halbfrist).not.toBeNull();
    expect(await prisma.kalenderEintrag.count({ where: { hauptfristId: body.id } })).toBe(result.vorfristen.length);
  });
});
