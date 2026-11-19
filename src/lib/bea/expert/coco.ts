/**
 * XML helpers for decrypted beA message parts: the project_coco (older name
 * govello_coco) object with attachment keys and Freitext, and the OSCI-wrapped
 * beaMessage.json. Input is decrypted content: parse errors must never carry
 * it into an error message or cause.
 */
import { XMLParser } from "fast-xml-parser";
import { BeaExpertError } from "./transport";

// "govello_coco" is the older name of the same object
export const COCO_NAMEN = new Set(["project_coco", "govello_coco"]);
// Encrypted object carrying an OSCI Base64Content with JSON { messageSubject, messageBody }
export const BEA_MESSAGE_JSON = "beaMessage.json";

type Roh = Record<string, unknown>;

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

function textVon(knoten: unknown): string {
  return typeof knoten === "string" ? knoten : str(obj(knoten)["#text"]);
}

/** Decodes an OSCI Base64Content node to UTF-8. */
function base64Inhalt(knoten: unknown): string {
  return Buffer.from(textVon(knoten).trim(), "base64").toString("utf8");
}

/** beaMessage.json: OSCI XML whose Base64Content holds JSON with `messageBody`. */
export function leseBeaMessageJson(xml: string): string | null {
  try {
    const inhalte: unknown[] = [];
    sammle(cocoParser.parse(xml), "Base64Content", inhalte);
    if (inhalte.length === 0) return null;
    return strOderNull(obj(JSON.parse(base64Inhalt(inhalte[0]))).messageBody);
  } catch {
    // XML/JSON parse errors quote the input (plaintext) and are dropped; the
    // body is optional, so fall back to the coco Freitext
    return null;
  }
}

/** Freitext from the Base64Content with Id "nachricht.xml" inside project_coco. */
function leseFreitext(baum: unknown): string | null {
  const inhalte: unknown[] = [];
  sammle(baum, "Base64Content", inhalte);
  const nachricht = inhalte.find((k) => str(obj(k)["@_Id"]) === "nachricht.xml");
  if (!nachricht) return null;
  const freitext: unknown[] = [];
  sammle(cocoParser.parse(base64Inhalt(nachricht)), "Freitext", freitext);
  return freitext.length > 0 ? strOderNull(textVon(freitext[0])) : null;
}

/**
 * Parses the project_coco XML: the n-th CipherReference@URI (without "cid:")
 * belongs to the n-th MgmtData (Base64 key). If the counts differ, the first
 * key applies to every listed URI (also returned as `standard`). Also extracts
 * the Freitext as a fallback message body.
 */
export function leseCoco(xml: string): {
  schluessel: Map<string, Buffer>;
  standard: Buffer | null;
  freitext: string | null;
} {
  let baum: unknown;
  let freitext: string | null;
  try {
    baum = cocoParser.parse(xml);
    freitext = leseFreitext(baum);
  } catch {
    // Parser errors quote the input (plaintext): generic message, no cause
    throw new BeaExpertError("Verschlüsselte Nachrichtenstruktur ist nicht lesbar.", "bea_get_message");
  }
  const refs: unknown[] = [];
  const keys: unknown[] = [];
  sammle(baum, "CipherReference", refs);
  sammle(baum, "MgmtData", keys);

  const uris = refs.map((r) => str(obj(r)["@_URI"]).replace(/^cid:/, ""));
  const puffer = keys.map((k) => Buffer.from(textVon(k).trim(), "base64"));

  const schluessel = new Map<string, Buffer>();
  const gleich = uris.length === puffer.length;
  const standard = gleich ? null : (puffer[0] ?? null);
  uris.forEach((u, i) => {
    const k = gleich ? puffer[i] : standard;
    if (k) schluessel.set(u, k);
  });
  return { schluessel, standard, freitext };
}
