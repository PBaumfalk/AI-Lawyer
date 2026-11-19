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
