/**
 * Outgoing beA messages via bea.expert: send, save as draft, eEB response.
 *
 * Flow: bea_init_message -> encrypt subject and attachments locally with the
 * message key -> bea_save_message / bea_send_message (+ bea_send_message_validation).
 * Sending is never retried automatically. On any failure after init the message
 * token is released via bea_cleanup_message (best effort, failures only logged).
 * Never log token, keys or plaintexts.
 */
import crypto from "node:crypto";
import { createLogger } from "@/lib/logger";
import { bexAufruf, BeaExpertError } from "./transport";
import { aesGcmEntschluesseln, aesGcmVerschluesseln } from "./krypto";
import { heuteBerlin } from "../regeln";
import type {
  BeaSitzung,
  BeaVersandAuftrag,
  BeaEebAuftrag,
  BeaVersandErgebnis,
} from "../provider";

const log = createLogger("bea-ausgang");

/** init, save, send and validation can take long for large attachments. */
const VERSAND_TIMEOUT_MS = 300_000;

type Roh = Record<string, unknown>;

function obj(x: unknown): Roh {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Roh) : {};
}

function str(x: unknown): string {
  return typeof x === "string" ? x : typeof x === "number" ? String(x) : "";
}

function istEeb(a: BeaVersandAuftrag | BeaEebAuftrag): a is BeaEebAuftrag {
  return "fremdId" in a;
}

/**
 * eeb_date for bea.expert. Assumption: "" means "use server time" and is sent
 * when the eEB is given today (Europe/Berlin); otherwise the date as YYYY-MM-DD.
 */
export function formatEebDatum(abgabeDatum: string, heute: string = heuteBerlin()): string {
  return abgabeDatum === heute ? "" : abgabeDatum;
}

/** Builds msg_infos for bea_init_message. Drafts carry no receivers. */
export function baueMsgInfos(
  a: BeaVersandAuftrag | BeaEebAuftrag,
  opts: { entwurf?: boolean } = {},
): Record<string, unknown> {
  const gemeinsam = {
    betreff: a.betreff,
    aktz_sender: a.aktenzeichenAbsender ?? "",
    aktz_rcv: a.aktenzeichenEmpfaenger ?? "",
    pruefen: false,
    verfahrensgegenstand: "",
    xj: true,
  };

  if (istEeb(a)) {
    return {
      ...gemeinsam,
      msg_text: "",
      is_eeb: true,
      dringend: false,
      receivers: opts.entwurf ? [] : [a.empfaengerSafeId],
      attachments: [],
      is_eeb_response: true,
      eeb_fremdid: a.fremdId,
      eeb_date: formatEebDatum(a.abgabeDatum),
      eeb_erforderlich: false,
      eeb_accept: true,
      nachrichten_typ: "ALLGEMEINE_NACHRICHT",
    };
  }

  return {
    ...gemeinsam,
    msg_text: a.text,
    is_eeb: false,
    dringend: a.dringend,
    receivers: opts.entwurf ? [] : [...a.empfaengerSafeIds],
    attachments: a.anhaenge.map((x) => x.name),
    is_eeb_response: false,
    eeb_fremdid: "",
    eeb_date: "",
    eeb_erforderlich: a.eebAnfordern,
    eeb_accept: false,
    nachrichten_typ: a.nachrichtenTyp,
  };
}

/** Wraps non-API errors (e.g. local crypto) so callers only see BeaExpertError. */
function alsBeaFehler(err: unknown, funktion: string): BeaExpertError {
  if (err instanceof BeaExpertError) return err;
  return new BeaExpertError(`beA-Versand fehlgeschlagen (${funktion}).`, funktion, null, null, {
    cause: err,
  });
}

interface InitErgebnis {
  messageToken: string;
  /** Message key encrypted with the session key ({value, iv, tag}). */
  roherKey: unknown;
}

async function initNachricht(s: BeaSitzung, postfachSafeId: string, msgInfos: Roh): Promise<InitErgebnis> {
  const antwort = obj(
    await bexAufruf(
      "bea_init_message",
      { token: s.token, postboxSafeId: postfachSafeId, msg_infos: msgInfos },
      { timeoutMs: VERSAND_TIMEOUT_MS },
    ),
  );
  const messageToken = str(antwort.messageToken);
  if (!messageToken) {
    throw new BeaExpertError("beA-Dienst lieferte kein messageToken (bea_init_message).", "bea_init_message");
  }
  return { messageToken, roherKey: antwort.key };
}

function entschluessleNachrichtenKey(roherKey: unknown, sessionKey: Buffer): Buffer {
  const k = obj(roherKey);
  return aesGcmEntschluesseln({ value: str(k.value), iv: str(k.iv), tag: str(k.tag) }, sessionKey);
}

/** Encrypts subject and attachments with the message key (payload for save/send). */
function baueVerschluesselteDaten(
  messageToken: string,
  nachrichtenKey: Buffer,
  betreff: string,
  anhaenge: BeaVersandAuftrag["anhaenge"],
): Roh {
  const keyB64 = nachrichtenKey.toString("base64");
  const s = aesGcmVerschluesseln(Buffer.from(betreff, "utf8"), nachrichtenKey);
  const encSubject = { data: s.data, tag: s.tag, iv: s.iv, key: keyB64 };
  const attachments = anhaenge.map((a) => {
    const e = aesGcmVerschluesseln(a.inhalt, nachrichtenKey);
    return {
      data: e.data,
      tag: e.tag,
      iv: e.iv,
      key: keyB64,
      name: a.name,
      sizeKB: Math.floor(a.inhalt.toString("base64").length / 1024),
      hash: crypto.createHash("sha256").update(a.inhalt).digest("base64"),
      att_type: a.art,
    };
  });
  return { messageToken, encrypted_data: { encSubject, attachments } };
}

/** Decrypts the validation challenges with the session key and confirms the send. */
async function validiere(antwort: unknown, sessionKey: Buffer): Promise<BeaVersandErgebnis> {
  const o = obj(antwort);
  const validationTokenMSG = str(o.validationTokenMSG);
  if (!validationTokenMSG) {
    throw new BeaExpertError(
      "beA-Dienst lieferte kein validationTokenMSG (bea_send_message).",
      "bea_send_message",
    );
  }
  const roh = Array.isArray(o.validations) ? (o.validations as unknown[]).map(obj) : [];
  let validations: { id: string; data: string }[];
  try {
    validations = roh.map((v) => ({
      id: str(v.id),
      data: aesGcmEntschluesseln({ value: str(v.data), iv: str(v.iv), tag: str(v.tag) }, sessionKey).toString(
        "base64",
      ),
    }));
  } catch (err) {
    throw alsBeaFehler(err, "bea_send_message_validation");
  }
  const ergebnis = obj(
    await bexAufruf(
      "bea_send_message_validation",
      { validationTokenMSG, validations },
      { timeoutMs: VERSAND_TIMEOUT_MS },
    ),
  );
  // Field name per V4 (confirmed in the public reference clients): messageId
  const messageId = str(ergebnis.messageId);
  return { messageId: messageId === "" ? null : messageId };
}

/** Best effort: releases the message token. Failures are only logged, without secrets. */
async function aufraeumen(messageToken: string): Promise<void> {
  try {
    await bexAufruf("bea_cleanup_message", { messageToken });
  } catch (err) {
    log.warn(
      {
        funktion: "bea_cleanup_message",
        status: err instanceof BeaExpertError ? err.status : null,
      },
      "beA-Nachricht konnte nach einem Fehler nicht aufgeräumt werden",
    );
  }
}

async function verarbeite<T>(
  s: BeaSitzung,
  postfachSafeId: string,
  msgInfos: Roh,
  betreff: string,
  anhaenge: BeaVersandAuftrag["anhaenge"],
  abschluss: (nutzlast: Roh) => Promise<T>,
): Promise<T> {
  const init = await initNachricht(s, postfachSafeId, msgInfos);
  try {
    let nutzlast: Roh;
    try {
      const nachrichtenKey = entschluessleNachrichtenKey(init.roherKey, s.sessionKey);
      nutzlast = baueVerschluesselteDaten(init.messageToken, nachrichtenKey, betreff, anhaenge);
    } catch (err) {
      throw alsBeaFehler(err, "bea_init_message");
    }
    return await abschluss(nutzlast);
  } catch (err) {
    await aufraeumen(init.messageToken);
    throw alsBeaFehler(err, "beA-Versand");
  }
}

/** Sends a message. Never retried automatically (risk of double delivery). */
export async function sendeNachricht(s: BeaSitzung, a: BeaVersandAuftrag): Promise<BeaVersandErgebnis> {
  return verarbeite(s, a.postfachSafeId, baueMsgInfos(a), a.betreff, a.anhaenge, async (nutzlast) => {
    const antwort = await bexAufruf("bea_send_message", nutzlast, { timeoutMs: VERSAND_TIMEOUT_MS });
    return validiere(antwort, s.sessionKey);
  });
}

/** Saves a message as draft in the postbox (no receivers). */
export async function speichereEntwurf(
  s: BeaSitzung,
  a: BeaVersandAuftrag,
): Promise<{ messageId: string | null }> {
  return verarbeite(
    s,
    a.postfachSafeId,
    baueMsgInfos(a, { entwurf: true }),
    a.betreff,
    a.anhaenge,
    async (nutzlast) => {
      const antwort = obj(await bexAufruf("bea_save_message", nutzlast, { timeoutMs: VERSAND_TIMEOUT_MS }));
      const messageId = str(antwort.messageId);
      return { messageId: messageId === "" ? null : messageId };
    },
  );
}

/** Gives an electronic acknowledgement of receipt (eEB). No attachments. */
export async function sendeEebAntwort(s: BeaSitzung, a: BeaEebAuftrag): Promise<BeaVersandErgebnis> {
  return verarbeite(s, a.postfachSafeId, baueMsgInfos(a), a.betreff, [], async (nutzlast) => {
    const antwort = await bexAufruf("bea_send_message", nutzlast, { timeoutMs: VERSAND_TIMEOUT_MS });
    return validiere(antwort, s.sessionKey);
  });
}
