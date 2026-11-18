import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createUser, createAkte, asUser, req, params } from "./helpers";

// Meilisearch is an external service; capture what the route asks it for.
const searchSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/meilisearch", async (orig) => ({
  ...(await orig<typeof import("@/lib/meilisearch")>()),
  searchDokumente: searchSpy,
}));

let anwalt: any, fremd: any, sekretariat: any, admin: any, mandant: any;
let eigene: any, fremde: any;

beforeEach(async () => {
  await resetDb();
  searchSpy.mockReset();
  searchSpy.mockResolvedValue({ hits: [], estimatedTotalHits: 0, processingTimeMs: 1, query: "" });
  admin = await createUser("ADMIN");
  anwalt = await createUser("ANWALT");
  fremd = await createUser("SACHBEARBEITER");
  sekretariat = await createUser("SEKRETARIAT");
  mandant = await createUser("MANDANT");
  eigene = await createAkte({ anwaltId: anwalt.id });
  fremde = await createAkte({ anwaltId: admin.id });
});

const body = async (r: Response) => r.json().catch(() => null);

describe("RVG-Rechner je Akte", () => {
  it("liefert fremde Akten nicht aus (GET) und speichert nicht für sie (POST)", async () => {
    const { GET, POST } = await import("@/app/api/finanzen/rvg/[akteId]/route");
    asUser(fremd);
    const g = await GET(req(`/api/finanzen/rvg/${fremde.id}`), params({ akteId: fremde.id }));
    expect(g.status).toBe(404);
    const p = await POST(req(`/api/finanzen/rvg/${fremde.id}`, { method: "POST", json: {} }), params({ akteId: fremde.id }));
    expect(p.status).toBe(404);
    expect(await prisma.rvgBerechnung.count()).toBe(0);
  });

  it("liefert eigene Akten aus", async () => {
    const { GET } = await import("@/app/api/finanzen/rvg/[akteId]/route");
    asUser(anwalt);
    const g = await GET(req(`/api/finanzen/rvg/${eigene.id}`), params({ akteId: eigene.id }));
    expect(g.status).toBe(200);
  });
});

describe("Dokument aus Vorlage", () => {
  it("füllt keine Vorlage mit Daten einer fremden Akte", async () => {
    const { POST } = await import("@/app/api/vorlagen/[id]/generieren/route");
    asUser(fremd);
    const r = await POST(
      req(`/api/vorlagen/x/generieren`, { method: "POST", json: { akteId: fremde.id } }),
      params({ id: "x" }),
    );
    expect(r.status).toBe(404);
    expect((await body(r))?.error).toBe("Akte nicht gefunden");
  });
});

describe("E-Mail verakten", () => {
  it("legt keine E-Mail in eine fremde Akte", async () => {
    const { POST } = await import("@/app/api/emails/[id]/veraktung/route");
    asUser(fremd);
    const r = await POST(
      req(`/api/emails/x/veraktung`, { method: "POST", json: { akteId: fremde.id } }),
      params({ id: "x" }),
    );
    expect(r.status).toBe(404);
    expect((await body(r))?.error).toBe("Akte nicht gefunden");
  });
});

describe("Helena-Chat", () => {
  const chat = (akteId: string | null) =>
    req("/api/ki-chat", { method: "POST", json: { messages: [{ role: "user", content: "Zusammenfassung" }], akteId } });

  it("verweigert Rollen ohne KI-Recht", async () => {
    const { POST } = await import("@/app/api/ki-chat/route");
    asUser(mandant);
    expect((await POST(chat(null))).status).toBe(403);
  });

  it("lädt keine fremde Akte in den Kontext", async () => {
    const { POST } = await import("@/app/api/ki-chat/route");
    asUser(fremd);
    expect((await POST(chat(fremde.id))).status).toBe(404);
  });
});

describe("Tickets", () => {
  beforeEach(async () => {
    await prisma.ticket.createMany({
      data: [
        { titel: "Teamaufgabe" },
        { titel: "Eigene Akte", akteId: eigene.id },
        { titel: "Fremde Akte", akteId: fremde.id },
      ],
    });
  });

  it("listet Teamaufgaben und Tickets zugänglicher Akten, nicht mehr", async () => {
    const { GET } = await import("@/app/api/tickets/route");
    asUser(anwalt);
    const titel = (await body(await GET(req("/api/tickets")))).map((t: any) => t.titel).sort();
    expect(titel).toEqual(["Eigene Akte", "Teamaufgabe"]);
  });

  it("öffnet, ändert und löscht keine Tickets fremder Akten", async () => {
    const { GET, PATCH } = await import("@/app/api/tickets/[id]/route");
    const t = await prisma.ticket.findFirstOrThrow({ where: { akteId: fremde.id } });
    asUser(anwalt);
    expect((await GET(req(`/api/tickets/${t.id}`), params({ id: t.id }))).status).toBe(404);
    expect((await PATCH(req(`/api/tickets/${t.id}`, { method: "PATCH", json: { titel: "x" } }), params({ id: t.id }))).status).toBe(404);
  });

  it("hängt kein Ticket an eine fremde Akte", async () => {
    const { POST } = await import("@/app/api/tickets/route");
    const { PATCH } = await import("@/app/api/tickets/[id]/route");
    asUser(anwalt);
    expect((await POST(req("/api/tickets", { method: "POST", json: { titel: "x", akteId: fremde.id } }))).status).toBe(404);
    const team = await prisma.ticket.findFirstOrThrow({ where: { akteId: null } });
    expect((await PATCH(req(`/api/tickets/${team.id}`, { method: "PATCH", json: { akteId: fremde.id } }), params({ id: team.id }))).status).toBe(404);
  });

  it("verlangt einen Titel statt mit 500 abzustürzen", async () => {
    const { POST } = await import("@/app/api/tickets/route");
    asUser(anwalt);
    expect((await POST(req("/api/tickets", { method: "POST", json: {} }))).status).toBe(400);
    expect((await POST(req("/api/tickets", { method: "POST", body: "kein json" }))).status).toBe(400);
  });

  it("lässt nur Rollen mit Löschrecht löschen", async () => {
    const { DELETE } = await import("@/app/api/tickets/[id]/route");
    const team = await prisma.ticket.findFirstOrThrow({ where: { akteId: null } });
    asUser(sekretariat);
    expect((await DELETE(req(`/api/tickets/${team.id}`, { method: "DELETE" }), params({ id: team.id }))).status).toBe(403);
    asUser(anwalt);
    expect((await DELETE(req(`/api/tickets/${team.id}`, { method: "DELETE" }), params({ id: team.id }))).status).toBe(200);
  });
});

describe("Dokumentensuche", () => {
  it("beschränkt Nicht-Admins auf zugängliche Akten", async () => {
    const { GET } = await import("@/app/api/search/route");
    asUser(anwalt);
    await GET(req("/api/search?q=vertrag"));
    expect(searchSpy).toHaveBeenCalledWith("vertrag", expect.objectContaining({ akteIds: [eigene.id] }));
  });

  it("fragt für Benutzer ohne Akten gar nicht erst und für fremde akteId leer zurück", async () => {
    const { GET } = await import("@/app/api/search/route");
    asUser(fremd);
    const r = await body(await GET(req("/api/search?q=x")));
    expect(r.hits).toEqual([]);
    asUser(anwalt);
    const r2 = await body(await GET(req(`/api/search?q=x&akteId=${fremde.id}`)));
    expect(r2.hits).toEqual([]);
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("schränkt Admins nicht ein und übersteht kaputte Zahlen und Daten", async () => {
    const { GET } = await import("@/app/api/search/route");
    asUser(admin);
    await GET(req("/api/search?q=x&limit=abc&offset=-5&dateFrom=kein-datum&dateTo=2026-03-01"));
    const opts = searchSpy.mock.calls[0][1];
    expect(opts.akteIds).toBeUndefined();
    expect(opts.limit).toBe(20);
    expect(opts.offset).toBe(0);
    expect(opts.dateFrom).toBeUndefined();
    // "Bis 01.03." schließt den ganzen Tag ein
    expect(opts.dateTo).toBe(Math.floor(new Date("2026-03-01T23:59:59.999").getTime() / 1000));
  });
});
