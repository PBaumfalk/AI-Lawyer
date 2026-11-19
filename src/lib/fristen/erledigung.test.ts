import { describe, it, expect } from "vitest";
import {
  buildErledigtRequest,
  erledigungsAnforderungen,
  erledigenOhneRueckfrage,
  istFristUeberfaellig,
  pruefeErledigung,
} from "./erledigung";
import { istFristenrechnerKuerzel } from "./tastenkuerzel";
import { gruppiereTagesuebersicht } from "./tagesuebersicht";
import { fristVorlageAusRechnerErgebnis } from "./als-frist";
import { begruessungsName } from "@/lib/dashboard/begruessung";
import { buildKalenderPayload, createKalenderSchema } from "@/lib/kalender/payload";
import { filterKalenderEintraege, type KalenderListenEintrag } from "@/lib/kalender/eintrag";

// 18.11.2026, 10:00 Berlin (UTC+1)
const NOW = new Date("2026-11-18T09:00:00Z");

describe("Fristablauf (§ 188 Abs. 1 BGB: Ablauf des letzten Tages, Europe/Berlin)", () => {
  it("ganztägige Frist von heute (UTC-Mitternacht gespeichert) ist nicht überfällig", () => {
    expect(istFristUeberfaellig("2026-11-18T00:00:00.000Z", NOW)).toBe(false);
  });
  it("Frist von heute 00:00 Berlin (= 23:00 UTC Vortag) ist nicht überfällig", () => {
    expect(istFristUeberfaellig("2026-11-17T23:00:00.000Z", NOW)).toBe(false);
  });
  it("Frist von gestern ist überfällig", () => {
    expect(istFristUeberfaellig("2026-11-17T00:00:00.000Z", NOW)).toBe(true);
  });
  it("kurz nach Mitternacht Berlin ist die gestrige Frist überfällig, obwohl UTC noch gestern ist", () => {
    const kurzNachMitternacht = new Date("2026-11-18T23:30:00Z"); // 19.11. 00:30 Berlin
    expect(istFristUeberfaellig("2026-11-18T00:00:00.000Z", kurzNachMitternacht)).toBe(true);
  });
  it("Sommerzeit: 23:30 Berlin am Fristtag ist noch fristgerecht", () => {
    const abends = new Date("2026-07-10T21:30:00Z"); // 23:30 MESZ
    expect(istFristUeberfaellig("2026-07-10T00:00:00.000Z", abends)).toBe(false);
  });
});

describe("Erledigungs-Anforderungen", () => {
  it("Frist verlangt Erledigungsgrund, überfällige zusätzlich Überschreitungsgrund", () => {
    expect(erledigungsAnforderungen({ typ: "FRIST", datum: "2026-11-25T00:00:00Z" }, NOW)).toEqual({ erledigungsgrund: true, ueberschreitungsgrund: false });
    expect(erledigungsAnforderungen({ typ: "FRIST", datum: "2026-11-01T00:00:00Z" }, NOW)).toEqual({ erledigungsgrund: true, ueberschreitungsgrund: true });
  });
  it("Wiedervorlage und Termin ohne Rückfrage", () => {
    expect(erledigenOhneRueckfrage({ typ: "WIEDERVORLAGE", datum: "2026-11-01T00:00:00Z" }, NOW)).toBe(true);
    expect(erledigenOhneRueckfrage({ typ: "TERMIN", datum: "2026-11-01T00:00:00Z" }, NOW)).toBe(true);
    expect(erledigenOhneRueckfrage({ typ: "FRIST", datum: "2026-11-25T00:00:00Z" }, NOW)).toBe(false);
  });
  it("Gründe nur aus Leerzeichen gelten als fehlend", () => {
    const ueberfaellig = { typ: "FRIST", datum: "2026-11-01T00:00:00Z" };
    expect(pruefeErledigung(ueberfaellig, { erledigt: true, erledigungsgrund: "  " }, NOW)).toMatch(/Erledigungsgrund/);
    expect(pruefeErledigung(ueberfaellig, { erledigt: true, erledigungsgrund: "ok", ueberschreitungsgrund: "  " }, NOW)).toMatch(/Überschreitungsgrund/);
    expect(pruefeErledigung(ueberfaellig, { erledigt: true, erledigungsgrund: "ok", ueberschreitungsgrund: "Krank" }, NOW)).toBeNull();
    expect(pruefeErledigung(ueberfaellig, { erledigt: false }, NOW)).toBeNull();
  });
  it("buildErledigtRequest trimmt und lässt leere Gründe weg", () => {
    expect(buildErledigtRequest(true, { erledigungsgrund: " eingereicht ", ueberschreitungsgrund: "" })).toEqual({ erledigt: true, erledigungsgrund: "eingereicht" });
    expect(buildErledigtRequest(false, { erledigungsgrund: "x" })).toEqual({ erledigt: false });
  });
});

describe("Tastenkürzel Fristenrechner", () => {
  const ev = (o: Partial<KeyboardEvent>) => ({ key: "", code: "", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...o }) as KeyboardEvent;
  it("Strg+Shift+F liefert key 'F' und wird erkannt", () => {
    expect(istFristenrechnerKuerzel(ev({ ctrlKey: true, shiftKey: true, key: "F", code: "KeyF" }))).toBe(true);
    expect(istFristenrechnerKuerzel(ev({ metaKey: true, shiftKey: true, key: "f", code: "KeyF" }))).toBe(true);
  });
  it("ohne Shift oder ohne Strg/Cmd nicht", () => {
    expect(istFristenrechnerKuerzel(ev({ ctrlKey: true, key: "f", code: "KeyF" }))).toBe(false);
    expect(istFristenrechnerKuerzel(ev({ shiftKey: true, key: "F", code: "KeyF" }))).toBe(false);
    expect(istFristenrechnerKuerzel(ev({ ctrlKey: true, shiftKey: true, key: "G", code: "KeyG" }))).toBe(false);
  });
});

describe("Begrüßung", () => {
  it.each([
    ["Dr. Patrick Baumfalk", "Patrick"],
    ["Prof. Dr. Erika Muster", "Erika"],
    ["RAin Anna Beispiel", "Anna"],
    ["Dr.-Ing. Max Muster", "Max"],
    ["Dr. med. Hans Meier", "Hans"],
    ["Max Mustermann", "Max"],
    ["admin", "admin"],
    ["  ", ""],
    [null, ""],
    ["Dr.", "Dr."],
  ])("%s → %s", (name, erwartet) => {
    expect(begruessungsName(name as any)).toBe(erwartet);
  });
});

const e = (o: Partial<KalenderListenEintrag>): KalenderListenEintrag => ({
  id: Math.random().toString(36), typ: "FRIST", titel: "T", beschreibung: null, datum: "2026-11-18T00:00:00.000Z",
  datumBis: null, ganztaegig: true, erledigt: false, akteId: null, verantwortlichId: "u", akte: null,
  verantwortlich: { name: "Anna" }, ...o,
});

describe("Kalenderliste: Suche mit externen Terminen (verantwortlich null)", () => {
  it("stürzt nicht ab und findet über Titel und Konto", () => {
    const liste = [e({ titel: "Berufung" }), e({ typ: "EXTERN", titel: "Zahnarzt", verantwortlich: null, kontoName: "Google" })];
    expect(filterKalenderEintraege(liste, "zahn").map((x) => x.titel)).toEqual(["Zahnarzt"]);
    expect(filterKalenderEintraege(liste, "google").map((x) => x.titel)).toEqual(["Zahnarzt"]);
    expect(filterKalenderEintraege(liste, "anna").map((x) => x.titel)).toEqual(["Berufung"]);
    expect(filterKalenderEintraege(liste, "")).toHaveLength(2);
  });
});

describe("Tagesübersicht-Gruppierung", () => {
  it("vergangene Termine erscheinen nicht, überfällige Fristen schon", () => {
    const g = gruppiereTagesuebersicht([
      e({ id: "f-alt", typ: "FRIST", datum: "2026-11-10T00:00:00Z" }),
      e({ id: "f-heute", typ: "FRIST", datum: "2026-11-18T00:00:00Z" }),
      e({ id: "f-morgen", typ: "FRIST", datum: "2026-11-19T00:00:00Z" }),
      e({ id: "t-alt", typ: "TERMIN", datum: "2026-11-10T09:00:00Z" }),
      e({ id: "t-heute", typ: "TERMIN", datum: "2026-11-18T13:00:00Z" }),
      e({ id: "x-alt", typ: "EXTERN", datum: "2025-01-01T09:00:00Z", verantwortlich: null }),
      e({ id: "x-heute", typ: "EXTERN", datum: "2026-11-18T15:00:00Z", verantwortlich: null }),
      e({ id: "w-alt", typ: "WIEDERVORLAGE", datum: "2026-11-01T00:00:00Z" }),
      e({ id: "f-erl", typ: "FRIST", datum: "2026-11-10T00:00:00Z", erledigt: true }),
    ], NOW);
    expect(g.fristen.map((x) => x.id)).toEqual(["f-alt", "f-heute"]);
    expect(g.termine.map((x) => x.id)).toEqual(["t-heute"]);
    expect(g.externeTermine.map((x) => x.id)).toEqual(["x-heute"]);
    expect(g.wiedervorlagen.map((x) => x.id)).toEqual(["w-alt"]);
  });
  it("leere Liste", () => {
    expect(gruppiereTagesuebersicht([], NOW)).toEqual({ fristen: [], wiedervorlagen: [], termine: [], externeTermine: [] });
  });
});

describe("Fristenrechner → Kalender-Nutzlast", () => {
  const antwort = {
    richtung: "vorwaerts" as const,
    ergebnis: { startDatum: "2026-11-19T00:00:00.000Z", endDatum: "2026-12-18T00:00:00.000Z", eingabe: { fristArt: "EREIGNISFRIST", bundesland: "NW" } },
    vorfristen: [{ tageVorher: 7, datum: "2026-12-11T00:00:00.000Z" }],
    halbfrist: "2026-12-03T00:00:00.000Z",
    preset: { id: "p", name: "Berufungsfrist" },
    sonderfall: null,
    istNotfrist: true,
    formData: { sonderfall: null },
  };
  it("Rückwärtsberechnung lässt sich nicht als Frist speichern", () => {
    expect(fristVorlageAusRechnerErgebnis({ ...antwort, richtung: "rueckwaerts" })).toBeNull();
  });
  it("Vorlage ergibt eine gültige POST-Nutzlast mit Notfrist, Vorfristen, Halbfrist", () => {
    const v = fristVorlageAusRechnerErgebnis(antwort)!;
    expect(v.titel).toBe("Berufungsfrist");
    const payload = buildKalenderPayload(
      { typ: v.typ, titel: v.titel, beschreibung: v.beschreibung, datum: v.datum, datumBis: "", ganztaegig: true, akteId: "", verantwortlichId: "u1", fristablauf: v.fristablauf, vorfrist: "" },
      v.zusatz,
    );
    const parsed = createKalenderSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    expect(payload).toMatchObject({ typ: "FRIST", istNotfrist: true, fristArt: "EREIGNISFRIST", bundesland: "NW" });
    expect(payload.vorfristen).toHaveLength(1);
    expect(payload.halbfrist).toBeTruthy();
  });
  it("Zusatzfelder entfallen, wenn der Typ im Dialog auf Termin geändert wird", () => {
    const v = fristVorlageAusRechnerErgebnis(antwort)!;
    const payload = buildKalenderPayload(
      { typ: "TERMIN", titel: "x", beschreibung: "", datum: v.datum, datumBis: "", ganztaegig: true, akteId: "", verantwortlichId: "u1", fristablauf: "", vorfrist: "" },
      v.zusatz,
    );
    expect(payload.vorfristen).toBeUndefined();
    expect(payload.istNotfrist).toBeUndefined();
  });
});
