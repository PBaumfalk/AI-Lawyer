import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { canAccessAkte } from "@/lib/rbac";
import { listAktenForUser, listAktenOptionsForUser } from "@/lib/akten/list";
import { resetDb, createUser, createAkte, createKontakt } from "./helpers";

let admin: any, anwalt: any, fremd: any, dezernatsMitglied: any, mandant: any;
let eigeneAkte: any, dezernatsAkte: any, fremdeAkte: any;

beforeEach(async () => {
  await resetDb();
  admin = await createUser("ADMIN");
  anwalt = await createUser("ANWALT");
  fremd = await createUser("SACHBEARBEITER");
  dezernatsMitglied = await createUser("SEKRETARIAT");
  const kontakt = await createKontakt({ nachname: "Fischer" });
  mandant = await createUser("MANDANT", { kontaktId: kontakt.id });

  eigeneAkte = await createAkte({ anwaltId: anwalt.id, kurzrubrum: "Fischer ./. Logistik" });
  dezernatsAkte = await createAkte({ kurzrubrum: "Dezernatsakte" });
  fremdeAkte = await createAkte({ kurzrubrum: "Geheim ./. Niemand" });
  await prisma.beteiligter.create({ data: { akteId: eigeneAkte.id, kontaktId: kontakt.id, rolle: "MANDANT" } });
  await prisma.dezernat.create({
    data: {
      name: "Arbeitsrecht",
      mitglieder: { connect: [{ id: dezernatsMitglied.id }] },
      akten: { connect: [{ id: dezernatsAkte.id }] },
    } as any,
  });
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

describe("Aktenliste der Kanzleioberfläche", () => {
  it("zeigt Sachbearbeitern ohne Zuweisung keine fremden Akten", async () => {
    expect(await listAktenForUser(fremd, {})).toEqual([]);
  });

  it("zeigt zugewiesene und Dezernats-Akten, aber nicht mehr", async () => {
    expect(ids(await listAktenForUser(anwalt, {}))).toEqual([eigeneAkte.id]);
    expect(ids(await listAktenForUser(dezernatsMitglied, {}))).toEqual([dezernatsAkte.id]);
  });

  it("zeigt Admins alle Akten", async () => {
    expect(ids(await listAktenForUser(admin, {}))).toEqual(ids([eigeneAkte, dezernatsAkte, fremdeAkte]));
  });

  it("zeigt Mandantenkonten nie Akten über die Kanzleiabfrage", async () => {
    expect(await listAktenForUser(mandant, {})).toEqual([]);
  });

  it("findet Akten über den Namen eines Beteiligten", async () => {
    expect(ids(await listAktenForUser(admin, { q: "fischer" }))).toEqual([eigeneAkte.id]);
  });

  it("ignoriert unbekannte Statuswerte statt abzustürzen", async () => {
    await expect(listAktenForUser(admin, { status: "QUATSCH" })).resolves.toHaveLength(3);
  });

  it("Auswahllisten enthalten nur zugängliche Akten", async () => {
    expect(ids(await listAktenOptionsForUser(fremd))).toEqual([]);
    expect(ids(await listAktenOptionsForUser(anwalt))).toEqual([eigeneAkte.id]);
  });
});

describe("canAccessAkte", () => {
  it("entspricht den Regeln von requireAkteAccess", async () => {
    expect(await canAccessAkte(admin, fremdeAkte.id)).toBe(true);
    expect(await canAccessAkte(anwalt, eigeneAkte.id)).toBe(true);
    expect(await canAccessAkte(anwalt, fremdeAkte.id)).toBe(false);
    expect(await canAccessAkte(dezernatsMitglied, dezernatsAkte.id)).toBe(true);
    expect(await canAccessAkte(fremd, eigeneAkte.id)).toBe(false);
    expect(await canAccessAkte(mandant, eigeneAkte.id)).toBe(false);
    expect(await canAccessAkte(admin, "gibt-es-nicht")).toBe(false);
  });
});
