/**
 * Cryptographic primitives for the bea.expert integration.
 *
 * Certificate and PIN never leave this server: the login challenge is signed
 * locally and session keys / message parts are decrypted locally.
 * Never log any input or output of these functions.
 */
import crypto from "node:crypto";
import forge from "node-forge";
import { KJUR } from "jsrsasign";

const P12_FEHLER = "PIN falsch oder Datei ist kein beA-Softwarezertifikat";

export interface P12Inhalt {
  privateKeyPem: string;
  zertifikatPem: string;
  thumbprintSha1Hex: string;
  seriennummer: string;
  inhaber: string;
  gueltigBis: Date;
}

/**
 * Opens a PKCS#12 file (beA software certificate) with the given PIN.
 * Accepts shrouded (pkcs8ShroudedKeyBag) and plain (keyBag) key bags.
 */
export function leseP12(p12: Buffer, pin: string): P12Inhalt {
  let schluessel: forge.pki.rsa.PrivateKey | undefined;
  let zertifikate: crypto.X509Certificate[];

  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12.toString("binary")));
    const pfx = forge.pkcs12.pkcs12FromAsn1(asn1, false, pin);

    const keyBags = [
      ...(pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
      ...(pfx.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
    ];
    schluessel = keyBags.find((b) => b.key)?.key as forge.pki.rsa.PrivateKey | undefined;

    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
    zertifikate = certBags.flatMap((b) => {
      // forge keeps the original TBSCertificate, so the DER is byte-identical;
      // certificates forge cannot parse (non-RSA) only come with raw asn1
      const asn1Cert = b.cert ? forge.pki.certificateToAsn1(b.cert) : b.asn1;
      if (!asn1Cert) return [];
      return [new crypto.X509Certificate(Buffer.from(forge.asn1.toDer(asn1Cert).getBytes(), "binary"))];
    });
  } catch {
    throw new Error(P12_FEHLER);
  }

  if (!schluessel || zertifikate.length === 0) throw new Error(P12_FEHLER);

  const privateKeyPem = forge.pki.privateKeyToPem(schluessel);

  // Pick the certificate belonging to the private key (the file may hold a chain)
  const spki = (k: crypto.KeyObject) => k.export({ format: "der", type: "spki" });
  const eigenerPub = spki(crypto.createPublicKey(privateKeyPem));
  const x509 = zertifikate.find((z) => spki(z.publicKey).equals(eigenerPub)) ?? zertifikate[0];
  const cn = x509.subject
    .split("\n")
    .find((zeile) => zeile.startsWith("CN="))
    ?.slice(3);

  return {
    privateKeyPem,
    zertifikatPem: x509.toString(),
    thumbprintSha1Hex: crypto.createHash("sha1").update(x509.raw).digest("hex"),
    seriennummer: x509.serialNumber.toLowerCase(),
    inhaber: cn ?? x509.subject.split("\n").join(", "),
    gueltigBis: new Date(x509.validTo),
  };
}

// UTCTime YYMMDDhhmmssZ
function utcTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    p(d.getUTCFullYear() % 100) +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds()) +
    "Z"
  );
}

/**
 * Signs the bea.expert login challenge as CMS SignedData
 * (RSASSA-PSS with SHA-512/MGF1-SHA-512, signed attributes incl. signingCertificateV2).
 * Returns DER as Base64 without PEM armour.
 */
export function signiereChallenge(challenge: string, zertifikatPem: string, privateKeyPem: string): string {
  const inhaltHex = Buffer.from(challenge, "utf8").toString("hex");
  const digestHex = crypto.createHash("sha512").update(challenge, "utf8").digest("hex");

  const sd = new KJUR.asn1.cms.SignedData({
    // fixed: use the parameters as given (jsrsasign would otherwise recompute
    // digest algorithms and the message digest from a latin1 view of the content)
    fixed: true,
    version: 1,
    hashalgs: ["sha256", "sha512"],
    econtent: { type: "data", content: { hex: inhaltHex } },
    certs: [zertifikatPem],
    sinfos: [
      {
        version: 1,
        id: { type: "isssn", cert: zertifikatPem },
        hashalg: "sha512",
        sattrs: {
          array: [
            { attr: "contentType", type: "data" },
            { attr: "messageDigest", hex: digestHex },
            { attr: "signingCertificateV2", array: [zertifikatPem] },
            { attr: "signingTime", str: utcTime(new Date()) },
          ],
        },
        sigalg: "SHA512withRSAandMGF1",
        signkey: privateKeyPem,
      },
    ],
  });

  return Buffer.from(sd.getContentInfoEncodedHex(), "hex").toString("base64");
}

/** RSA-OAEP (SHA-256) decryption, e.g. of the session key. */
export function rsaOaepEntschluesseln(chiffratB64: string, privateKeyPem: string): Buffer {
  return crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(chiffratB64, "base64"),
  );
}

function aesAlgorithmus(modus: "gcm" | "cbc", schluessel: Buffer): crypto.CipherGCMTypes | string {
  const bits = schluessel.length * 8;
  if (bits !== 128 && bits !== 192 && bits !== 256) {
    throw new Error(`Ungültige AES-Schlüssellänge: ${schluessel.length} Byte`);
  }
  return `aes-${bits}-${modus}`;
}

/** AES-GCM decryption; all fields Base64. Throws if the tag does not verify. */
export function aesGcmEntschluesseln(
  teil: { value: string; iv: string; tag: string },
  schluessel: Buffer,
): Buffer {
  const decipher = crypto.createDecipheriv(
    aesAlgorithmus("gcm", schluessel) as crypto.CipherGCMTypes,
    schluessel,
    Buffer.from(teil.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(teil.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(teil.value, "base64")), decipher.final()]);
}

/** AES-GCM encryption with a random 16-byte IV (as bea.expert expects). */
export function aesGcmVerschluesseln(
  klartext: Buffer,
  schluessel: Buffer,
): { data: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    aesAlgorithmus("gcm", schluessel) as crypto.CipherGCMTypes,
    schluessel,
    iv,
  );
  const data = Buffer.concat([cipher.update(klartext), cipher.final()]);
  return {
    data: data.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

/**
 * AES-CBC decryption (PKCS#7 padding). Without a separate IV the first
 * 16 bytes of the ciphertext are the IV.
 */
export function aesCbcEntschluesseln(chiffratB64: string, schluessel: Buffer, ivB64?: string): Buffer {
  let daten = Buffer.from(chiffratB64, "base64");
  let iv: Buffer;
  if (ivB64) {
    iv = Buffer.from(ivB64, "base64");
  } else {
    iv = daten.subarray(0, 16);
    daten = daten.subarray(16);
  }
  const decipher = crypto.createDecipheriv(aesAlgorithmus("cbc", schluessel), schluessel, iv);
  return Buffer.concat([decipher.update(daten), decipher.final()]);
}
