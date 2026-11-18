import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createUser, asUser, req, params } from "./helpers";
import { emailTicketsWhere, ticketEmailsInclude } from "@/lib/tickets/emails";

let user: any, fremd: any, konto: any, mail: any;

beforeEach(async () => {
  await resetDb();
  user = await createUser("SACHBEARBEITER");
  fremd = await createUser("SACHBEARBEITER");
  konto = await prisma.emailKonto.create({ data: { name: "k", emailAdresse: "k@k.test", benutzername: "k", imapHost: "h", smtpHost: "h" } });
  await prisma.emailKontoZuweisung.create({ data: { kontoId: konto.id, userId: user.id } });
  mail = await prisma.emailNachricht.create({
    data: { emailKontoId: konto.id, betreff: "Bitte Rückruf", absender: "mandant@x.de", empfaenger: [], cc: [], bcc: [], references: [], inhaltText: "vertraulich" },
  });
});

describe("Ticket aus E-Mail ↔ Ticket-Ansichten", () => {
  it("aus E-Mail erstelltes Ticket zeigt die verknüpfte E-Mail (API und /email/tickets)", async () => {
    asUser(user);
    const res = await (await import("@/app/api/emails/[id]/ticket/route")).POST(
      req(`/api/emails/${mail.id}/ticket`, { method: "POST", json: {} }),
      params({ id: mail.id })
    );
    expect(res.status).toBe(201);
    const ticket = await res.json();

    const detail = await (await import("@/app/api/tickets/[id]/route")).GET(req(`/x`), params({ id: ticket.id }));
    const body = await detail.json();
    expect(body.emailNachrichten).toEqual([{ id: mail.id, betreff: "Bitte Rückruf", absender: "mandant@x.de" }]);

    const liste = await prisma.ticket.findMany({ where: emailTicketsWhere(user, {}), include: ticketEmailsInclude });
    expect(liste.map((t) => t.id)).toEqual([ticket.id]);
    expect(liste[0].emailNachrichten[0].id).toBe(mail.id);
  });

  it("POST /api/tickets mit emailId verknüpft die E-Mail (neues Modell)", async () => {
    asUser(user);
    const res = await (await import("@/app/api/tickets/route")).POST(
      req("/api/tickets", { method: "POST", json: { titel: "Rückruf", emailId: mail.id } })
    );
    expect(res.status).toBe(201);
    const t = await res.json();
    expect((await prisma.emailNachricht.findUniqueOrThrow({ where: { id: mail.id } })).ticketId).toBe(t.id);
  });

  it("kein Ticket aus E-Mails fremder Postfächer", async () => {
    asUser(fremd);
    const res = await (await import("@/app/api/emails/[id]/ticket/route")).POST(
      req(`/x`, { method: "POST", json: {} }),
      params({ id: mail.id })
    );
    expect(res.status).toBe(404);
    const res2 = await (await import("@/app/api/tickets/route")).POST(
      req("/api/tickets", { method: "POST", json: { titel: "x", emailId: mail.id } })
    );
    expect(res2.status).toBe(404);
    expect(await prisma.ticket.count()).toBe(0);
  });

  it("Löschen des Tickets löst die Verknüpfung der E-Mail", async () => {
    const admin = await createUser("ADMIN");
    const t = await prisma.ticket.create({ data: { titel: "t", emailNachrichten: { connect: { id: mail.id } } } });
    asUser(admin);
    const res = await (await import("@/app/api/tickets/[id]/route")).DELETE(req("/x", { method: "DELETE" }), params({ id: t.id }));
    expect(res.status).toBe(200);
    expect((await prisma.emailNachricht.findUniqueOrThrow({ where: { id: mail.id } })).ticketId).toBeNull();
  });
});
