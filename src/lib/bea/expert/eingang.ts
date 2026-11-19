/**
 * Incoming beA messages via bea.expert: postboxes, folders, message list and
 * full message retrieval with local decryption.
 *
 * Response field names marked "assumption" are not yet verified against the
 * V4 API documentation. Each response type is mapped in exactly one function
 * so a correction stays local. Never log token, keys or decrypted content.
 */
import { XMLParser } from "fast-xml-parser";
import { bexAufruf, BeaExpertError } from "./transport";
import { aesGcmEntschluesseln, aesCbcEntschluesseln } from "./krypto";
import type {
  BeaSitzung,
  BeaPostfachInfo,
  BeaOrdnerInfo,
  BeaNachrichtKopf,
  BeaAnhangDaten,
  BeaNachrichtVoll,
} from "../provider";

const AES256_CBC = "http://www.w3.org/2001/04/xmlenc#aes256-cbc";
const COCO_NAME = "project_coco";
// Assumption: name of the encrypted object holding the message body (per V4)
const TEXT_NAME = /^nachrichtentext/i;

type Roh = Record<string, unknown>;
interface GcmTeil { value: string; iv: string; tag: string }

// ---------- small helpers ----------

function obj(x: unknown): Roh {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Roh) : {};
}

function str(x: unknown): string {
  return typeof x === "string" ? x : typeof x === "number" ? String(x) : "";
}

function strOderNull(x: unknown): string | null {
  const s = str(x);
  return s === "" ? null : s;
}

function bool(x: unknown): boolean {
  return x === true || x === 1 || x === "true" || x === "1";
}

function datum(x: unknown): Date | null {
  if (x === null || x === undefined || x === "") return null;
  const n = typeof x === "number" ? x : /^\d+$/.test(String(x)) ? Number(x) : Date.parse(String(x));
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Accepts a bare array or the first array found under one of the given keys. */
function liste(antwort: unknown, schluessel: string[]): Roh[] {
  if (Array.isArray(antwort)) return antwort.map(obj);
  const o = obj(antwort);
  for (const k of schluessel) if (Array.isArray(o[k])) return (o[k] as unknown[]).map(obj);
  return [];
}

function person(x: unknown): { safeId: string; name: string } {
  if (typeof x === "string") return { safeId: "", name: x };
  const o = obj(x);
  return { safeId: str(o.safeId ?? o.safeid), name: str(o.name ?? o.displayName) };
}

function gcmTeil(x: unknown): GcmTeil {
  const o = obj(x);
  return { value: str(o.value), iv: str(o.iv), tag: str(o.tag) };
}

/** Decrypts an encrypted text field with the session key; plain strings pass through. */
function entschluessleText(x: unknown, sessionKey: Buffer): string {
  if (x === null || x === undefined) return "";
  if (typeof x === "string") return x;
  return aesGcmEntschluesseln(gcmTeil(x), sessionKey).toString("utf8");
}

/**
 * Runs decryption and turns any crypto failure into a BeaExpertError.
 * The message never contains key material or plaintext; the cause carries
 * only the crypto library's generic error.
 */
function mitEntschluesselung<T>(funktion: string, f: () => T): T {
  try {
    return f();
  } catch (err) {
    if (err instanceof BeaExpertError) throw err;
    throw new BeaExpertError(
      `beA-Nachricht konnte nicht entschlüsselt werden (${funktion}).`,
      funktion,
      null,
      null,
      { cause: err },
    );
  }
}

// ---------- mappings (one per response type) ----------

/** bea_get_postboxes. Assumption: `{ postboxes: [{ postboxSafeId, postboxName, type }] }`. */
function mappePostfaecher(antwort: unknown): BeaPostfachInfo[] {
  return liste(antwort, ["postboxes", "postbox"]).map((p) => ({
    safeId: str(p.postboxSafeId ?? p.safeId),
    name: str(p.postboxName ?? p.name),
    typ: str(p.type ?? p.postboxType),
  }));
}

/** bea_get_folderstructure. Assumption: `{ folder: [{ id, name, type, parentId }] }`. */
function mappeOrdner(antwort: unknown): BeaOrdnerInfo[] {
  return liste(antwort, ["folder", "folders"]).map((f) => ({
    id: str(f.id),
    name: str(f.name),
    typ: str(f.type),
    parentId: strOderNull(f.parentId),
  }));
}

/**
 * bea_get_folderoverview. Assumption: `{ messages: [{ messageId, subject{value,iv,tag},
 * sender, receptionTime, eebAngefordert, attachments }] }`.
 */
function mappeKoepfe(antwort: unknown, sessionKey: Buffer): BeaNachrichtKopf[] {
  return liste(antwort, ["messages", "message"]).map((m) => ({
    messageId: str(m.messageId),
    betreff: entschluessleText(m.subject, sessionKey),
    absender: person(m.sender).name,
    empfangenAm: datum(m.receptionTime),
    eebAngefordert: bool(m.eebAngefordert),
  }));
}

/** bea_get_message: metadata, encrypted objects and attachments. */
function mappeNachricht(antwort: unknown, sessionKey: Buffer): BeaNachrichtVoll {
  const n = obj(antwort);
  const meta = obj(n.metaData);

  let text: string | null = null;
  const schluessel = new Map<string, Buffer>();
  let standardSchluessel: Buffer | null = null;

  for (const roh of Array.isArray(n.encryptedObjects) ? n.encryptedObjects : []) {
    const o = obj(roh);
    const name = str(o.enc_name ?? o.name);
    const objectKey = aesGcmEntschluesseln(gcmTeil(obj(o.encKeyInfo).encKey), sessionKey);
    const iv = str(o.enc_iv);
    const tag = str(o.enc_tag);
    const daten =
      iv === "" && tag === ""
        ? aesCbcEntschluesseln(str(o.enc_data), objectKey)
        : aesGcmEntschluesseln({ value: str(o.enc_data), iv, tag }, objectKey);

    if (name === COCO_NAME) {
      const coco = leseCoco(daten.toString("utf8"));
      for (const [ref, key] of coco.schluessel) schluessel.set(ref, key);
      standardSchluessel ??= coco.standard;
    } else if (TEXT_NAME.test(name)) {
      text = daten.toString("utf8");
    }
  }

  const anhaenge: BeaAnhangDaten[] = [];
  for (const roh of Array.isArray(n.attachments) ? n.attachments : []) {
    const a = obj(roh);
    const name = str(a.reference);
    const elementKey = str(a.key);
    const key =
      standardSchluessel ??
      schluessel.get(name) ??
      (elementKey ? Buffer.from(elementKey, "base64") : null);
    if (!key) {
      throw new BeaExpertError(`Kein Schlüssel für einen Anhang gefunden.`, "bea_get_message");
    }
    const iv = str(a.iv);
    const tag = str(a.tag);
    const inhalt =
      str(a.symEncAlgorithm) === AES256_CBC || (iv === "" && tag === "")
        ? aesCbcEntschluesseln(str(a.data), key, iv || undefined)
        : aesGcmEntschluesseln({ value: str(a.data), iv, tag }, key);
    anhaenge.push({ name, mimeType: mimeTypAusName(name), inhalt, typ: strOderNull(a.type) });
  }

  return {
    messageId: str(n.messageId),
    osciMessageId: strOderNull(n.osciMessageId),
    betreff: entschluessleText(meta.subject, sessionKey),
    text,
    absender: person(meta.sender),
    empfaenger: (Array.isArray(meta.addressees) ? meta.addressees : []).map(person),
    aktenzeichenAbsender: strOderNull(meta.referenceNumber),
    aktenzeichenJustiz: strOderNull(meta.referenceJustice),
    empfangenAm: datum(meta.receptionTime),
    eebAngefordert: bool(meta.eebAngefordert),
    vertraulich: bool(meta.confidential),
    dringend: bool(meta.urgent),
    anhaenge,
  };
}

// ---------- project_coco ----------

const cocoParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

/** Collects all nodes of a tag in document order (per tag) from a parsed tree. */
function sammle(knoten: unknown, tag: string, ziel: unknown[]): void {
  if (Array.isArray(knoten)) {
    for (const k of knoten) sammle(k, tag, ziel);
    return;
  }
  if (!knoten || typeof knoten !== "object") return;
  for (const [k, v] of Object.entries(knoten as Roh)) {
    if (k === tag) {
      for (const e of Array.isArray(v) ? v : [v]) ziel.push(e);
    } else {
      sammle(v, tag, ziel);
    }
  }
}

/**
 * Parses the project_coco XML: the n-th CipherReference@URI (without "cid:")
 * belongs to the n-th MgmtData (Base64 key). If the counts differ, the first
 * key applies to all attachments (returned as `standard`).
 */
function leseCoco(xml: string): { schluessel: Map<string, Buffer>; standard: Buffer | null } {
  const baum = cocoParser.parse(xml);
  const refs: unknown[] = [];
  const keys: unknown[] = [];
  sammle(baum, "CipherReference", refs);
  sammle(baum, "MgmtData", keys);

  const uris = refs.map((r) => str(obj(r)["@_URI"]).replace(/^cid:/, ""));
  const schluesselB64 = keys.map((k) => (typeof k === "string" ? k : str(obj(k)["#text"])).trim());
  const puffer = schluesselB64.map((k) => Buffer.from(k, "base64"));

  const schluessel = new Map<string, Buffer>();
  if (uris.length !== puffer.length) {
    return { schluessel, standard: puffer[0] ?? null };
  }
  uris.forEach((u, i) => schluessel.set(u, puffer[i]));
  return { schluessel, standard: null };
}

// ---------- public API ----------

export async function holePostfaecher(s: BeaSitzung): Promise<BeaPostfachInfo[]> {
  return mappePostfaecher(await bexAufruf("bea_get_postboxes", { token: s.token }));
}

export async function holeOrdner(s: BeaSitzung, postfachSafeId: string): Promise<BeaOrdnerInfo[]> {
  return mappeOrdner(
    await bexAufruf("bea_get_folderstructure", { token: s.token, postboxSafeId: postfachSafeId }),
  );
}

export async function holeNachrichtenkoepfe(s: BeaSitzung, ordnerId: string): Promise<BeaNachrichtKopf[]> {
  const funktion = "bea_get_folderoverview";
  const antwort = await bexAufruf(funktion, { token: s.token, folderId: ordnerId });
  return mitEntschluesselung(funktion, () => mappeKoepfe(antwort, s.sessionKey));
}

export async function holeNachricht(s: BeaSitzung, messageId: string): Promise<BeaNachrichtVoll> {
  const funktion = "bea_get_message";
  const antwort = await bexAufruf(funktion, { token: s.token, messageId });
  return mitEntschluesselung(funktion, () => mappeNachricht(antwort, s.sessionKey));
}

const MIME_TYPEN: Record<string, string> = {
  pdf: "application/pdf",
  xml: "application/xml",
  txt: "text/plain",
  p7s: "application/pkcs7-signature",
  tif: "image/tiff",
  tiff: "image/tiff",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
};

export function mimeTypAusName(name: string): string {
  const punkt = name.lastIndexOf(".");
  if (punkt < 0) return "application/octet-stream";
  return MIME_TYPEN[name.slice(punkt + 1).toLowerCase()] ?? "application/octet-stream";
}
