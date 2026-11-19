import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createUser, createAkte, createKontakt, asUser, req, params } from "./helpers";

let sekretariat: any, anwalt: any, akte: any;
beforeEach(async () => {
  await resetDb();
  anwalt = await createUser("ANWALT");
  sekretariat = await createUser("SEKRETARIAT");
  akte = await createAkte({ anwaltId: anwalt.id, sachbearbeiterId: sekretariat.id });
});

describe("Löschrecht (canLoeschen)", () => {
  it("das Sekretariat kann keinen Kontakt löschen, die Anwältin schon", async () => {
    const k = await createKontakt();
    const { DELETE } = await import("@/app/api/kontakte/[id]/route");
    asUser(sekretariat);
    expect((await DELETE(req(`/x`, { method: "DELETE" }), params({ id: k.id }))).status).toBe(403);
    expect(await prisma.kontakt.count({ where: { id: k.id } })).toBe(1);
    asUser(anwalt);
    expect((await DELETE(req(`/x`, { method: "DELETE" }), params({ id: k.id }))).status).toBeLessThan(300);
  });

  it("das Sekretariat kann keine Frist seiner Akte löschen (requireDelete wird ausgewertet)", async () => {
    const f = await prisma.kalenderEintrag.create({
      data: { akteId: akte.id, typ: "FRIST", titel: "Frist", datum: new Date(), verantwortlichId: anwalt.id },
    });
    const { DELETE } = await import("@/app/api/kalender/[id]/route");
    asUser(sekretariat);
    expect((await DELETE(req(`/x`, { method: "DELETE" }), params({ id: f.id }))).status).toBe(403);
    expect(await prisma.kalenderEintrag.count({ where: { id: f.id } })).toBe(1);
  });

  it("das Sekretariat kann keine Rechnung löschen", async () => {
    const r = await prisma.rechnung.create({
      data: { akteId: akte.id, rechnungsnummer: "RE-9", betragNetto: 1, betragBrutto: 1.19, positionen: [] } as any,
    });
    const { DELETE } = await import("@/app/api/finanzen/rechnungen/[id]/route");
    asUser(sekretariat);
    expect((await DELETE(req(`/x`, { method: "DELETE" }), params({ id: r.id }))).status).toBe(403);
    expect(await prisma.rechnung.count()).toBe(1);
  });
});

describe("Kanzlei-Einstellungen (canAccessEinstellungen)", () => {
  it("das Sekretariat kann keine Tag-Kategorien anlegen", async () => {
    const { POST } = await import("@/app/api/dokumente/tags/route");
    asUser(sekretariat);
    const r = await POST(req("/api/dokumente/tags", { method: "POST", json: { name: "Neu", farbe: "#000000" } }));
    expect(r.status).toBe(403);
    expect(await prisma.dokumentTagKategorie.count()).toBe(0);
  });
});
