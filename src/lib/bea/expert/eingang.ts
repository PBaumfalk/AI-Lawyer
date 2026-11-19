/**
 * Incoming beA messages via bea.expert: postboxes, folders, message list and
 * full message retrieval with local decryption.
 *
 * Field names follow the public bea.expert reference clients (bea-api-javascript,
 * bea-api-python, bea-api-c-sharp, bea2email); names still marked "assumption"
 * are not settled there. Each response type is mapped in exactly one function
 * so a correction stays local. Never log token, keys or decrypted content.
 */
import { bexAufruf, BeaExpertError } from "./transport";
import { aesGcmEntschluesseln, aesCbcEntschluesseln } from "./krypto";
import { leseCoco, leseBeaMessageJson, COCO_NAMEN, BEA_MESSAGE_JSON } from "./coco";
import type {
  BeaSitzung,
  BeaPostfachInfo,
  BeaOrdnerInfo,
  BeaNachrichtKopf,
  BeaAnhangDaten,
  BeaNachrichtVoll,
} from "../provider";

const AES256_CBC = "http://www.w3.org/2001/04/xmlenc#aes256-cbc";

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

/**
 * Message metadata persons carry `name`; folder overview senders carry
 * `surname`/`firstname` (rendered "Surname, Firstname").
 */
function person(x: unknown): { safeId: string; name: string } {
  if (typeof x === "string") return { safeId: "", name: x };
  const o = obj(x);
  const name =
    str(o.name) || [str(o.surname), str(o.firstname)].filter(Boolean).join(", ") || str(o.displayName);
  return { safeId: str(o.safeId), name };
}

function gcmTeil(x: unknown): GcmTeil {
  const o = obj(x);
  return { value: str(o.value), iv: str(o.iv), tag: str(o.tag) };
}

/**
 * Decrypts an encrypted text field with the session key. A missing field or an
 * empty `value` yields "" (the overview often has no subject); plain strings pass through.
 */
function entschluessleText(x: unknown, sessionKey: Buffer): string {
  if (x === null || x === undefined) return "";
  if (typeof x === "string") return x;
  const teil = gcmTeil(x);
  if (teil.value === "") return "";
  return aesGcmEntschluesseln(teil, sessionKey).toString("utf8");
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

/**
 * bea_get_postboxes: `{ postboxes: [{ postboxSafeId, displayName, folder[] }] }`.
 * The reference has no postbox type; `typ` stays "" unless a `type` field appears.
 */
function mappePostfaecher(antwort: unknown): BeaPostfachInfo[] {
  return liste(antwort, ["postboxes"]).map((p) => ({
    safeId: str(p.postboxSafeId),
    name: str(p.displayName),
    typ: str(p.type),
  }));
}

/** bea_get_folderstructure: `{ folders: [{ id, name, postboxSafeId, type, parentFolderId }] }`. */
function mappeOrdner(antwort: unknown): BeaOrdnerInfo[] {
  return liste(antwort, ["folders", "folder"]).map((f) => ({
    id: str(f.id),
    name: str(f.name),
    typ: str(f.type),
    parentId: strOderNull(f.parentFolderId),
  }));
}

/**
 * bea_get_folderoverview: `{ messages: [{ messageId, encSubject{value,iv,tag},
 * sender{surname, firstname, ...}, zugegangen, received, ... }] }`.
 * The overview carries no eEB flag: `eebAngefordert` is only reliable from
 * holeNachricht; here it is read if present, else false.
 */
function mappeKoepfe(antwort: unknown, sessionKey: Buffer): BeaNachrichtKopf[] {
  return liste(antwort, ["messages"]).map((m) => ({
    messageId: str(m.messageId),
    betreff: entschluessleText(m.encSubject, sessionKey),
    absender: person(m.sender).name,
    empfangenAm: datum(m.zugegangen) ?? datum(m.received),
    eebAngefordert: bool(m.eebAngefordert),
  }));
}

/** bea_get_message: metadata, encrypted objects and attachments. */
function mappeNachricht(antwort: unknown, sessionKey: Buffer): BeaNachrichtVoll {
  const n = obj(antwort);
  const meta = obj(n.metaData);

  let textJson: string | null = null;
  let textCoco: string | null = null;
  const schluessel = new Map<string, Buffer>();
  let standardSchluessel: Buffer | null = null;

  for (const roh of Array.isArray(n.encryptedObjects) ? n.encryptedObjects : []) {
    const o = obj(roh);
    const name = str(o.enc_name);
    const objectKey = aesGcmEntschluesseln(gcmTeil(obj(o.encKeyInfo).encKey), sessionKey);
    const iv = str(o.enc_iv);
    const tag = str(o.enc_tag);
    const daten =
      iv === "" && tag === ""
        ? aesCbcEntschluesseln(str(o.enc_data), objectKey)
        : aesGcmEntschluesseln({ value: str(o.enc_data), iv, tag }, objectKey);

    if (COCO_NAMEN.has(name)) {
      const coco = leseCoco(daten.toString("utf8"));
      for (const [ref, key] of coco.schluessel) schluessel.set(ref, key);
      standardSchluessel ??= coco.standard;
      textCoco ??= coco.freitext;
    } else if (name === BEA_MESSAGE_JSON) {
      textJson ??= leseBeaMessageJson(daten.toString("utf8"));
    }
  }

  const anhaenge: BeaAnhangDaten[] = [];
  for (const roh of Array.isArray(n.attachments) ? n.attachments : []) {
    const a = obj(roh);
    const name = str(a.reference);
    const elementKey = str(a.key);
    // As in the reference client: exact CipherReference match, then the
    // attachment's own key, then the first coco key as a last resort
    const key =
      schluessel.get(name) ??
      (elementKey ? Buffer.from(elementKey, "base64") : null) ??
      standardSchluessel;
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
    // beaMessage.json is the primary body source, project_coco's Freitext the fallback
    text: textJson ?? textCoco,
    absender: person(meta.sender),
    empfaenger: (Array.isArray(meta.addressees) ? meta.addressees : []).map(person),
    aktenzeichenAbsender: strOderNull(meta.referenceNumber),
    aktenzeichenJustiz: strOderNull(meta.referenceJustice),
    empfangenAm: datum(meta.receptionTime) ?? datum(meta.zugegangen),
    eebAngefordert: bool(meta.eebAngefordert),
    vertraulich: bool(meta.confidential),
    dringend: bool(meta.urgent),
    anhaenge,
  };
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
