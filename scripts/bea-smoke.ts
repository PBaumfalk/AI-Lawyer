/**
 * Smoke test against the real bea.expert API (Task 13).
 *
 *   BEA_SMOKE_P12=/pfad/zert.p12 BEA_SMOKE_PIN=... BEA_EXPERT_IDENT=... \
 *     npx tsx scripts/bea-smoke.ts [--senden]
 *
 * Prints only postbox/folder names, subjects, attachment names and sizes, message ids.
 * Never prints token, session key, PIN, keys, message text or attachment bytes.
 */
import { readFileSync } from "node:fs";
import { anmelden } from "../src/lib/bea/expert/login";
import { holePostfaecher, holeOrdner, holeNachrichtenkoepfe, holeNachricht } from "../src/lib/bea/expert/eingang";
import { sendeNachricht } from "../src/lib/bea/expert/ausgang";
import { BeaExpertProvider } from "../src/lib/bea/expert/provider";
import { BeaExpertError } from "../src/lib/bea/expert/transport";
import type { BeaSitzung } from "../src/lib/bea/provider";

const HILFE = `beA-Smoke-Test gegen bea.expert

Aufruf:
  BEA_SMOKE_P12=/pfad/zert.p12 BEA_SMOKE_PIN=... BEA_EXPERT_IDENT=... \\
    npx tsx scripts/bea-smoke.ts [--senden]

Umgebungsvariablen:
  BEA_SMOKE_P12     Pfad zum beA-Softwarezertifikat (.p12/.pfx)
  BEA_SMOKE_PIN     PIN des Zertifikats
  BEA_EXPERT_IDENT  Ident aus dem bea.expert-Vertrag
  DATABASE_URL      Erforderlich, weil die API-URL aus der Einstellung bea.api_url
                    (Standard https://api.bea.expert) in der Datenbank gelesen wird.

Optionen:
  --senden  Sendet zusätzlich eine TESTNACHRICHT mit test.txt an die EIGENE SAFE-ID.
  --help    Diese Hilfe.

Ausgegeben werden nur Namen, Betreffe, Anhangnamen und -größen sowie die messageId.`;

class Abbruch extends Error {}

function fehler(text: string): never {
  throw new Abbruch(text);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HILFE);
    return;
  }
  const senden = args.includes("--senden");

  const fehlend = ["BEA_SMOKE_P12", "BEA_SMOKE_PIN", "BEA_EXPERT_IDENT"].filter((n) => !process.env[n]?.trim());
  if (fehlend.length) {
    console.error(`Fehlende Umgebungsvariablen: ${fehlend.join(", ")}\n`);
    console.error(HILFE);
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) {
    console.warn("Hinweis: DATABASE_URL ist nicht gesetzt; das Lesen von bea.api_url kann fehlschlagen.");
  }

  let p12: Buffer;
  try {
    p12 = readFileSync(process.env.BEA_SMOKE_P12!.trim());
  } catch {
    console.error("FEHLER: Zertifikatsdatei konnte nicht gelesen werden (BEA_SMOKE_P12 prüfen).");
    process.exitCode = 1;
    return;
  }

  let sitzung: BeaSitzung | null = null;
  try {
    console.log("1. Anmelden ...");
    sitzung = await anmelden(p12, process.env.BEA_SMOKE_PIN!);
    console.log(`   Angemeldet als SAFE-ID ${sitzung.safeId}`);

    console.log("2. Postfächer");
    const postfaecher = await holePostfaecher(sitzung);
    for (const p of postfaecher) console.log(`   - ${p.name} (${p.typ}) ${p.safeId}`);
    if (!postfaecher.length) fehler("Keine Postfächer zurückgegeben.");

    const eigenes = postfaecher.find((p) => p.safeId === sitzung!.safeId) ?? postfaecher[0];
    console.log(`3. Ordner von ${eigenes.name}`);
    const ordner = await holeOrdner(sitzung, eigenes.safeId);
    for (const o of ordner) console.log(`   - ${o.name} [${o.typ}] id=${o.id}`);

    const eingang = ordner.find((o) => o.typ === "INBOX");
    if (!eingang) {
      console.warn("   Annahme verletzt: kein Ordner mit Typ INBOX gefunden.");
    } else {
      console.log(`4. Posteingang (${eingang.name})`);
      const koepfe = await holeNachrichtenkoepfe(sitzung, eingang.id);
      console.log(`   ${koepfe.length} Nachricht(en)`);
      for (const k of koepfe.slice(0, 5)) {
        console.log(`   - ${k.empfangenAm?.toISOString() ?? "ohne Datum"} | ${k.betreff} | eEB: ${k.eebAngefordert ? "ja" : "nein"}`);
      }
      const neueste = koepfe[0];
      if (neueste) {
        const voll = await holeNachricht(sitzung, neueste.messageId);
        console.log(`   Neueste Nachricht ${voll.messageId}: "${voll.betreff}"`);
        console.log(`   Text vorhanden: ${voll.text ? "ja" : "nein"} (Inhalt wird nicht ausgegeben)`);
        for (const a of voll.anhaenge) console.log(`   Anhang: ${a.name} (${a.inhalt.length} Bytes, ${a.typ ?? "ohne Typ"})`);
        if (!voll.anhaenge.length) console.log("   Keine Anhänge.");
      }
    }

    if (senden) {
      console.log("5. TESTNACHRICHT an die eigene SAFE-ID");
      const erg = await sendeNachricht(sitzung, {
        postfachSafeId: sitzung.safeId,
        empfaengerSafeIds: [sitzung.safeId],
        betreff: "Smoke-Test AI-Lawyer (Müller ß €)",
        text: "Testnachricht des AI-Lawyer-Smoke-Tests. Bitte ignorieren.",
        nachrichtenTyp: "TESTNACHRICHT",
        eebAnfordern: false,
        dringend: false,
        anhaenge: [{ name: "test.txt", inhalt: Buffer.from("Smoke-Test Müller ß €\n", "utf8"), art: "ATTACHMENT" }],
      });
      console.log(`   messageId: ${erg.messageId ?? "(keine zurückgegeben)"}`);
    } else {
      console.log("5. Senden übersprungen (ohne --senden).");
    }
    console.log("OK");
  } catch (err) {
    // Only BeaExpertError messages are guaranteed free of credentials.
    // No process.exit here: the finally block must still log out.
    const text =
      err instanceof Abbruch
        ? err.message
        : err instanceof BeaExpertError
          ? `${err.message} (${err.funktion}${err.status ? `, HTTP ${err.status}` : ""})`
          : `Unerwarteter Fehler (${err instanceof Error ? err.name : "unbekannt"}).`;
    console.error(`FEHLER: ${text}`);
    process.exitCode = 1;
  } finally {
    if (sitzung) {
      try {
        await new BeaExpertProvider().abmelden(sitzung);
        console.log("Abgemeldet.");
      } catch {
        console.warn("Abmeldung nicht möglich.");
      }
    }
  }
}

void main();
