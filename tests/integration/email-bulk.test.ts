import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createUser, asUser, req } from "./helpers";
import type { EmailBulkRequest } from "@/lib/email/bulk-contract";

let user: any, fremd: any, k1: any, k2: any, archiv1: any, archiv2: any, ordnerK2: any;

const mail = (kontoId: string) =>
  prisma.emailNachricht.create({
    data: { emailKontoId: kontoId, betreff: "x", absender: "a@b.de", empfaenger: [], cc: [], bcc: [], references: [] },
  });
const konto = (name: string) =>
  prisma.emailKonto.create({ data: { name, emailAdresse: `${name}@k.test`, benutzername: name, imapHost: "h", smtpHost: "h" } });

beforeEach(async () => {
  await resetDb();
  user = await createUser("SACHBEARBEITER");
  fremd = await createUser("SACHBEARBEITER");
  k1 = await konto("eins");
  k2 = await konto("zwei");
  await prisma.emailKontoZuweisung.createMany({ data: [{ kontoId: k1.id, userId: user.id }, { kontoId: k2.id, userId: user.id }] });
  archiv1 = await prisma.emailOrdner.create({ data: { kontoId: k1.id, name: "Archiv", pfad: "Archive", spezialTyp: "ARCHIVE" } });
  archiv2 = await prisma.emailOrdner.create({ data: { kontoId: k2.id, name: "Archiv", pfad: "Archive", spezialTyp: "ARCHIVE" } });
  ordnerK2 = await prisma.emailOrdner.create({ data: { kontoId: k2.id, name: "Akten", pfad: "Akten" } });
});

const bulk = async (body: EmailBulkRequest) =>
  (await import("@/app/api/emails/bulk/route")).POST(req("/api/emails/bulk", { method: "POST", json: body }));

describe("POST /api/emails/bulk", () => {
  it("archiviert E-Mails mehrerer Postfächer jeweils in den eigenen Archiv-Ordner", async () => {
    const [m1, m2] = [await mail(k1.id), await mail(k2.id)];
    asUser(user);
    const res = await bulk({ action: "archive", emailIds: [m1.id, m2.id] });
    expect(res.status).toBe(200);
    expect((await res.json()).updated).toBe(2);
    expect((await prisma.emailNachricht.findUniqueOrThrow({ where: { id: m1.id } })).emailOrdnerId).toBe(archiv1.id);
    expect((await prisma.emailNachricht.findUniqueOrThrow({ where: { id: m2.id } })).emailOrdnerId).toBe(archiv2.id);
  });

  it("meldet fehlenden Spam-Ordner statt still nichts zu tun", async () => {
    const m1 = await mail(k1.id);
    asUser(user);
    const res = await bulk({ action: "spam", emailIds: [m1.id] });
    expect(res.status).toBe(409);
  });

  it("verschiebt nicht in Ordner eines anderen Postfachs", async () => {
    const m1 = await mail(k1.id);
    asUser(user);
    expect((await bulk({ action: "move", emailIds: [m1.id], targetFolderId: ordnerK2.id })).status).toBe(400);
  });

  it("Löschen ist per restore rückgängig zu machen (Undo im Detail)", async () => {
    const m1 = await mail(k1.id);
    asUser(user);
    expect((await bulk({ action: "delete", emailIds: [m1.id] })).status).toBe(200);
    expect((await prisma.emailNachricht.findUniqueOrThrow({ where: { id: m1.id } })).geloescht).toBe(true);
    expect((await bulk({ action: "restore", emailIds: [m1.id] })).status).toBe(200);
    const m = await prisma.emailNachricht.findUniqueOrThrow({ where: { id: m1.id } });
    expect(m.geloescht).toBe(false);
    expect(m.geloeschtAm).toBeNull();
  });

  it("verweigert fremde und unbekannte E-Mails", async () => {
    const m1 = await mail(k1.id);
    asUser(fremd);
    expect((await bulk({ action: "markRead", emailIds: [m1.id] })).status).toBe(403);
    asUser(user);
    expect((await bulk({ action: "markRead", emailIds: [m1.id, "gibt-es-nicht"] })).status).toBe(403);
    expect((await prisma.emailNachricht.findUniqueOrThrow({ where: { id: m1.id } })).gelesen).toBe(false);
  });

  it("ungültiges JSON → 400 statt 500", async () => {
    asUser(user);
    const { NextRequest } = require("next/server");
    const res = await (await import("@/app/api/emails/bulk/route")).POST(
      new NextRequest("http://localhost/api/emails/bulk", { method: "POST", body: "{kaputt" })
    );
    expect(res.status).toBe(400);
  });
});
