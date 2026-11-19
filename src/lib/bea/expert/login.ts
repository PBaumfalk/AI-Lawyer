import type { BeaSitzung } from "../provider";
import { leseP12, signiereChallenge, rsaOaepEntschluesseln } from "./krypto";
import { bexAufruf, BeaExpertError } from "./transport";

interface Step1Antwort {
  challengeVal: string;
  challengeValidation: string;
  tokenPAOS: string;
}
interface Step2Antwort {
  sessionKey: string;
  validationKey: string;
  safeId: string;
  tokenValidation: string;
}
interface Step3Antwort {
  token: string;
}

// UUID layout: 36 chars with '-' at positions 8, 13, 18, 23
function istUuid(s: string): boolean {
  return s.length === 36 && [8, 13, 18, 23].every((i) => s[i] === "-");
}

// Non-UUID challenges arrive Base64 encoded and are decoded before signing
function challengeText(wert: string): string {
  return istUuid(wert) ? wert : Buffer.from(wert, "base64").toString("utf8");
}

function pflichtfelder<T extends object>(antwort: T, felder: (keyof T)[], funktion: string): T {
  for (const f of felder) {
    if (typeof antwort?.[f] !== "string" || !antwort[f]) {
      throw new BeaExpertError(`beA-Anmeldung unvollständig: Feld ${String(f)} fehlt (${funktion}).`, funktion);
    }
  }
  return antwort;
}

/**
 * Three-step bea.expert login. Certificate and PIN stay on this server:
 * challenges are signed and keys decrypted locally.
 */
export async function anmelden(p12: Buffer, pin: string): Promise<BeaSitzung> {
  const zert = leseP12(p12, pin);

  const s1 = pflichtfelder(
    await bexAufruf<Step1Antwort>("bex_login_step1", {
      thumbprint: zert.thumbprintSha1Hex,
      diagnose: false,
    }),
    ["challengeVal", "challengeValidation", "tokenPAOS"],
    "bex_login_step1",
  );

  const challengeSigned = signiereChallenge(challengeText(s1.challengeVal), zert.zertifikatPem, zert.privateKeyPem);
  const validationSigned = signiereChallenge(
    challengeText(s1.challengeValidation),
    zert.zertifikatPem,
    zert.privateKeyPem,
  );

  const s2 = pflichtfelder(
    await bexAufruf<Step2Antwort>("bex_login_step2", {
      tokenPAOS: s1.tokenPAOS,
      userCert: Buffer.from(zert.zertifikatPem, "utf8").toString("base64"),
      challengeSigned,
      validationSigned,
    }),
    ["sessionKey", "validationKey", "safeId", "tokenValidation"],
    "bex_login_step2",
  );

  let sessionKey: Buffer;
  let validationKey: Buffer;
  try {
    sessionKey = rsaOaepEntschluesseln(s2.sessionKey, zert.privateKeyPem);
    validationKey = rsaOaepEntschluesseln(s2.validationKey, zert.privateKeyPem);
  } catch (err) {
    throw new BeaExpertError("beA-Sitzungsschlüssel konnte nicht entschlüsselt werden.", "bex_login_step2", null, null, {
      cause: err,
    });
  }

  const s3 = pflichtfelder(
    await bexAufruf<Step3Antwort>("bex_login_step3", {
      tokenValidation: s2.tokenValidation,
      validationKey: validationKey.toString("base64"),
    }),
    ["token"],
    "bex_login_step3",
  );

  return { token: s3.token, sessionKey, safeId: s2.safeId };
}
