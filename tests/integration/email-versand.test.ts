import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createUser, createAkte, asUser, req, params } from "./helpers";
import type { EmailSendRequest, EmailSendResponse } from "@/lib/email/send-contract";
import { emailUploadPrefix } from "@/lib/email/send-contract";
import { parseAktenDokumente, parseAktenSuche } from "@/lib/email/dokument-auswahl";

const queued = vi.hoisted(() => ({ jobs: [] as any[] }));
vi.mock("@/lib/queue/queues", () => ({
  emailSendQueue: {
    add: vi.fn(async (_n: string, data: any, opts: any) => {
      queued.jobs.push({ data, opts });
      return { id: opts.jobId };
    }),
    getJob: vi.fn(async () => ({ getState: async () => "delayed", remove: async () => {} })),
  },
}));

const smtp = vi.hoisted(() => ({ sent: [] as any[] }));
vi.mock("@/lib/email/smtp/transport-factory", () => ({
  createSmtpTransport: () => ({
    sendMail: async (opts: any) => {
      smtp.sent.push(opts);
      return { messageId: "<sent-1@test>" };
    },
  }),
}));

const storage = vi.hoisted(() => ({ objects: new Map<string, Buffer>() }));
vi.mock("@/lib/storage", () => ({
  getFileStream: vi.fn(async (key: string) => {
    const b = storage.objects.get(key);
    if (!b) throw new Error("NoSuchKey");
    return { transformToByteArray: async () => new Uint8Array(b) };
  }),
  uploadFile: vi.fn(async (key: string, body: Buffer) => {
    storage.objects.set(key, Buffer.from(body));
    return key;
  }),
  getDownloadUrl: vi.fn(async () => "http://x"),
}));

vi.mock("@/lib/notifications/service", () => ({ createNotification: vi.fn() }));

let anwalt: any, fremd: any, akte: any, fremdeAkte: any, konto: any, fremdesKonto: any;
let entwurf: any, freigegeben: any, fremdesDok: any;

beforeEach(async () => {
  await resetDb();
  queued.jobs = [];
  smtp.sent = [];
  storage.objects.clear();
  anwalt = await createUser("ANWALT");
  fremd = await createUser("ANWALT");
  akte = await createAkte({ anwaltId: anwalt.id, aktenzeichen: "00001/26", kurzrubrum: "Muster ./. Gegner" });
  fremdeAkte = await createAkte({ anwaltId: fremd.id });
  konto = await prisma.emailKonto.create({
    data: { name: "Kanzlei", emailAdresse: "info@kanzlei.test", benutzername: "u", passwortEnc: "x", imapHost: "h", smtpHost: "h" },
  });
  fremdesKonto = await prisma.emailKonto.create({
    data: { name: "Privat", emailAdresse: "fremd@kanzlei.test", benutzername: "f", passwortEnc: "x", imapHost: "h", smtpHost: "h" },
  });
  await prisma.emailKontoZuweisung.create({ data: { kontoId: konto.id, userId: anwalt.id } });
  await prisma.emailKontoZuweisung.create({ data: { kontoId: fremdesKonto.id, userId: fremd.id } });
  entwurf = await prisma.dokument.create({
    data: { akteId: akte.id, name: "Entwurf.pdf", dateipfad: "akten/x/entwurf.pdf", mimeType: "application/pdf", groesse: 10, createdById: anwalt.id, status: "ENTWURF" },
  });
  freigegeben = await prisma.dokument.create({
    data: { akteId: akte.id, name: "Klage.pdf", dateipfad: "akten/x/klage.pdf", mimeType: "application/pdf", groesse: 20, createdById: anwalt.id, status: "FREIGEGEBEN", freigegebenDurchId: anwalt.id },
  });
  fremdesDok = await prisma.dokument.create({
    data: { akteId: fremdeAkte.id, name: "Geheim.pdf", dateipfad: "akten/y/geheim.pdf", mimeType: "application/pdf", groesse: 5, createdById: fremd.id, status: "FREIGEGEBEN", freigegebenDurchId: fremd.id },
  });
  storage.objects.set(freigegeben.dateipfad, Buffer.from("%PDF-klage"));
});

const send = async (body: EmailSendRequest) =>
  (await import("@/app/api/email-send/route")).POST(req("/api/email-send", { method: "POST", json: body }));

const base = (): EmailSendRequest => ({
  kontoId: konto.id,
  empfaenger: ["gegner@example.com"],
  betreff: "Klage",
  inhalt: "<p>anbei</p>",
  akteId: akte.id,
});

describe("POST /api/email-send – Anhänge", () => {
  it("blockiert nicht freigegebene Dokumente (Versand-Gate) und legt nichts an", async () => {
    asUser(anwalt);
    const res = await send({ ...base(), anhaenge: [{ quelle: "dms", dokumentId: entwurf.id }] });
    expect(res.status).toBe(400);
    expect(await prisma.emailNachricht.count()).toBe(0);
    expect(queued.jobs).toHaveLength(0);
  });

  it("legt EmailAnhang an und übergibt die Dokument-ID für VERSENDET an den Job", async () => {
    asUser(anwalt);
    const res = await send({ ...base(), anhaenge: [{ quelle: "dms", dokumentId: freigegeben.id }] });
    expect(res.status).toBe(201);
    const body: EmailSendResponse = await res.json();
    const anhaenge = await prisma.emailAnhang.findMany({ where: { emailNachrichtId: body.emailId } });
    expect(anhaenge).toHaveLength(1);
    expect(anhaenge[0]).toMatchObject({ dateiname: "Klage.pdf", speicherPfad: freigegeben.dateipfad, groesse: 20 });
    expect(queued.jobs[0].data.dmsDocumentIds).toEqual([freigegeben.id]);
    const v = await prisma.emailVeraktung.findMany({ where: { emailNachrichtId: body.emailId } });
    expect(v.map((x) => x.akteId)).toEqual([akte.id]);
  });

  it("verweigert Dokumente fremder Akten", async () => {
    asUser(anwalt);
    const res = await send({ ...base(), anhaenge: [{ quelle: "dms", dokumentId: fremdesDok.id }] });
    expect(res.status).toBe(404);
    expect(await prisma.emailNachricht.count()).toBe(0);
  });

  it("akzeptiert Uploads nur unter dem eigenen Upload-Präfix", async () => {
    asUser(anwalt);
    const fremderPfad = { quelle: "upload" as const, speicherPfad: freigegeben.dateipfad, dateiname: "x.pdf", mimeType: "application/pdf", groesse: 1 };
    expect((await send({ ...base(), anhaenge: [fremderPfad] })).status).toBe(403);
    const traversal = { ...fremderPfad, speicherPfad: `${emailUploadPrefix(anwalt.id)}../../akten/x/klage.pdf` };
    expect((await send({ ...base(), anhaenge: [traversal] })).status).toBe(403);

    const upload = await (await import("@/app/api/email-send/anhang/route")).POST(
      (() => {
        const fd = new FormData();
        fd.append("file", new File([Buffer.from("hallo")], "notiz.txt", { type: "text/plain" }));
        const { NextRequest } = require("next/server");
        return new NextRequest("http://localhost/api/email-send/anhang", { method: "POST", body: fd });
      })()
    );
    expect(upload.status).toBe(201);
    const ref = await upload.json();
    expect(ref.speicherPfad.startsWith(emailUploadPrefix(anwalt.id))).toBe(true);
    const res = await send({ ...base(), anhaenge: [{ quelle: "upload", ...ref }] });
    expect(res.status).toBe(201);
  });

  it("Weiterleitung: Anhänge nur aus zugewiesenen Postfächern", async () => {
    const fremdeMail = await prisma.emailNachricht.create({
      data: { emailKontoId: fremdesKonto.id, betreff: "privat", absender: "x@y.de", empfaenger: [], cc: [], bcc: [], references: [],
        anhaenge: { create: { dateiname: "privat.pdf", mimeType: "application/pdf", groesse: 1, speicherPfad: "email/privat.pdf" } } },
      include: { anhaenge: true },
    });
    asUser(anwalt);
    const res = await send({ ...base(), anhaenge: [{ quelle: "email", anhangId: fremdeMail.anhaenge[0].id }] });
    expect(res.status).toBe(404);
  });

  it("Antwort aus der Inline-Antwort (kontoId + antwortAufId) setzt Threading", async () => {
    const original = await prisma.emailNachricht.create({
      data: { emailKontoId: konto.id, betreff: "Frage", absender: "m@x.de", empfaenger: [], cc: [], bcc: [], references: ["<a@x>"], messageId: "<b@x>", threadId: "t1" },
    });
    asUser(anwalt);
    const res = await send({ kontoId: konto.id, empfaenger: ["m@x.de"], betreff: "Re: Frage", inhalt: "<p>ok</p>", antwortAufId: original.id });
    expect(res.status).toBe(201);
    const { emailId } = await res.json();
    const mail = await prisma.emailNachricht.findUniqueOrThrow({ where: { id: emailId } });
    expect(mail).toMatchObject({ inReplyTo: "<b@x>", references: ["<a@x>", "<b@x>"], threadId: "t1" });

    asUser(fremd);
    const fremdeAntwort = await send({ kontoId: fremdesKonto.id, empfaenger: ["m@x.de"], betreff: "x", inhalt: "<p>x</p>", antwortAufId: original.id });
    expect(fremdeAntwort.status).toBe(404);
  });
});

describe("Versand-Job: Anhang wird mitgeschickt und Dokument auf VERSENDET gesetzt", () => {
  it("sendet den Dateiinhalt aus dem Speicher und markiert VERSENDET", async () => {
    asUser(anwalt);
    const res = await send({ ...base(), anhaenge: [{ quelle: "dms", dokumentId: freigegeben.id }] });
    expect(res.status).toBe(201);
    const { emailSendProcessor } = await import("@/lib/email/smtp/send-processor");
    await emailSendProcessor({ id: "j1", data: queued.jobs[0].data } as any);

    expect(smtp.sent).toHaveLength(1);
    expect(smtp.sent[0].attachments).toHaveLength(1);
    expect(smtp.sent[0].attachments[0].filename).toBe("Klage.pdf");
    expect(smtp.sent[0].attachments[0].content.toString()).toBe("%PDF-klage");
    expect((await prisma.dokument.findUniqueOrThrow({ where: { id: freigegeben.id } })).status).toBe("VERSENDET");
  });

  it("schlägt fehl (statt ohne Anhang zu senden), wenn die Datei im Speicher fehlt", async () => {
    storage.objects.clear();
    asUser(anwalt);
    await send({ ...base(), anhaenge: [{ quelle: "dms", dokumentId: freigegeben.id }] });
    const { emailSendProcessor } = await import("@/lib/email/smtp/send-processor");
    await expect(emailSendProcessor({ id: "j2", data: queued.jobs[0].data } as any)).rejects.toThrow(/Klage\.pdf/);
    expect(smtp.sent).toHaveLength(0);
    expect((await prisma.dokument.findUniqueOrThrow({ where: { id: freigegeben.id } })).status).toBe("FREIGEGEBEN");
  });
});

describe("Rückgängig (POST /api/email-send/cancel)", () => {
  it("nur für Nutzer mit Zugriff auf das Postfach", async () => {
    asUser(anwalt);
    const { emailId } = await (await send(base())).json();
    const cancel = (await import("@/app/api/email-send/cancel/route")).POST;
    asUser(fremd);
    expect((await cancel(req("/x", { method: "POST", json: { emailId } }))).status).toBe(404);
    asUser(anwalt);
    expect((await cancel(req("/x", { method: "POST", json: { emailId } }))).status).toBe(200);
  });
});

describe("Dokumentauswahl (Vertrag Compose ↔ /api/akten…)", () => {
  it("liest die Dokumentliste der Akte in dem Format, das die Route liefert", async () => {
    asUser(anwalt);
    const res = await (await import("@/app/api/akten/[id]/dokumente/route")).GET(
      req(`/api/akten/${akte.id}/dokumente`),
      params({ id: akte.id })
    );
    const docs = parseAktenDokumente(await res.json());
    expect(docs.map((d) => d.name).sort()).toEqual(["Entwurf.pdf", "Klage.pdf"]);
    expect(docs.find((d) => d.name === "Klage.pdf")?.status).toBe("FREIGEGEBEN");
  });

  it("liest die Aktensuche in dem Format, das /api/akten liefert", async () => {
    asUser(anwalt);
    const res = await (await import("@/app/api/akten/route")).GET(req(`/api/akten?q=00001&take=5`));
    const akten = parseAktenSuche(await res.json());
    expect(akten.map((a) => a.id)).toEqual([akte.id]);
  });
});
