import type {
  BeaProvider, BeaSitzung, BeaPostfachInfo, BeaOrdnerInfo, BeaNachrichtKopf,
  BeaNachrichtVoll, BeaVersandAuftrag, BeaEebAuftrag, BeaVersandErgebnis,
} from "./provider";
import { BeaExpertError } from "./expert/transport";

/** In-memory provider for development and tests. Never used in production. */
export class MockProvider implements BeaProvider {
  gesendet: (BeaVersandAuftrag | BeaEebAuftrag)[] = [];
  private zaehler = 0;
  private postfaecher: BeaPostfachInfo[];
  private nachrichten: BeaNachrichtVoll[];

  constructor(seed?: { postfaecher?: BeaPostfachInfo[]; nachrichten?: BeaNachrichtVoll[] }) {
    this.postfaecher = seed?.postfaecher ?? [];
    this.nachrichten = seed?.nachrichten ?? [];
  }

  private neueId(): string {
    this.zaehler += 1;
    return `mock-${this.zaehler}`;
  }

  async anmelden(_p12: Buffer, pin: string): Promise<BeaSitzung> {
    if (pin === "falsch") {
      throw new BeaExpertError("Anmeldung fehlgeschlagen: PIN falsch.", "bex_login_step2", 401);
    }
    return { token: "mock-token", sessionKey: Buffer.alloc(32), safeId: "DE.Mock.safeid" };
  }

  async pruefeSitzung(_s: BeaSitzung): Promise<boolean> {
    return true;
  }

  async abmelden(_s: BeaSitzung): Promise<void> {}

  async listePostfaecher(_s: BeaSitzung): Promise<BeaPostfachInfo[]> {
    return this.postfaecher;
  }

  async listeOrdner(_s: BeaSitzung, postfachSafeId: string): Promise<BeaOrdnerInfo[]> {
    return [{ id: `mock-ordner-${postfachSafeId}`, name: "Posteingang", typ: "INBOX", parentId: null }];
  }

  async listeNachrichten(_s: BeaSitzung, _ordnerId: string): Promise<BeaNachrichtKopf[]> {
    return this.nachrichten.map((n) => ({
      messageId: n.messageId,
      betreff: n.betreff,
      absender: n.absender.name,
      empfangenAm: n.empfangenAm,
      eebAngefordert: n.eebAngefordert,
    }));
  }

  async holeNachricht(_s: BeaSitzung, messageId: string): Promise<BeaNachrichtVoll> {
    const n = this.nachrichten.find((m) => m.messageId === messageId);
    if (!n) throw new Error(`Mock: Nachricht ${messageId} nicht gefunden.`);
    return n;
  }

  async sende(_s: BeaSitzung, a: BeaVersandAuftrag): Promise<BeaVersandErgebnis> {
    this.gesendet.push(a);
    return { messageId: this.neueId() };
  }

  async speichereEntwurf(_s: BeaSitzung, a: BeaVersandAuftrag): Promise<{ messageId: string | null }> {
    this.gesendet.push(a);
    return { messageId: this.neueId() };
  }

  async gibEebAb(_s: BeaSitzung, a: BeaEebAuftrag): Promise<BeaVersandErgebnis> {
    this.gesendet.push(a);
    return { messageId: this.neueId() };
  }

  async sucheIdentitaet(
    _s: BeaSitzung,
    _q: { name?: string; plz?: string; ort?: string },
  ): Promise<{ safeId: string; name: string; ort: string | null }[]> {
    return [];
  }
}
