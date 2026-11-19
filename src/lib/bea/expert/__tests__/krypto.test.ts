import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";
import forge from "node-forge";

import {
  leseP12,
  signiereChallenge,
  rsaOaepEntschluesseln,
  aesGcmEntschluesseln,
  aesGcmVerschluesseln,
  aesCbcEntschluesseln,
} from "../krypto";
import { erzeugeTestP12 } from "./fixtures";

const PIN = "123456";
let fixture: ReturnType<typeof erzeugeTestP12>;

beforeAll(() => {
  fixture = erzeugeTestP12(PIN);
});

// Collects all OIDs of an ASN.1 tree in document order
function sammleOids(node: forge.asn1.Asn1): string[] {
  if (node.type === forge.asn1.Type.OID && typeof node.value === "string") {
    return [forge.asn1.derToOid(node.value)];
  }
  if (Array.isArray(node.value)) return node.value.flatMap(sammleOids);
  return [];
}

function kinder(node: forge.asn1.Asn1): forge.asn1.Asn1[] {
  return node.value as forge.asn1.Asn1[];
}

// Splits a CMS SignedData (Base64) into the parts needed for verification
function zerlegeCms(b64: string) {
  const root = forge.asn1.fromDer(Buffer.from(b64, "base64").toString("binary"));
  const signedData = kinder(kinder(kinder(root)[1])[0]);
  const eContent = Buffer.from(kinder(kinder(signedData[2])[1])[0].value as string, "binary");
  const si = kinder(kinder(signedData[signedData.length - 1])[0]);
  const sattrs = si[3];
  const sattrsDer = Buffer.from(forge.asn1.toDer(sattrs).getBytes(), "binary");
  sattrsDer[0] = 0x31; // [0] IMPLICIT -> SET for signature input
  const md = kinder(sattrs).find(
    (a) => forge.asn1.derToOid(kinder(a)[0].value as string) === "1.2.840.113549.1.9.4",
  )!;
  return {
    eContent,
    sattrsDer,
    signatur: Buffer.from(si[5].value as string, "binary"),
    messageDigestHex: Buffer.from(kinder(kinder(md)[1])[0].value as string, "binary").toString("hex"),
  };
}

function pssGueltig(daten: Buffer, signatur: Buffer, zertifikatPem: string): boolean {
  return crypto.verify(
    "sha512",
    daten,
    { key: zertifikatPem, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 },
    signatur,
  );
}

describe("leseP12", () => {
  it("leseP12 liefert Schlüssel, Zertifikat und SHA-1-Thumbprint über das DER-Zertifikat (40 Hex-Zeichen)", () => {
    const ergebnis = leseP12(fixture.p12, PIN);

    expect(ergebnis.privateKeyPem).toContain("PRIVATE KEY");
    // same key: public part matches the certificate
    const pub = crypto.createPublicKey(ergebnis.zertifikatPem).export({ format: "der", type: "spki" });
    const pubAusKey = crypto.createPublicKey(ergebnis.privateKeyPem).export({ format: "der", type: "spki" });
    expect(Buffer.compare(pub, pubAusKey)).toBe(0);

    const der = new crypto.X509Certificate(fixture.zertifikatPem).raw;
    const erwartet = crypto.createHash("sha1").update(der).digest("hex");
    expect(ergebnis.thumbprintSha1Hex).toMatch(/^[0-9a-f]{40}$/);
    expect(ergebnis.thumbprintSha1Hex).toBe(erwartet);

    expect(ergebnis.seriennummer).toBe("0a1b2c3d");
    expect(ergebnis.inhaber).toBe("Max Müller");
    expect(ergebnis.gueltigBis.toISOString()).toBe("2028-12-31T23:59:59.000Z");
  });

  it("leseP12 wirft bei falscher PIN die deutsche Fehlermeldung", () => {
    expect(() => leseP12(fixture.p12, "falsch")).toThrow(
      "PIN falsch oder Datei ist kein beA-Softwarezertifikat",
    );
    expect(() => leseP12(Buffer.from("kein p12"), PIN)).toThrow(
      "PIN falsch oder Datei ist kein beA-Softwarezertifikat",
    );
  });
});

describe("leseP12 Zuordnung", () => {
  it("leseP12 wirft, wenn kein Zertifikat zum Schlüssel passt", () => {
    const fremd = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
    const cert = forge.pki.createCertificate();
    cert.publicKey = fremd.publicKey;
    cert.serialNumber = "01";
    cert.setSubject([{ name: "commonName", value: "Fremd" }]);
    cert.setIssuer([{ name: "commonName", value: "Fremd" }]);
    cert.sign(fremd.privateKey, forge.md.sha256.create());
    const key = forge.pki.privateKeyFromPem(fixture.privateKeyPem);
    const asn1 = forge.pkcs12.toPkcs12Asn1(key, [cert], PIN, { algorithm: "3des" });
    const p12 = Buffer.from(forge.asn1.toDer(asn1).getBytes(), "binary");
    expect(() => leseP12(p12, PIN)).toThrow("PIN falsch oder Datei ist kein beA-Softwarezertifikat");
  });
});

describe("signiereChallenge", () => {
  it("signiereChallenge erzeugt CMS SignedData mit RSASSA-PSS, SHA-512 und signingCertificateV2", () => {
    const challenge = "Challenge-äöü-12345";
    const b64 = signiereChallenge(challenge, fixture.zertifikatPem, fixture.privateKeyPem);

    expect(b64).not.toContain("-----BEGIN");
    expect(b64).toMatch(/^[A-Za-z0-9+/]+=*$/);

    const der = Buffer.from(b64, "base64");
    const root = forge.asn1.fromDer(der.toString("binary"));
    const oids = sammleOids(root);

    expect(oids).toContain("1.2.840.113549.1.7.2"); // signedData
    expect(oids).toContain("1.2.840.113549.1.1.10"); // RSASSA-PSS
    expect(oids).toContain("2.16.840.1.101.3.4.2.3"); // SHA-512
    expect(oids).toContain("2.16.840.1.101.3.4.2.1"); // SHA-256 (digestAlgorithms)
    expect(oids).toContain("1.2.840.113549.1.9.16.2.47"); // signingCertificateV2
    expect(oids).toContain("1.2.840.113549.1.9.5"); // signingTime
    expect(oids).toContain("1.2.840.113549.1.9.3"); // contentType
    expect(oids).toContain("1.2.840.113549.1.9.4"); // messageDigest

    // ContentInfo -> [0] -> SignedData
    const signedData = kinder(kinder(kinder(root)[1])[0]);
    const encap = kinder(signedData[2]);
    const eContent = kinder(encap[1])[0];
    expect(Buffer.from(eContent.value as string, "binary").toString("utf8")).toBe(challenge);

    // Signature over the DER-encoded signed attributes (tag [0] replaced by SET)
    const signerInfos = kinder(signedData[signedData.length - 1]);
    const si = kinder(signerInfos[0]);
    const sattrs = si[3];
    const sattrsDer = Buffer.from(forge.asn1.toDer(sattrs).getBytes(), "binary");
    sattrsDer[0] = 0x31;
    const signatur = Buffer.from(si[5].value as string, "binary");
    const gueltig = crypto.verify(
      "sha512",
      sattrsDer,
      {
        key: fixture.zertifikatPem,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 64,
      },
      signatur,
    );
    expect(gueltig).toBe(true);

    // messageDigest attribute is SHA-512 over the UTF-8 challenge
    const md = kinder(sattrs).find(
      (a) => forge.asn1.derToOid(kinder(a)[0].value as string) === "1.2.840.113549.1.9.4",
    )!;
    const mdWert = Buffer.from(kinder(kinder(md)[1])[0].value as string, "binary").toString("hex");
    expect(mdWert).toBe(crypto.createHash("sha512").update(challenge, "utf8").digest("hex"));
  });
});

describe("signiereChallenge mit Rohbytes", () => {
  it("signiert einen Buffer (kein gültiges UTF-8) unverändert als eContent", () => {
    const roh = Buffer.from([0xff, 0x00, 0x80, 0xc3, 0x28]);
    const teile = zerlegeCms(signiereChallenge(roh, fixture.zertifikatPem, fixture.privateKeyPem));
    expect(teile.eContent.equals(roh)).toBe(true);
    expect(teile.messageDigestHex).toBe(crypto.createHash("sha512").update(roh).digest("hex"));
    expect(pssGueltig(teile.sattrsDer, teile.signatur, fixture.zertifikatPem)).toBe(true);
  });

  it("signiert einen String als UTF-8-Bytes", () => {
    const teile = zerlegeCms(signiereChallenge("Müller ß €", fixture.zertifikatPem, fixture.privateKeyPem));
    expect(teile.eContent.equals(Buffer.from("Müller ß €", "utf8"))).toBe(true);
    expect(pssGueltig(teile.sattrsDer, teile.signatur, fixture.zertifikatPem)).toBe(true);
  });
});

describe("RSA-OAEP und AES", () => {
  it("rsaOaepEntschluesseln entschlüsselt, was node:crypto publicEncrypt mit OAEP/SHA-256 verschlüsselt hat", () => {
    const klartext = Buffer.from("Sitzungsschlüssel Müller ß €", "utf8");
    const chiffrat = crypto.publicEncrypt(
      {
        key: fixture.zertifikatPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      klartext,
    );
    const ergebnis = rsaOaepEntschluesseln(chiffrat.toString("base64"), fixture.privateKeyPem);
    expect(ergebnis.equals(klartext)).toBe(true);
  });

  it("aesGcm: verschlüsseln → entschlüsseln ergibt den Klartext, IV ist 16 Byte", () => {
    const schluessel = crypto.randomBytes(32);
    const klartext = Buffer.from("Betreff: Müller ß €", "utf8");
    const teil = aesGcmVerschluesseln(klartext, schluessel);

    expect(Buffer.from(teil.iv, "base64")).toHaveLength(16);
    expect(Buffer.from(teil.tag, "base64")).toHaveLength(16);

    const zurueck = aesGcmEntschluesseln({ value: teil.data, iv: teil.iv, tag: teil.tag }, schluessel);
    expect(zurueck.equals(klartext)).toBe(true);
  });

  it("aesGcmEntschluesseln wirft bei manipuliertem Tag", () => {
    const schluessel = crypto.randomBytes(32);
    const teil = aesGcmVerschluesseln(Buffer.from("geheim"), schluessel);
    const tag = Buffer.from(teil.tag, "base64");
    tag[0] ^= 0xff;
    expect(() =>
      aesGcmEntschluesseln({ value: teil.data, iv: teil.iv, tag: tag.toString("base64") }, schluessel),
    ).toThrow();
  });

  it("aesCbcEntschluesseln mit vorangestelltem IV und mit separatem IV", () => {
    const schluessel = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const klartext = Buffer.from("Anhang Müller ß €", "utf8");
    const cipher = crypto.createCipheriv("aes-256-cbc", schluessel, iv);
    const chiffrat = Buffer.concat([cipher.update(klartext), cipher.final()]);

    const mitPraefix = Buffer.concat([iv, chiffrat]).toString("base64");
    expect(aesCbcEntschluesseln(mitPraefix, schluessel).equals(klartext)).toBe(true);

    expect(
      aesCbcEntschluesseln(chiffrat.toString("base64"), schluessel, iv.toString("base64")).equals(klartext),
    ).toBe(true);
  });

  it("aesGcmEntschluesseln wirft bei gekürztem Tag (12 und 4 Byte)", () => {
    const schluessel = crypto.randomBytes(32);
    const teil = aesGcmVerschluesseln(Buffer.from("geheim"), schluessel);
    const tag = Buffer.from(teil.tag, "base64");
    for (const laenge of [12, 4]) {
      const kurz = tag.subarray(0, laenge).toString("base64");
      expect(() => aesGcmEntschluesseln({ value: teil.data, iv: teil.iv, tag: kurz }, schluessel)).toThrow(
        "Ungültige GCM-Taglänge",
      );
    }
  });

  it("aesGcmEntschluesseln wirft bei IV, der nicht 16 Byte lang ist", () => {
    const schluessel = crypto.randomBytes(32);
    const teil = aesGcmVerschluesseln(Buffer.from("geheim"), schluessel);
    const iv12 = crypto.randomBytes(12).toString("base64");
    expect(() => aesGcmEntschluesseln({ value: teil.data, iv: iv12, tag: teil.tag }, schluessel)).toThrow(
      "Ungültige GCM-IV-Länge",
    );
  });

  it("aesCbcEntschluesseln meldet zu kurzes Chiffrat und falsche IV-Länge", () => {
    const schluessel = crypto.randomBytes(32);
    expect(() => aesCbcEntschluesseln(crypto.randomBytes(8).toString("base64"), schluessel)).toThrow(
      "CBC-Chiffrat zu kurz",
    );
    expect(() =>
      aesCbcEntschluesseln(
        crypto.randomBytes(16).toString("base64"),
        schluessel,
        crypto.randomBytes(8).toString("base64"),
      ),
    ).toThrow("Ungültige CBC-IV-Länge");
  });
});
