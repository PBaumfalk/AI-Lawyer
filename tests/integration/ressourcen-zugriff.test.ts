import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createUser, createAkte, asUser, req, params } from "./helpers";

// Storage and OCR are external services; none of these routes may reach them
// for a foreign Akte, so the mocks only have to exist.
vi.mock("@/lib/storage", () => ({
  getFileStream: vi.fn(), getFileBuffer: vi.fn(), uploadFile: vi.fn(), getDownloadUrl: vi.fn(),
  deleteFile: vi.fn(), generateStorageKey: vi.fn(() => "k"), getPresignedUrl: vi.fn(),
}));

let fremd: any, anwalt: any;
let akte: any, dok: any, frist: any, rechnung: any, buchung: any, konv: any;

beforeEach(async () => {
  await resetDb();
  anwalt = await createUser("ANWALT");
  fremd = await createUser("ANWALT");
  akte = await createAkte({ anwaltId: anwalt.id, kurzrubrum: "Vertraulich ./. Gegner" });
  dok = await prisma.dokument.create({
    data: { akteId: akte.id, name: "Klage.pdf", dateipfad: "a/b.pdf", mimeType: "application/pdf", groesse: 1, createdById: anwalt.id, status: "ENTWURF", tags: ["alt"] } as any,
  });
  frist = await prisma.kalenderEintrag.create({
    data: { akteId: akte.id, typ: "FRIST", titel: "Notfrist", datum: new Date(Date.now() + 86400000), verantwortlichId: anwalt.id },
  });
  rechnung = await prisma.rechnung.create({
    data: { akteId: akte.id, rechnungsnummer: "RE-1", betragNetto: 100, betragBrutto: 119, positionen: [] } as any,
  });
  buchung = await prisma.aktenKontoBuchung.create({
    data: { akteId: akte.id, buchungstyp: "EINNAHME", betrag: 50, verwendungszweck: "x", gebuchtVon: anwalt.id } as any,
  }).catch(() => null);
  await prisma.chatNachricht.create({ data: { akteId: akte.id, userId: null, nachricht: "KI-Entwurf zur vertraulichen Akte" } });
  konv = await prisma.aiConversation.create({ data: { userId: anwalt.id, akteId: akte.id, messages: [], model: "m" } });
});

type Fall = { name: string; call: () => Promise<Response>; unverändert?: () => Promise<void> };

const faelle = (): Fall[] => [
  { name: "Dokument: OCR anstoßen", call: async () => (await import("@/app/api/dokumente/[id]/ocr/route")).POST(req(`/x`, { method: "POST" }), params({ id: dok.id })) },
  { name: "Dokument: Text manuell setzen", call: async () => (await import("@/app/api/dokumente/[id]/manual-text/route")).POST(req(`/x`, { method: "POST", json: { text: "überschrieben" } }), params({ id: dok.id })) },
  { name: "Dokument: Vision-OCR", call: async () => (await import("@/app/api/dokumente/[id]/vision/route")).POST(req(`/x`, { method: "POST" }), params({ id: dok.id })) },
  {
    name: "Dokument: Status freigeben",
    call: async () => (await import("@/app/api/dokumente/[id]/status/route")).PATCH(req(`/x`, { method: "PATCH", json: { status: "FREIGEGEBEN" } }), params({ id: dok.id })),
    unverändert: async () => expect((await prisma.dokument.findUniqueOrThrow({ where: { id: dok.id } })).status).toBe("ENTWURF"),
  },
  {
    name: "Dokument: Tags ändern",
    call: async () => (await import("@/app/api/dokumente/[id]/tags/route")).PUT(req(`/x`, { method: "PUT", json: { tags: ["neu"] } }), params({ id: dok.id })),
    unverändert: async () => expect((await prisma.dokument.findUniqueOrThrow({ where: { id: dok.id } })).tags).toEqual(["alt"]),
  },
  { name: "Dokument: Vorschau laden", call: async () => (await import("@/app/api/dokumente/[id]/preview/route")).GET(req(`/x`), params({ id: dok.id })) },
  { name: "Dokument: Vorschau erzeugen", call: async () => (await import("@/app/api/dokumente/[id]/preview/route")).POST(req(`/x`, { method: "POST" }), params({ id: dok.id })) },
  { name: "Dokument: Version wiederherstellen", call: async () => (await import("@/app/api/dokumente/[id]/versionen/[versionId]/restore/route")).POST(req(`/x`, { method: "POST" }), params({ id: dok.id, versionId: "v" })) },
  {
    name: "Frist: erledigen",
    call: async () => (await import("@/app/api/kalender/[id]/erledigt/route")).PATCH(req(`/x`, { method: "PATCH", json: { erledigt: true, erledigungsgrund: "x" } }), params({ id: frist.id })),
    unverändert: async () => expect((await prisma.kalenderEintrag.findUniqueOrThrow({ where: { id: frist.id } })).erledigt).toBe(false),
  },
  { name: "Frist: verlängern", call: async () => (await import("@/app/api/kalender/[id]/verlaengerung/route")).POST(req(`/x`, { method: "POST", json: { neueDauer: { tage: 7 }, grund: "x" } }), params({ id: frist.id })) },
  { name: "Rechnung: PDF", call: async () => (await import("@/app/api/finanzen/rechnungen/[id]/pdf/route")).GET(req(`/x`), params({ id: rechnung.id })) },
  { name: "Aktenkonto: stornieren", call: async () => (await import("@/app/api/finanzen/aktenkonto/[akteId]/storno/route")).POST(req(`/x`, { method: "POST", json: { buchungId: buchung?.id ?? "x", grund: "x" } }), params({ akteId: akte.id })) },
  { name: "Fristenzettel einer Akte", call: async () => (await import("@/app/api/fristen/fristenzettel/route")).GET(req(`/api/fristen/fristenzettel?format=akte&akteId=${akte.id}`)) },
  { name: "Timer auf fremder Akte starten", call: async () => (await import("@/app/api/finanzen/zeiterfassung/timer/route")).POST(req(`/x`, { method: "POST", json: { akteId: akte.id } })) },
  { name: "Unterhaltung zu fremder Akte anlegen", call: async () => (await import("@/app/api/ki-chat/conversations/route")).POST(req(`/x`, { method: "POST", json: { akteId: akte.id } })) },
  { name: "Unterhaltung einer fremden Akte lesen", call: async () => (await import("@/app/api/ki-chat/conversations/[id]/route")).GET(req(`/x`), params({ id: konv.id })) },
  {
    name: "RVG-Berechnung zu fremder Akte speichern",
    unverändert: async () => expect(await prisma.rvgBerechnung.count()).toBe(0),
    call: async () => (await import("@/app/api/finanzen/rvg/route")).POST(req(`/x`, { method: "POST", json: { streitwert: 1000, positionen: [{ vvNr: "3100" }], speichern: true, akteId: akte.id } })) },
];

describe("Ressourcen fremder Akten", () => {
  for (const f of faelle()) {
    it(`${f.name}: 404 ohne Zugriff`, async () => {
      asUser(fremd);
      const fall = faelle().find((x) => x.name === f.name)!;
      const r = await fall.call();
      // 404 (not 400): the request is valid, only access is missing.
      expect(r.status).toBe(404);
      await fall.unverändert?.();
    });
  }

  it("KI-Entwürfe fremder Akten erscheinen nicht in der Liste", async () => {
    const { GET } = await import("@/app/api/ki-entwuerfe/route");
    asUser(fremd);
    const data = await (await GET(req("/api/ki-entwuerfe"))).json();
    expect(JSON.stringify(data)).not.toContain("vertraulichen Akte");
    asUser(anwalt);
    const own = await (await GET(req("/api/ki-entwuerfe"))).json();
    expect(JSON.stringify(own)).toContain("vertraulichen Akte");
  });

  it("der Tages-Fristenzettel enthält keine Fristen fremder Akten", async () => {
    const { GET } = await import("@/app/api/fristen/fristenzettel/route");
    asUser(fremd);
    const r = await GET(req("/api/fristen/fristenzettel?format=daily"));
    expect(r.status).toBe(200);
    const pdf = Buffer.from(await r.arrayBuffer()).toString("latin1");
    expect(pdf).not.toContain("Notfrist");
  });

  it("weist ein ungültiges Datum mit 400 ab statt 500", async () => {
    const { GET } = await import("@/app/api/fristen/fristenzettel/route");
    asUser(anwalt);
    expect((await GET(req("/api/fristen/fristenzettel?format=daily&datum=quatsch"))).status).toBe(400);
  });

  it("die Inhaberin der Akte erreicht dieselben Ressourcen weiterhin", async () => {
    asUser(anwalt);
    const { GET } = await import("@/app/api/ki-chat/conversations/[id]/route");
    expect((await GET(req(`/x`), params({ id: konv.id }))).status).toBe(200);
    const { PUT } = await import("@/app/api/dokumente/[id]/tags/route");
    expect((await PUT(req(`/x`, { method: "PUT", json: { tags: ["neu"] } }), params({ id: dok.id }))).status).toBe(200);
  });
});
