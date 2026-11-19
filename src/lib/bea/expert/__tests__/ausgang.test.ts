import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";

vi.mock("@/lib/settings/service", () => ({
  getSetting: vi.fn(async () => "https://api.bea.expert"),
}));

const { logWarn } = vi.hoisted(() => ({ logWarn: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ warn: logWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import {
  baueMsgInfos,
  sendeNachricht,
  speichereEntwurf,
  sendeEebAntwort,
  formatEebDatum,
} from "../ausgang";
import { BeaExpertError } from "../transport";
import { aesGcmVerschluesseln, aesGcmEntschluesseln } from "../krypto";
import type { BeaSitzung, BeaVersandAuftrag, BeaEebAuftrag } from "../../provider";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function bodyVon(call: unknown[]): Record<string, any> {
  const init = call[1] as { body: string };
  const j = new URLSearchParams(init.body).get("j")!;
  return JSON.parse(Buffer.from(j, "base64").toString("utf8"));
}

function gcm(klartext: Buffer | string, key: Buffer) {
  const r = aesGcmVerschluesseln(Buffer.isBuffer(klartext) ? klartext : Buffer.from(klartext, "utf8"), key);
  return { value: r.data, iv: r.iv, tag: r.tag };
}

const PDF = Buffer.from("%PDF-1.7 Schriftsatz Müller ß €\n\x00\x01\x02", "binary");

function auftrag(extra: Partial<BeaVersandAuftrag> = {}): BeaVersandAuftrag {
  return {
    postfachSafeId: "DE.BRAK.test.1",
    empfaengerSafeIds: ["DE.BRAK.test.1"],
    betreff: "Testnachricht",
    text: "Hallo",
    aktenzeichenAbsender: "12/26",
    aktenzeichenEmpfaenger: "3 C 45/26",
    nachrichtenTyp: "TESTNACHRICHT",
    eebAnfordern: true,
    dringend: false,
    anhaenge: [{ name: "Schriftsatz.pdf", inhalt: PDF, art: "SCHRIFTSATZ" }],
    ...extra,
  };
}

const EEB: BeaEebAuftrag = {
  postfachSafeId: "DE.BRAK.test.1",
  empfaengerSafeId: "DE.Justiz.1",
  betreff: "eEB zu 3 C 45/26",
  aktenzeichenAbsender: "12/26",
  aktenzeichenEmpfaenger: "3 C 45/26",
  fremdId: "xjustiz-msg-1",
  abgabeDatum: "2026-11-17",
};

describe("bea.expert Ausgang", () => {
  const fetchMock = vi.fn();
  const sessionKey = crypto.randomBytes(32);
  const nachrichtenKey = crypto.randomBytes(32);
  const s: BeaSitzung = { token: "tok-1", sessionKey, safeId: "DE.BRAK.test.1" };

  const initAntwort = () => json({ key: gcm(nachrichtenKey, sessionKey), messageToken: "mt-1" });
  const sendAntwort = () =>
    json({
      validationTokenMSG: "vt-1",
      validations: [{ id: "v1", ...(({ value, iv, tag }) => ({ data: value, iv, tag }))(gcm("prüf-1", sessionKey)) }],
    });

  beforeEach(() => {
    fetchMock.mockReset();
    logWarn.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("BEA_EXPERT_IDENT", "ident-1");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("baueMsgInfos setzt für Testnachricht nachrichten_typ TESTNACHRICHT, receivers, attachments-Namen, eeb_erforderlich", () => {
    const m = baueMsgInfos(auftrag());
    expect(m).toEqual({
      betreff: "Testnachricht",
      aktz_sender: "12/26",
      aktz_rcv: "3 C 45/26",
      msg_text: "Hallo",
      is_eeb: false,
      dringend: false,
      pruefen: false,
      receivers: ["DE.BRAK.test.1"],
      attachments: ["Schriftsatz.pdf"],
      is_eeb_response: false,
      eeb_fremdid: "",
      eeb_date: "",
      verfahrensgegenstand: "",
      eeb_erforderlich: true,
      eeb_accept: false,
      xj: true,
      nachrichten_typ: "TESTNACHRICHT",
    });
  });

  it("baueMsgInfos für Entwurf: receivers leer", () => {
    const m = baueMsgInfos(auftrag(), { entwurf: true });
    expect(m.receivers).toEqual([]);
    expect(m.attachments).toEqual(["Schriftsatz.pdf"]);
  });

  it("baueMsgInfos für eEB-Abgabe: is_eeb, is_eeb_response, eeb_accept true, eeb_fremdid gesetzt, keine attachments", () => {
    const m = baueMsgInfos(EEB);
    expect(m).toMatchObject({
      is_eeb: true,
      is_eeb_response: true,
      eeb_accept: true,
      eeb_fremdid: "xjustiz-msg-1",
      eeb_date: "2026-11-17",
      eeb_erforderlich: false,
      receivers: ["DE.Justiz.1"],
      attachments: [],
      nachrichten_typ: "ALLGEMEINE_NACHRICHT",
      verfahrensgegenstand: "",
      xj: true,
    });
  });

  it("formatEebDatum liefert '' für heute (Europe/Berlin), sonst YYYY-MM-DD", () => {
    expect(formatEebDatum("2026-11-19", "2026-11-19")).toBe("");
    expect(formatEebDatum("2026-11-17", "2026-11-19")).toBe("2026-11-17");
    // 2026-11-19 23:30 UTC is already 2026-11-20 in Berlin
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T23:30:00Z"));
    try {
      expect(formatEebDatum("2026-11-20")).toBe("");
      expect(formatEebDatum("2026-11-19")).toBe("2026-11-19");
    } finally {
      vi.useRealTimers();
    }
  });

  it("sendeNachricht ruft init → send → validation auf; Anhang lässt sich mit dem Nachrichtenschlüssel wieder entschlüsseln; hash = sha256", async () => {
    fetchMock
      .mockResolvedValueOnce(initAntwort())
      .mockResolvedValueOnce(sendAntwort())
      .mockResolvedValueOnce(json({ token: "tok-1", info: "", messageId: "9001" }));

    await sendeNachricht(s, auftrag());

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual([
      "https://api.bea.expert/bea_init_message",
      "https://api.bea.expert/bea_send_message",
      "https://api.bea.expert/bea_send_message_validation",
    ]);

    const init = bodyVon(fetchMock.mock.calls[0]);
    expect(init.token).toBe("tok-1");
    expect(init.postboxSafeId).toBe("DE.BRAK.test.1");
    expect(init.msg_infos.nachrichten_typ).toBe("TESTNACHRICHT");

    const send = bodyVon(fetchMock.mock.calls[1]);
    expect(send.messageToken).toBe("mt-1");
    expect(send.token).toBeUndefined();
    const [att] = send.encrypted_data.attachments;
    expect(att.name).toBe("Schriftsatz.pdf");
    expect(att.att_type).toBe("SCHRIFTSATZ");
    expect(att.key).toBe(nachrichtenKey.toString("base64"));
    expect(Buffer.from(att.iv, "base64")).toHaveLength(16);
    const klar = aesGcmEntschluesseln({ value: att.data, iv: att.iv, tag: att.tag }, nachrichtenKey);
    expect(klar.equals(PDF)).toBe(true);
    expect(att.hash).toBe(crypto.createHash("sha256").update(PDF).digest("base64"));
    expect(att.sizeKB).toBe(Math.floor(PDF.toString("base64").length / 1024));

    const val = bodyVon(fetchMock.mock.calls[2]);
    expect(val).toEqual({
      validationTokenMSG: "vt-1",
      validations: [{ id: "v1", data: Buffer.from("prüf-1", "utf8").toString("base64") }],
    });
  });

  it("sendeNachricht liefert messageId aus der Validierungsantwort", async () => {
    fetchMock
      .mockResolvedValueOnce(initAntwort())
      .mockResolvedValueOnce(sendAntwort())
      .mockResolvedValueOnce(json({ token: "tok-1", info: "", messageId: 9001 }));
    expect(await sendeNachricht(s, auftrag())).toEqual({ messageId: "9001" });

    fetchMock
      .mockResolvedValueOnce(initAntwort())
      .mockResolvedValueOnce(sendAntwort())
      .mockResolvedValueOnce(json({ token: "tok-1", info: "" }));
    expect(await sendeNachricht(s, auftrag())).toEqual({ messageId: null });
  });

  it("sendeNachricht ruft bea_cleanup_message, wenn bea_send_message fehlschlägt, und wirft BeaExpertError", async () => {
    fetchMock
      .mockResolvedValueOnce(initAntwort())
      .mockResolvedValueOnce(json({ error: "Empfänger unbekannt" }))
      .mockResolvedValueOnce(json({ error: "cleanup kaputt" }));

    const err = await sendeNachricht(s, auftrag()).catch((e) => e);
    expect(err).toBeInstanceOf(BeaExpertError);
    expect((err as BeaExpertError).funktion).toBe("bea_send_message");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2][0])).toMatch(/\/bea_cleanup_message$/);
    expect(bodyVon(fetchMock.mock.calls[2])).toEqual({ messageToken: "mt-1" });
    // cleanup failure is logged, never secrets
    expect(logWarn).toHaveBeenCalledTimes(1);
    const geloggt = JSON.stringify(logWarn.mock.calls);
    expect(geloggt).not.toContain("tok-1");
    expect(geloggt).not.toContain("mt-1");
    expect(geloggt).not.toContain(sessionKey.toString("base64"));
  });

  it("sendeNachricht wiederholt bea_send_message nach Zeitüberschreitung nicht", async () => {
    const timeout = Object.assign(new Error("timeout"), { name: "TimeoutError" });
    fetchMock
      .mockResolvedValueOnce(initAntwort())
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(json({}));
    await expect(sendeNachricht(s, auftrag())).rejects.toBeInstanceOf(BeaExpertError);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.endsWith("/bea_send_message"))).toHaveLength(1);
    expect(urls[2]).toMatch(/\/bea_cleanup_message$/);
  });

  it("Betreff 'Schriftsatz Müller ß €' lässt sich aus encSubject per UTF-8 zurückgewinnen", async () => {
    fetchMock
      .mockResolvedValueOnce(initAntwort())
      .mockResolvedValueOnce(sendAntwort())
      .mockResolvedValueOnce(json({ messageId: "1" }));
    await sendeNachricht(s, auftrag({ betreff: "Schriftsatz Müller ß €" }));
    const { encSubject } = bodyVon(fetchMock.mock.calls[1]).encrypted_data;
    expect(encSubject.key).toBe(nachrichtenKey.toString("base64"));
    const klar = aesGcmEntschluesseln({ value: encSubject.data, iv: encSubject.iv, tag: encSubject.tag }, nachrichtenKey);
    expect(klar.toString("utf8")).toBe("Schriftsatz Müller ß €");
    expect(bodyVon(fetchMock.mock.calls[0]).msg_infos.betreff).toBe("Schriftsatz Müller ß €");
  });

  it("speichereEntwurf ruft init (receivers leer) → save auf und liefert messageId", async () => {
    fetchMock.mockResolvedValueOnce(initAntwort()).mockResolvedValueOnce(json({ token: "tok-1", messageId: "77" }));
    expect(await speichereEntwurf(s, auftrag())).toEqual({ messageId: "77" });
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/bea_save_message$/);
    expect(bodyVon(fetchMock.mock.calls[0]).msg_infos.receivers).toEqual([]);
    expect(bodyVon(fetchMock.mock.calls[1]).messageToken).toBe("mt-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sendeEebAntwort sendet ohne Anhänge und mit eEB-Feldern", async () => {
    fetchMock
      .mockResolvedValueOnce(initAntwort())
      .mockResolvedValueOnce(json({ validationTokenMSG: "vt-2", validations: [] }))
      .mockResolvedValueOnce(json({ messageId: "555" }));
    expect(await sendeEebAntwort(s, EEB)).toEqual({ messageId: "555" });
    const init = bodyVon(fetchMock.mock.calls[0]);
    expect(init.msg_infos).toMatchObject({ is_eeb: true, eeb_accept: true, eeb_fremdid: "xjustiz-msg-1" });
    expect(bodyVon(fetchMock.mock.calls[1]).encrypted_data.attachments).toEqual([]);
    expect(bodyVon(fetchMock.mock.calls[2])).toEqual({ validationTokenMSG: "vt-2", validations: [] });
  });
});
