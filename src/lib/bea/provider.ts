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
