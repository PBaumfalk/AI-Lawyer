import { BeaExpertProvider } from "./expert/provider";
import { MockProvider } from "./mock-provider";

/** Active beA session at bea.expert. Never log or serialize (token and sessionKey are secrets). */
export interface BeaSitzung {
  token: string;
  sessionKey: Buffer;
  safeId: string;
}

export interface BeaPostfachInfo { safeId: string; name: string; typ: string }
export interface BeaOrdnerInfo { id: string; name: string; typ: string; parentId: string | null }
export interface BeaNachrichtKopf { messageId: string; betreff: string; absender: string; empfangenAm: Date | null; eebAngefordert: boolean }
export interface BeaAnhangDaten { name: string; mimeType: string; inhalt: Buffer; typ: string | null }
export interface BeaNachrichtVoll {
  messageId: string; osciMessageId: string | null; betreff: string; text: string | null;
  absender: { safeId: string; name: string }; empfaenger: { safeId: string; name: string }[];
  aktenzeichenAbsender: string | null; aktenzeichenJustiz: string | null;
  empfangenAm: Date | null; eebAngefordert: boolean; vertraulich: boolean; dringend: boolean;
  anhaenge: BeaAnhangDaten[];
}
export type BeaNachrichtenTyp = "ALLGEMEINE_NACHRICHT" | "MAHN_ANTRAG" | "TESTNACHRICHT";
export interface BeaVersandAuftrag {
  postfachSafeId: string; empfaengerSafeIds: string[]; betreff: string; text: string;
  aktenzeichenAbsender?: string; aktenzeichenEmpfaenger?: string;
  nachrichtenTyp: BeaNachrichtenTyp; eebAnfordern: boolean; dringend: boolean;
  anhaenge: { name: string; inhalt: Buffer; art: "SCHRIFTSATZ" | "ATTACHMENT" }[];
}
export interface BeaEebAuftrag {
  postfachSafeId: string; empfaengerSafeId: string; betreff: string;
  aktenzeichenAbsender?: string; aktenzeichenEmpfaenger?: string;
  fremdId: string; abgabeDatum: string /* YYYY-MM-DD */;
}
export interface BeaVersandErgebnis { messageId: string | null }

export interface BeaProvider {
  anmelden(p12: Buffer, pin: string): Promise<BeaSitzung>;
  pruefeSitzung(s: BeaSitzung): Promise<boolean>;
  abmelden(s: BeaSitzung): Promise<void>;
  listePostfaecher(s: BeaSitzung): Promise<BeaPostfachInfo[]>;
  listeOrdner(s: BeaSitzung, postfachSafeId: string): Promise<BeaOrdnerInfo[]>;
  listeNachrichten(s: BeaSitzung, ordnerId: string): Promise<BeaNachrichtKopf[]>;
  holeNachricht(s: BeaSitzung, messageId: string): Promise<BeaNachrichtVoll>;
  sende(s: BeaSitzung, a: BeaVersandAuftrag): Promise<BeaVersandErgebnis>;
  speichereEntwurf(s: BeaSitzung, a: BeaVersandAuftrag): Promise<{ messageId: string | null }>;
  gibEebAb(s: BeaSitzung, a: BeaEebAuftrag): Promise<BeaVersandErgebnis>;
  sucheIdentitaet(
    s: BeaSitzung,
    q: { name?: string; plz?: string; ort?: string },
  ): Promise<{ safeId: string; name: string; ort: string | null }[]>;
}

// Module-level singleton so mock state survives across requests in development.
let mockInstanz: MockProvider | null = null;

/**
 * Selects the beA provider. null = beA disabled (production without bea.expert ident).
 * Default: expert if BEA_EXPERT_IDENT is set, else mock outside production.
 * BEA_PROVIDER overrides explicitly; mock is never available in production.
 */
export function getBeaProvider(): BeaProvider | null {
  const ident = process.env.BEA_EXPERT_IDENT?.trim();
  const produktion = process.env.NODE_ENV === "production";
  const wahl = process.env.BEA_PROVIDER?.trim().toLowerCase();

  const art = wahl === "expert" || wahl === "mock" ? wahl : ident ? "expert" : "mock";

  if (art === "expert") return ident ? new BeaExpertProvider() : null;
  if (produktion) return null;
  return (mockInstanz ??= new MockProvider());
}
