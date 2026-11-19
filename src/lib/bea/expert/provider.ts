import type {
  BeaProvider, BeaSitzung, BeaPostfachInfo, BeaOrdnerInfo, BeaNachrichtKopf,
  BeaNachrichtVoll, BeaVersandAuftrag, BeaEebAuftrag, BeaVersandErgebnis,
} from "../provider";
import { anmelden } from "./login";
import { holePostfaecher, holeOrdner, holeNachrichtenkoepfe, holeNachricht } from "./eingang";
import { sendeNachricht, speichereEntwurf, sendeEebAntwort } from "./ausgang";
import { bexAufruf, BeaExpertError } from "./transport";

type IdentitaetsAnfrage = { name?: string; plz?: string; ort?: string };
type IdentitaetsTreffer = { safeId: string; name: string; ort: string | null };

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Maps the bea_search response (results[]: safeId, firstname, surname, city) to our shape. */
function mappeIdentitaeten(antwort: unknown): IdentitaetsTreffer[] {
  const results =
    antwort && typeof antwort === "object" ? (antwort as { results?: unknown }).results : undefined;
  if (!Array.isArray(results)) return [];
  return results.flatMap((r): IdentitaetsTreffer[] => {
    if (!r || typeof r !== "object") return [];
    const o = r as Record<string, unknown>;
    const safeId = str(o.safeId);
    if (!safeId) return [];
    const name = [str(o.firstname), str(o.surname)].filter(Boolean).join(" ");
    return [{ safeId, name, ort: str(o.city) || null }];
  });
}

/** BeaProvider backed by the bea.expert REST API. */
export class BeaExpertProvider implements BeaProvider {
  anmelden(p12: Buffer, pin: string): Promise<BeaSitzung> {
    return anmelden(p12, pin);
  }

  async pruefeSitzung(s: BeaSitzung): Promise<boolean> {
    try {
      await bexAufruf("bea_check_session", { token: s.token });
      return true;
    } catch (err) {
      // Only an API-level answer (HTTP < 500 or error body) means the session is invalid.
      // Network errors, timeouts, missing config and 5xx are outages and must surface.
      if (err instanceof BeaExpertError && err.status !== null && err.status < 500) return false;
      throw err;
    }
  }

  async abmelden(s: BeaSitzung): Promise<void> {
    // Best effort: logging out an already expired session is normal. Never log the token.
    try {
      await bexAufruf("bea_logout", { token: s.token });
    } catch (err) {
      if (!(err instanceof BeaExpertError)) throw err;
      console.warn("beA-Abmeldung fehlgeschlagen", { funktion: err.funktion, status: err.status });
    }
  }

  listePostfaecher(s: BeaSitzung): Promise<BeaPostfachInfo[]> {
    return holePostfaecher(s);
  }

  listeOrdner(s: BeaSitzung, postfachSafeId: string): Promise<BeaOrdnerInfo[]> {
    return holeOrdner(s, postfachSafeId);
  }

  listeNachrichten(s: BeaSitzung, ordnerId: string): Promise<BeaNachrichtKopf[]> {
    return holeNachrichtenkoepfe(s, ordnerId);
  }

  holeNachricht(s: BeaSitzung, messageId: string): Promise<BeaNachrichtVoll> {
    return holeNachricht(s, messageId);
  }

  sende(s: BeaSitzung, a: BeaVersandAuftrag): Promise<BeaVersandErgebnis> {
    return sendeNachricht(s, a);
  }

  speichereEntwurf(s: BeaSitzung, a: BeaVersandAuftrag): Promise<{ messageId: string | null }> {
    return speichereEntwurf(s, a);
  }

  gibEebAb(s: BeaSitzung, a: BeaEebAuftrag): Promise<BeaVersandErgebnis> {
    return sendeEebAntwort(s, a);
  }

  async sucheIdentitaet(s: BeaSitzung, q: IdentitaetsAnfrage): Promise<IdentitaetsTreffer[]> {
    const antwort = await bexAufruf("bea_search", {
      token: s.token,
      identitySafeId: "",
      identityStatus: "",
      identityType: "",
      identityUsername: "",
      identityFirstname: "",
      identitySurname: q.name ?? "",
      identityPostalcode: q.plz ?? "",
      identityCity: q.ort ?? "",
      identityChamberType: "",
      identityChamberMembershipId: "",
      identityOfficeName: "",
    });
    return mappeIdentitaeten(antwort);
  }
}
