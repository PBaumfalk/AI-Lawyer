// Finanzen: Verträge zwischen Oberfläche und API.
// Jede Anfrage wird mit genau dem Builder erzeugt, den auch die Komponente
// verwendet (src/lib/finance/*/contract.ts), und gegen die echte Route + DB geschickt.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createUser, createAkte, createKontakt, asUser, req, params } from "./helpers";
import {
  buildInvoiceActionBody,
  buildInvoiceListQuery,
  runInvoiceBatchAction,
  type CreateInvoiceResponse,
  type InvoiceDetailDto,
  type InvoiceListResponse,
} from "@/lib/finance/invoice/contract";
import { buildRvgSaveBody, type RvgSaveResponse } from "@/lib/finance/rvg/contract";
import { buildBookingBody, buildStornoBody, type AktenkontoBuchungDto } from "@/lib/finance/aktenkonto/contract";

vi.mock("@/lib/gamification/quest-service", () => ({ enqueueQuestCheck: vi.fn() }));

let anwalt: any, akte: any, mandant: any;

beforeEach(async () => {
  await resetDb();
  anwalt = await createUser("ANWALT");
  akte = await createAkte({ anwaltId: anwalt.id });
  mandant = await createKontakt({ nachname: "Zander" });
  await prisma.beteiligter.create({ data: { akteId: akte.id, kontaktId: mandant.id, rolle: "MANDANT" } });
  asUser(anwalt);
});

const rechnung = (nr: string, extra: Record<string, unknown> = {}) =>
  prisma.rechnung.create({
    data: { akteId: akte.id, rechnungsnummer: nr, betragNetto: 100, betragBrutto: 119, restBetrag: 119, positionen: [], ...extra } as any,
  });

const liste = async (q: Parameters<typeof buildInvoiceListQuery>[0]) => {
  const { GET } = await import("@/app/api/finanzen/rechnungen/route");
  const res = await GET(req(`/api/finanzen/rechnungen?${buildInvoiceListQuery(q)}`));
  return { status: res.status, body: (await res.json()) as InvoiceListResponse };
};

const aktion = async (id: string, body: unknown) => {
  const { PATCH } = await import("@/app/api/finanzen/rechnungen/[id]/route");
  return PATCH(req("/x", { method: "PATCH", json: body }), params({ id }));
};

const detail = async (id: string) => {
  const { GET } = await import("@/app/api/finanzen/rechnungen/[id]/route");
  return (await (await GET(req("/x"), params({ id }))).json()) as InvoiceDetailDto;
};

describe("Rechnungsliste", () => {
  it("liefert stornoquote, Beträge als Euro-Zahlen und alle KPI-Felder", async () => {
    await rechnung("RE-1", { status: "GESTELLT", betragBrutto: 238, restBetrag: 238, faelligAm: new Date(Date.now() - 86400000) });
    await rechnung("RE-2", { status: "STORNIERT" });
    await rechnung("GS-1", { status: "STORNIERT", stornoVon: "RE-2" }); // Stornobeleg zählt nicht
    await rechnung("RE-3", { status: "BEZAHLT", betragNetto: 500 });
    await rechnung("RE-4"); // Entwurf zählt nicht

    const { status, body } = await liste({ page: 1, limit: 20, sortBy: "rechnungsdatum", sortDir: "desc" });
    expect(status).toBe(200);
    expect(body.stats).toEqual({ gesamtUmsatz: 500, offeneForderungen: 238, ueberfaellig: 1, stornoquote: 33.3 });
    const re1 = body.rechnungen.find((r) => r.rechnungsnummer === "RE-1")!;
    expect(re1.betragBrutto).toBe(238);
    expect(re1.mandantName).toContain("Zander");
  });

  it("stornoquote ist 0 ohne Rechnungen (keine Division durch 0)", async () => {
    const { body } = await liste({});
    expect(body.rechnungen).toEqual([]);
    expect(body.stats.stornoquote).toBe(0);
  });

  it("blättert mit page/limit und sortiert mit sortBy/sortDir", async () => {
    await rechnung("RE-1", { rechnungsdatum: new Date("2026-01-01"), betragBrutto: 300 });
    await rechnung("RE-2", { rechnungsdatum: new Date("2026-02-01"), betragBrutto: 100 });
    await rechnung("RE-3", { rechnungsdatum: new Date("2026-03-01"), betragBrutto: 200 });

    const seite2 = await liste({ page: 2, limit: 1, sortBy: "rechnungsdatum", sortDir: "desc" });
    expect(seite2.body.rechnungen.map((r) => r.rechnungsnummer)).toEqual(["RE-2"]);
    expect(seite2.body.total).toBe(3);

    const nachBetrag = await liste({ sortBy: "betragBrutto", sortDir: "asc" });
    expect(nachBetrag.body.rechnungen.map((r) => r.rechnungsnummer)).toEqual(["RE-2", "RE-3", "RE-1"]);
  });

  it("sucht nach Rechnungsnummer und Mandantenname", async () => {
    await rechnung("RE-2026-0001");
    const fremdeAkte = await createAkte({ anwaltId: anwalt.id });
    await prisma.rechnung.create({
      data: { akteId: fremdeAkte.id, rechnungsnummer: "RE-2026-0002", betragNetto: 1, betragBrutto: 1, positionen: [] } as any,
    });
    expect((await liste({ search: "0001" })).body.rechnungen.map((r) => r.rechnungsnummer)).toEqual(["RE-2026-0001"]);
    expect((await liste({ search: "zand" })).body.rechnungen.map((r) => r.rechnungsnummer)).toEqual(["RE-2026-0001"]);
  });

  it("lehnt unbekannte Sortierfelder ab statt sie zu ignorieren", async () => {
    const { GET } = await import("@/app/api/finanzen/rechnungen/route");
    expect((await GET(req("/api/finanzen/rechnungen?sortBy=mandantName"))).status).toBe(400);
  });
});

describe("Rechnungsansicht", () => {
  it("'Bezahlt markieren' schickt eine gültige Aktion und setzt BEZAHLT", async () => {
    const r = await rechnung("RE-1", { status: "GESTELLT" });
    const res = await aktion(r.id, buildInvoiceActionBody("bezahlen"));
    expect(res.status).toBe(200);
    expect((await prisma.rechnung.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("BEZAHLT");
  });

  it("eine falsch geschriebene Aktion wird abgelehnt und ändert nichts", async () => {
    const r = await rechnung("RE-1");
    const res = await aktion(r.id, { action: "bezahlt" });
    expect(res.status).toBe(400);
    expect(await prisma.auditLog.count({ where: { aktion: "RECHNUNG_BEARBEITET" } })).toBe(0);
  });

  it("liefert Restbetrag, Teilzahlungen und Mahnungen in den Feldern der Ansicht", async () => {
    const r = await rechnung("RE-1", { status: "GESTELLT" });
    await prisma.teilzahlung.create({ data: { rechnungId: r.id, betrag: 19, zahlungsdatum: new Date("2026-05-02") } });
    const d = await detail(r.id);
    expect(d.restBetrag).toBe(100);
    expect(d.teilzahlungen[0]).toMatchObject({ betrag: 19, zahlungsdatum: new Date("2026-05-02").toISOString() });
    expect(d.erlaubteAktionen).toEqual(["bezahlen", "stornieren", "mahnen"]);
    expect(d.empfaenger?.name).toContain("Zander");
  });

  it("durchläuft alle Mahnstufen und stoppt nach der 3. Mahnung", async () => {
    const r = await rechnung("RE-1", { status: "GESTELLT" });
    const stufen: string[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await aktion(r.id, buildInvoiceActionBody("mahnen"));
      expect(res.status).toBe(200);
      stufen.push((await res.json()).rechnung.mahnStufe);
    }
    expect(stufen).toEqual(["ERINNERUNG", "ERSTE_MAHNUNG", "ZWEITE_MAHNUNG", "DRITTE_MAHNUNG"]);
    expect(await prisma.mahnung.count({ where: { rechnungId: r.id } })).toBe(4);

    const fuenfte = await aktion(r.id, buildInvoiceActionBody("mahnen"));
    expect(fuenfte.status).toBe(400);
    const d = await detail(r.id);
    expect(d.erlaubteAktionen).toEqual(["bezahlen", "stornieren"]);
    expect(d.downloads.xrechnung).toBe(true);
    expect(d.mahnungen.map((m) => m.stufe)).toContain("DRITTE_MAHNUNG");
  });
});

describe("Sammelaktionen", () => {
  it("stellt mehrere Entwürfe und meldet Fehler pro Rechnung", async () => {
    const a = await rechnung("RE-A");
    const b = await rechnung("RE-B");
    const c = await rechnung("RE-C", { status: "BEZAHLT" });
    const { PATCH } = await import("@/app/api/finanzen/rechnungen/[id]/route");
    const fetcher = (url: string, init: RequestInit) =>
      PATCH(req(url, init as any), params({ id: url.split("/").pop()! }));

    const results = await runInvoiceBatchAction([a.id, b.id, c.id], "stellen", fetcher);
    expect(results.map((r) => r.ok)).toEqual([true, true, false]);
    expect(results[2].error).toMatch(/BEZAHLT -> GESTELLT/);
    expect(await prisma.rechnung.count({ where: { status: "GESTELLT" } })).toBe(2);
  });
});

describe("RVG-Rechner → Rechnung", () => {
  const speichern = async (autoUst: boolean) => {
    const { POST } = await import("@/app/api/finanzen/rvg/[akteId]/route");
    const res = await POST(
      req("/x", {
        method: "POST",
        json: buildRvgSaveBody({
          streitwert: 5000,
          positions: [{ vvNr: "3100", options: {} }, { vvNr: "3104", options: { rate: 1.2 } }],
          autoAuslagen: true,
          autoUst,
        }),
      }),
      params({ akteId: akte.id }),
    );
    expect(res.status).toBe(201);
    return (await res.json()) as RvgSaveResponse;
  };

  const rechnungAnlegen = async (saved: RvgSaveResponse) => {
    const { POST } = await import("@/app/api/finanzen/rechnungen/route");
    const res = await POST(req("/x", { method: "POST", json: saved.berechnung.uebernehmenAlsRechnung }));
    expect(res.status).toBe(201);
    const created = (await res.json()) as CreateInvoiceResponse;
    return prisma.rechnung.findUniqueOrThrow({ where: { id: created.rechnung.id } });
  };

  it("Speichern + Übernehmen ergibt eine Rechnung mit genau dem Bruttobetrag der Berechnung", async () => {
    const saved = await speichern(true);
    expect(saved.berechnung.uebernehmenAlsRechnung.positionen.some((p) => p.vvNr === "7008")).toBe(false);
    const r = await rechnungAnlegen(saved);
    expect(r.betragBrutto.toNumber()).toBeCloseTo(saved.ergebnis.bruttoGesamt, 2);
    expect(r.betragNetto.toNumber()).toBeCloseTo(saved.ergebnis.nettoGesamt, 2);
    expect(r.rvgBerechnungId).toBe(saved.berechnung.id);
  });

  it("ohne USt im Rechner entsteht eine Rechnung ohne USt", async () => {
    const saved = await speichern(false);
    expect(saved.ergebnis.items.some((i) => i.vvNr === "7008")).toBe(false);
    const r = await rechnungAnlegen(saved);
    expect(r.betragBrutto.toNumber()).toBeCloseTo(r.betragNetto.toNumber(), 2);
  });
});

describe("Aktenkonto", () => {
  const buchen = async (body: unknown, user = anwalt) => {
    asUser(user);
    const { POST } = await import("@/app/api/finanzen/aktenkonto/[akteId]/route");
    return POST(req("/x", { method: "POST", json: body }), params({ akteId: akte.id }));
  };
  const konto = async () => {
    asUser(anwalt);
    const { GET } = await import("@/app/api/finanzen/aktenkonto/[akteId]/route");
    return (await (await GET(req("/x"), params({ akteId: akte.id }))).json()) as {
      buchungen: AktenkontoBuchungDto[];
      fremdgeldAlerts: { buchungId: string; offenerBetrag: number }[];
    };
  };
  const stornieren = async (buchungId: string) => {
    const { POST } = await import("@/app/api/finanzen/aktenkonto/[akteId]/storno/route");
    return POST(req("/x", { method: "POST", json: buildStornoBody(buchungId, " Fehlbuchung ") }), params({ akteId: akte.id }));
  };

  it("Storno aus der Oberfläche wird angenommen und an der Originalbuchung angezeigt", async () => {
    const res = await buchen(buildBookingBody({ art: "EINNAHME", betrag: 50, verwendungszweck: "Vorschuss" }));
    const { buchung } = await res.json();
    const storno = await stornieren(buchung.id);
    expect(storno.status).toBe(201);
    const { buchungen } = await konto();
    const original = buchungen.find((b) => b.id === buchung.id)!;
    expect(original.storniertDurch).toBe(buchungen.find((b) => b.stornoVon === buchung.id)!.id);
    expect((await stornieren(buchung.id)).status).toBe(400); // kein doppelter Storno
  });

  it("Fremdgeld-Warnung endet mit vollständig gebuchter Weiterleitung (teilweise: Restbetrag)", async () => {
    const eingang = await (await buchen(buildBookingBody({ art: "FREMDGELD_EINGANG", betrag: 1000, verwendungszweck: "Zahlung Gegner" }))).json();
    expect((await konto()).fremdgeldAlerts).toMatchObject([{ buchungId: eingang.buchung.id, offenerBetrag: 1000 }]);

    const teil = await buchen(buildBookingBody({ art: "FREMDGELD_AUSGANG", betrag: 400, verwendungszweck: "Weiterleitung 1" }));
    expect(teil.status).toBe(201);
    expect((await teil.json()).buchung.betrag).toBe(-400);
    expect((await konto()).fremdgeldAlerts).toMatchObject([{ offenerBetrag: 600 }]);

    const rest = await (await buchen(buildBookingBody({ art: "FREMDGELD_AUSGANG", betrag: 600, verwendungszweck: "Weiterleitung 2" }))).json();
    expect((await konto()).fremdgeldAlerts).toEqual([]);

    // Storno der Weiterleitung lässt die Warnung wieder aufleben
    expect((await stornieren(rest.buchung.id)).status).toBe(201);
    expect((await konto()).fremdgeldAlerts).toMatchObject([{ offenerBetrag: 600 }]);
  });

  it("Weiterleitung über den Fremdgeldbestand hinaus wird abgelehnt", async () => {
    await buchen(buildBookingBody({ art: "FREMDGELD_EINGANG", betrag: 100, verwendungszweck: "Eingang" }));
    const res = await buchen(buildBookingBody({ art: "FREMDGELD_AUSGANG", betrag: 100.01, verwendungszweck: "zu viel" }));
    expect(res.status).toBe(400);
  });

  it("Richtung nur bei Fremdgeld; Sekretariat darf keine Weiterleitung buchen", async () => {
    expect((await buchen({ buchungstyp: "EINNAHME", betrag: 1, verwendungszweck: "x", richtung: "AUSGANG" })).status).toBe(400);
    const sek = await createUser("SEKRETARIAT");
    await prisma.akte.update({ where: { id: akte.id }, data: { sachbearbeiterId: sek.id } });
    const res = await buchen(buildBookingBody({ art: "FREMDGELD_AUSGANG", betrag: 1, verwendungszweck: "x" }), sek);
    expect(res.status).toBe(403);
  });
});
