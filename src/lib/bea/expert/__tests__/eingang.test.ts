import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";

vi.mock("@/lib/settings/service", () => ({
  getSetting: vi.fn(async () => "https://api.bea.expert"),
}));

import {
  holePostfaecher,
  holeOrdner,
  holeNachrichtenkoepfe,
  holeNachricht,
  mimeTypAusName,
} from "../eingang";
import { BeaExpertError } from "../transport";
import { aesGcmVerschluesseln } from "../krypto";
import type { BeaSitzung } from "../../provider";

const BETREFF = "Klage Müller ./. Schäfer €";
const CBC = "http://www.w3.org/2001/04/xmlenc#aes256-cbc";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function bodyVon(call: unknown[]): Record<string, string> {
  const init = call[1] as { body: string };
  const j = new URLSearchParams(init.body).get("j")!;
  return JSON.parse(Buffer.from(j, "base64").toString("utf8"));
}

/** AES-GCM in the {value, iv, tag} shape bea.expert uses. */
function gcm(klartext: Buffer | string, key: Buffer) {
  const r = aesGcmVerschluesseln(Buffer.isBuffer(klartext) ? klartext : Buffer.from(klartext, "utf8"), key);
  return { value: r.data, iv: r.iv, tag: r.tag };
}

/** AES-256-CBC with the IV prepended to the ciphertext, Base64. */
function cbc(klartext: Buffer, key: Buffer): string {
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([iv, c.update(klartext), c.final()]).toString("base64");
}

function cocoXml(refs: string[], keys: Buffer[]): string {
  const encData = refs
    .map(
      (r, i) =>
        `<xenc:EncryptedData><xenc:CipherData><xenc:CipherReference URI="cid:${r}"/></xenc:CipherData>` +
        (keys[i] ? `<ds:KeyInfo><ds:MgmtData>${keys[i].toString("base64")}</ds:MgmtData></ds:KeyInfo>` : "") +
        `</xenc:EncryptedData>`,
    )
    .join("");
  const extraKeys = keys
    .slice(refs.length)
    .map((k) => `<ds:KeyInfo><ds:MgmtData>${k.toString("base64")}</ds:MgmtData></ds:KeyInfo>`)
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<xenc:Root xmlns:xenc="http://www.w3.org/2001/04/xmlenc#" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
    encData +
    extraKeys +
    `</xenc:Root>`
  );
}

const OSCI = "http://www.osci.de/2002/04/osci";

/** beaMessage.json object content: OSCI XML with Base64 JSON (bea2email:173-192). */
function beaMessageJsonXml(body: string): string {
  const json = Buffer.from(JSON.stringify({ messageSubject: BETREFF, messageBody: body }), "utf8").toString("base64");
  return `<osci:Content xmlns:osci="${OSCI}"><osci:Base64Content>${json}</osci:Base64Content></osci:Content>`;
}

/** project_coco content with a nachricht.xml Base64Content holding <Freitext> (bea2email:219-239). */
function cocoMitFreitext(freitext: string): string {
  const nachricht = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?><Nachricht><Betreff>x</Betreff><Freitext>${freitext}</Freitext></Nachricht>`,
    "utf8",
  ).toString("base64");
  return (
    `<osci:Root xmlns:osci="${OSCI}"><osci:Content>` +
    `<osci:Base64Content Id="additional_infos">${Buffer.from("user_id=x").toString("base64")}</osci:Base64Content>` +
    `<osci:Base64Content Id="nachricht.xml">${nachricht}</osci:Base64Content>` +
    `</osci:Content></osci:Root>`
  );
}

function encObjekt(name: string, inhalt: Buffer, sessionKey: Buffer, modus: "gcm" | "cbc" = "gcm") {
  const objectKey = crypto.randomBytes(32);
  const encKey = gcm(objectKey, sessionKey);
  if (modus === "cbc") {
    return { enc_name: name, enc_data: cbc(inhalt, objectKey), enc_iv: "", enc_tag: "", encKeyInfo: { encKey } };
  }
  const d = gcm(inhalt, objectKey);
  return { enc_name: name, enc_data: d.value, enc_iv: d.iv, enc_tag: d.tag, encKeyInfo: { encKey } };
}

describe("bea.expert Eingang", () => {
  const fetchMock = vi.fn();
  const sessionKey = crypto.randomBytes(32);
  const s: BeaSitzung = { token: "tok-1", sessionKey, safeId: "DE.BRAK.test.1" };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("BEA_EXPERT_IDENT", "ident-1");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function nachricht(opts: {
    objekte?: unknown[];
    anhaenge?: unknown[];
    metaData?: Record<string, unknown>;
  }) {
    return {
      osciMessageId: "osci-1",
      messageId: "4711",
      metaData: {
        subject: gcm(BETREFF, sessionKey),
        sender: { safeId: "DE.Justiz.1", name: "AG Köln" },
        addressees: [{ safeId: "DE.BRAK.test.1", name: "RA Müller" }],
        referenceNumber: "12/26",
        referenceJustice: "3 C 45/26",
        receptionTime: 1763550000000,
        eebAngefordert: false,
        confidential: false,
        urgent: true,
        ...opts.metaData,
      },
      encryptedObjects: opts.objekte ?? [],
      attachments: opts.anhaenge ?? [],
    };
  }

  // Fixtures below follow the response classes of bea-api-c-sharp (Bex_types.cs)
  it("holePostfaecher mappt GetPostboxesResponse (postboxSafeId, displayName, kein Typ)", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        postboxes: [
          {
            displayName: "RA Müller",
            folder: [{ id: "1", name: "Posteingang", postboxSafeId: "DE.BRAK.test.1", type: "INBOX", parentFolderId: "" }],
            postboxSafeId: "DE.BRAK.test.1",
          },
        ],
        token: "tok-1",
      }),
    );
    const p = await holePostfaecher(s);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/bea_get_postboxes$/);
    expect(bodyVon(fetchMock.mock.calls[0])).toEqual({ token: "tok-1" });
    expect(p).toEqual([{ safeId: "DE.BRAK.test.1", name: "RA Müller", typ: "" }]);
  });

  it("holeOrdner mappt GetFolderStructureResponse (folders, parentFolderId)", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        displayName: "RA Müller",
        folders: [
          { id: "1", name: "Posteingang", postboxSafeId: "DE.BRAK.test.1", type: "INBOX", parentFolderId: "" },
          { id: "2", name: "Mandat Schäfer", postboxSafeId: "DE.BRAK.test.1", type: "USER", parentFolderId: "1" },
        ],
        postboxSafeId: "DE.BRAK.test.1",
        token: "tok-1",
      }),
    );
    const o = await holeOrdner(s, "DE.BRAK.test.1");
    expect(bodyVon(fetchMock.mock.calls[0])).toEqual({ token: "tok-1", postboxSafeId: "DE.BRAK.test.1" });
    expect(o).toEqual([
      { id: "1", name: "Posteingang", typ: "INBOX", parentId: null },
      { id: "2", name: "Mandat Schäfer", typ: "USER", parentId: "1" },
    ]);
  });

  function overviewNachricht(extra: Record<string, unknown>) {
    return {
      addressees: [],
      attachments: "1",
      checkRequired: "false",
      confidential: "false",
      encSubject: gcm(BETREFF, sessionKey),
      folderId: "1",
      messageId: "4711",
      osciSubjectType: "",
      received: "",
      referenceNumber: "",
      referenceNumberJustice: "",
      sender: { safeId: "DE.Justiz.1", surname: "Schäfer", firstname: "Jörg", postalcode: "50667" },
      sent: "",
      symEncAlgorithm: "",
      urgent: "false",
      zugegangen: "1763550000000",
      ...extra,
    };
  }

  it("holeNachrichtenkoepfe mappt GetFolderOverviewResponse (encSubject, sender.surname/firstname, zugegangen)", async () => {
    fetchMock.mockResolvedValueOnce(json({ messages: [overviewNachricht({})] }));
    const k = await holeNachrichtenkoepfe(s, "1");
    expect(bodyVon(fetchMock.mock.calls[0])).toEqual({ token: "tok-1", folderId: "1" });
    expect(k).toEqual([
      {
        messageId: "4711",
        betreff: BETREFF,
        absender: "Schäfer, Jörg",
        empfangenAm: new Date(1763550000000),
        eebAngefordert: false,
      },
    ]);
  });

  it("holeNachrichtenkoepfe: leerer encSubject ergibt '' und received ist Ersatz für zugegangen", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        messages: [
          overviewNachricht({ encSubject: { iv: "", tag: "", value: "" }, zugegangen: "", received: "1763550000000" }),
        ],
      }),
    );
    const [k] = await holeNachrichtenkoepfe(s, "1");
    expect(k.betreff).toBe("");
    expect(k.empfangenAm).toEqual(new Date(1763550000000));
  });

  it("entschlüsselt Betreff 'Klage Müller ./. Schäfer €' aus metaData.subject", async () => {
    const text = "Sehr geehrte Damen und Herren, anbei Müller ß €.";
    fetchMock.mockResolvedValueOnce(
      json(
        nachricht({
          objekte: [encObjekt("beaMessage.json", Buffer.from(beaMessageJsonXml(text), "utf8"), sessionKey, "cbc")],
        }),
      ),
    );
    const n = await holeNachricht(s, "4711");
    expect(bodyVon(fetchMock.mock.calls[0])).toEqual({ token: "tok-1", messageId: "4711" });
    expect(n.betreff).toBe(BETREFF);
    expect(n.text).toBe(text);
    expect(n.messageId).toBe("4711");
    expect(n.osciMessageId).toBe("osci-1");
    expect(n.absender).toEqual({ safeId: "DE.Justiz.1", name: "AG Köln" });
    expect(n.empfaenger).toEqual([{ safeId: "DE.BRAK.test.1", name: "RA Müller" }]);
    expect(n.aktenzeichenAbsender).toBe("12/26");
    expect(n.aktenzeichenJustiz).toBe("3 C 45/26");
    expect(n.empfangenAm).toEqual(new Date(1763550000000));
    expect(n.vertraulich).toBe(false);
    expect(n.dringend).toBe(true);
  });

  it("entschlüsselt einen Anhang über project_coco-Schlüssel (AES-GCM) und liefert Buffer, Name, mimeType application/pdf", async () => {
    const pdf = Buffer.from("%PDF-1.4 Schriftsatz Müller");
    const k1 = crypto.randomBytes(32);
    const d = gcm(pdf, k1);
    fetchMock.mockResolvedValueOnce(
      json(
        nachricht({
          objekte: [encObjekt("project_coco", Buffer.from(cocoXml(["Klage.pdf"], [k1]), "utf8"), sessionKey)],
          anhaenge: [{ reference: "Klage.pdf", data: d.value, iv: d.iv, tag: d.tag, key: "", symEncAlgorithm: "", type: "SCHRIFTSATZ" }],
        }),
      ),
    );
    const n = await holeNachricht(s, "4711");
    expect(n.anhaenge).toHaveLength(1);
    expect(Buffer.isBuffer(n.anhaenge[0].inhalt)).toBe(true);
    expect(n.anhaenge[0].inhalt.equals(pdf)).toBe(true);
    expect(n.anhaenge[0].name).toBe("Klage.pdf");
    expect(n.anhaenge[0].mimeType).toBe("application/pdf");
    expect(n.anhaenge[0].typ).toBe("SCHRIFTSATZ");
  });

  it("entschlüsselt einen Anhang mit symEncAlgorithm aes256-cbc", async () => {
    const xml = Buffer.from("<xjustiz>Schäfer</xjustiz>", "utf8");
    const k1 = crypto.randomBytes(32);
    fetchMock.mockResolvedValueOnce(
      json(
        nachricht({
          objekte: [encObjekt("project_coco", Buffer.from(cocoXml(["xjustiz_nachricht.xml"], [k1]), "utf8"), sessionKey)],
          anhaenge: [{ reference: "xjustiz_nachricht.xml", data: cbc(xml, k1), iv: "", tag: "", key: "", symEncAlgorithm: CBC }],
        }),
      ),
    );
    const n = await holeNachricht(s, "4711");
    expect(n.anhaenge[0].inhalt.toString("utf8")).toBe("<xjustiz>Schäfer</xjustiz>");
    expect(n.anhaenge[0].mimeType).toBe("application/xml");
    expect(n.anhaenge[0].typ).toBeNull();
  });

  it("nutzt den ersten Schlüssel für alle Anhänge, wenn Anzahl CipherReference ≠ Anzahl MgmtData", async () => {
    const k1 = crypto.randomBytes(32);
    const kFalsch = crypto.randomBytes(32);
    const a = gcm(Buffer.from("A"), k1);
    const b = gcm(Buffer.from("B"), k1);
    fetchMock.mockResolvedValueOnce(
      json(
        nachricht({
          // two references, three keys: the counts differ, so k1 must be used for both
          objekte: [
            encObjekt("project_coco", Buffer.from(cocoXml(["a.pdf", "b.pdf"], [k1, kFalsch, kFalsch]), "utf8"), sessionKey),
          ],
          anhaenge: [
            { reference: "a.pdf", data: a.value, iv: a.iv, tag: a.tag, key: "", symEncAlgorithm: "" },
            { reference: "b.pdf", data: b.value, iv: b.iv, tag: b.tag, key: "", symEncAlgorithm: "" },
          ],
        }),
      ),
    );
    const n = await holeNachricht(s, "4711");
    expect(n.anhaenge.map((x) => x.inhalt.toString())).toEqual(["A", "B"]);
  });

  it("Nachrichtentext: beaMessage.json hat Vorrang vor project_coco-Freitext", async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        nachricht({
          objekte: [
            encObjekt("project_coco", Buffer.from(cocoMitFreitext("Freitext Schäfer"), "utf8"), sessionKey),
            encObjekt("beaMessage.json", Buffer.from(beaMessageJsonXml("Body Müller €"), "utf8"), sessionKey),
          ],
        }),
      ),
    );
    expect((await holeNachricht(s, "4711")).text).toBe("Body Müller €");
  });

  it("Nachrichtentext: ohne beaMessage.json aus Freitext von nachricht.xml (auch govello_coco)", async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        nachricht({
          objekte: [encObjekt("govello_coco", Buffer.from(cocoMitFreitext("Freitext Schäfer ß"), "utf8"), sessionKey)],
        }),
      ),
    );
    expect((await holeNachricht(s, "4711")).text).toBe("Freitext Schäfer ß");
  });

  it("leerer metaData.subject ergibt '' statt Fehler", async () => {
    fetchMock.mockResolvedValueOnce(json(nachricht({ metaData: { subject: { iv: "", tag: "", value: "" } } })));
    expect((await holeNachricht(s, "4711")).betreff).toBe("");
  });

  it("Anhang ohne CipherReference nutzt element.key (AES-CBC), exakter Treffer hat Vorrang", async () => {
    const k1 = crypto.randomBytes(32);
    const kEigen = crypto.randomBytes(32);
    const a = gcm(Buffer.from("A"), k1);
    fetchMock.mockResolvedValueOnce(
      json(
        nachricht({
          objekte: [encObjekt("project_coco", Buffer.from(cocoXml(["a.pdf"], [k1]), "utf8"), sessionKey)],
          anhaenge: [
            { reference: "a.pdf", data: a.value, iv: a.iv, tag: a.tag, key: "", symEncAlgorithm: "" },
            {
              reference: "extra.txt",
              data: cbc(Buffer.from("E"), kEigen),
              iv: "",
              tag: "",
              key: kEigen.toString("base64"),
              symEncAlgorithm: CBC,
            },
          ],
        }),
      ),
    );
    const n = await holeNachricht(s, "4711");
    expect(n.anhaenge.map((x) => x.inhalt.toString())).toEqual(["A", "E"]);
  });

  it("bei Anzahl CipherReference ≠ MgmtData nutzt ein nicht gelisteter Anhang element.key", async () => {
    const k1 = crypto.randomBytes(32);
    const kFalsch = crypto.randomBytes(32);
    const kEigen = crypto.randomBytes(32);
    const a = gcm(Buffer.from("A"), k1);
    fetchMock.mockResolvedValueOnce(
      json(
        nachricht({
          objekte: [
            encObjekt("project_coco", Buffer.from(cocoXml(["a.pdf"], [k1, kFalsch]), "utf8"), sessionKey),
          ],
          anhaenge: [
            { reference: "a.pdf", data: a.value, iv: a.iv, tag: a.tag, key: "", symEncAlgorithm: "" },
            {
              reference: "nicht_gelistet.xml",
              data: cbc(Buffer.from("E"), kEigen),
              iv: "",
              tag: "",
              key: kEigen.toString("base64"),
              symEncAlgorithm: CBC,
            },
          ],
        }),
      ),
    );
    const n = await holeNachricht(s, "4711");
    expect(n.anhaenge.map((x) => x.inhalt.toString())).toEqual(["A", "E"]);
  });

  it("nicht lesbares project_coco-XML: BeaExpertError ohne Klartext in Meldung und cause", async () => {
    const geheim = "<<< Mandant Müller geheim";
    fetchMock.mockResolvedValueOnce(
      json(nachricht({ objekte: [encObjekt("project_coco", Buffer.from(geheim, "utf8"), sessionKey)] })),
    );
    const err = (await holeNachricht(s, "4711").catch((e: unknown) => e)) as BeaExpertError;
    expect(err).toBeInstanceOf(BeaExpertError);
    expect(err.funktion).toBe("bea_get_message");
    expect(err.message).not.toContain("geheim");
    expect(err.cause).toBeUndefined();
    expect(JSON.stringify(err.antwort ?? null)).not.toContain("geheim");
  });

  it("nicht lesbares beaMessage.json fällt auf den coco-Freitext zurück", async () => {
    const kaputt = `<osci:Content xmlns:osci="${OSCI}"><osci:Base64Content>${Buffer.from("{kein json geheim").toString("base64")}</osci:Base64Content></osci:Content>`;
    fetchMock.mockResolvedValueOnce(
      json(
        nachricht({
          objekte: [
            encObjekt("beaMessage.json", Buffer.from(kaputt, "utf8"), sessionKey),
            encObjekt("project_coco", Buffer.from(cocoMitFreitext("Freitext"), "utf8"), sessionKey),
          ],
        }),
      ),
    );
    expect((await holeNachricht(s, "4711")).text).toBe("Freitext");
  });

  it("liefert eebAngefordert true aus metaData.eebAngefordert", async () => {
    fetchMock.mockResolvedValueOnce(json(nachricht({ metaData: { eebAngefordert: true } })));
    const n = await holeNachricht(s, "4711");
    expect(n.eebAngefordert).toBe(true);
    expect(n.text).toBeNull();
    expect(n.anhaenge).toEqual([]);
  });

  it("wirft BeaExpertError, wenn ein GCM-Tag nicht passt", async () => {
    const subject = gcm(BETREFF, sessionKey);
    const tag = Buffer.from(subject.tag, "base64");
    tag[0] ^= 0xff;
    fetchMock.mockResolvedValueOnce(json(nachricht({ metaData: { subject: { ...subject, tag: tag.toString("base64") } } })));
    const err = await holeNachricht(s, "4711").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BeaExpertError);
    expect((err as BeaExpertError).funktion).toBe("bea_get_message");
    expect((err as BeaExpertError).message).not.toContain(sessionKey.toString("base64"));
    expect((err as BeaExpertError).message).not.toContain(BETREFF);
  });

  it("mimeTypAusName: pdf, xml, txt, p7s, tif, jpg, png, docx, odt, unbekannt → application/octet-stream", () => {
    expect(mimeTypAusName("a.pdf")).toBe("application/pdf");
    expect(mimeTypAusName("A.PDF")).toBe("application/pdf");
    expect(mimeTypAusName("a.xml")).toBe("application/xml");
    expect(mimeTypAusName("a.txt")).toBe("text/plain");
    expect(mimeTypAusName("a.pdf.p7s")).toBe("application/pkcs7-signature");
    expect(mimeTypAusName("a.tif")).toBe("image/tiff");
    expect(mimeTypAusName("a.jpg")).toBe("image/jpeg");
    expect(mimeTypAusName("a.png")).toBe("image/png");
    expect(mimeTypAusName("a.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(mimeTypAusName("a.odt")).toBe("application/vnd.oasis.opendocument.text");
    expect(mimeTypAusName("a.xyz")).toBe("application/octet-stream");
    expect(mimeTypAusName("ohne_endung")).toBe("application/octet-stream");
  });
});
