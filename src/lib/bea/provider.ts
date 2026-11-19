/** Active beA session at bea.expert. Never log or serialize (token and sessionKey are secrets). */
export interface BeaSitzung {
  token: string;
  sessionKey: Buffer;
  safeId: string;
}
