/**
 * Periodic beA retrieval: list the inbox of every reachable postbox, store new
 * messages with their attachments in MinIO, auto-assign them to an Akte and
 * create Akte documents for assigned messages.
 *
 * Never log or audit message contents, subjects or attachments.
 */
import { prisma } from "@/lib/db";
import { uploadFile, getFileStream, generateStorageKey } from "@/lib/storage";
import { ocrQueue } from "@/lib/queue/queues";
import { logAuditEvent } from "@/lib/audit";
import { parseXJustiz, type XJustizData } from "@/lib/xjustiz/parser";
import type { OcrJobData } from "@/lib/ocr/types";
import { autoAssignToAkte } from "./auto-assign";
import { mitBeaSitzung, BeaNichtEingerichtetError } from "./sitzung";
import { BeaExpertError } from "./expert/transport";
import { BeaEntschluesselungError } from "./expert/eingang";
import { fehlversuche, zaehleFehlversuch, MAX_FEHLVERSUCHE } from "./fehlversuche";
import type { BeaNachrichtVoll, BeaOrdnerInfo } from "./provider";

/** Attachment reference stored in BeaNachricht.anhaenge. */
export interface BeaAnhangRef {
  id: string;
  name: string;
  storageKey: string;
  mimeType: string;
  groesse: number;
  art: string | null;
  dokumentId?: string;
}

const XJUSTIZ_DATEI = "xjustiz_nachricht.xml";
const TEXT_MIMES = new Set(["text/plain", "text/csv", "text/html", "text/markdown", "application/json", "application/xml", "text/xml"]);
// Detached signatures carry no readable content.
const OHNE_OCR = new Set(["application/pkcs7-signature"]);

function fehlermeldung(e: unknown): string {
  return e instanceof Error ? e.message : "Unbekannter Fehler";
}

function istP2002(e: unknown): boolean {
  return !!e && typeof e === "object" && "code" in e && (e as { code: unknown }).code === "P2002";
}

// ---------- inbox selection ----------

/**
 * bea.expert folder structure marks the inbox with type "INBOX" (as used by the
 * reference clients); the folder name "Posteingang" is the fallback.
 */
export function waehlePosteingang(ordner: BeaOrdnerInfo[]): BeaOrdnerInfo | null {
  return (
    ordner.find((o) => o.typ.toUpperCase() === "INBOX") ??
    ordner.find((o) => o.name.trim().toLowerCase() === "posteingang") ??
    null
  );
}

// ---------- storage keys ----------

/** Single path segment: no slashes, no control characters, no dot-only names. */
function bereinigeDateiname(name: string): string {
  const basis = name.split(/[/\\]/).pop() ?? "";
  const sauber = basis.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return sauber === "" || /^\.+$/.test(sauber) ? "anhang" : sauber;
}

/** Makes names unique within one message: "a.pdf", "a (2).pdf", ... */
function eindeutigeNamen(namen: string[]): string[] {
  const vergeben = new Set<string>(["nachricht.json"]);
  return namen.map((roh) => {
    const name = bereinigeDateiname(roh);
    if (!vergeben.has(name)) {
      vergeben.add(name);
      return name;
    }
    const punkt = name.lastIndexOf(".");
    const stamm = punkt > 0 ? name.slice(0, punkt) : name;
    const endung = punkt > 0 ? name.slice(punkt) : "";
    let i = 2;
    while (vergeben.has(`${stamm} (${i})${endung}`)) i += 1;
    const neu = `${stamm} (${i})${endung}`;
    vergeben.add(neu);
    return neu;
  });
}

function nachrichtPfad(postfachSafeId: string, messageId: string): string {
  return `bea/${bereinigeDateiname(postfachSafeId)}/${bereinigeDateiname(messageId)}`;
}

// ---------- storing ----------

/**
 * Stores one incoming message: attachments and nachricht.json to MinIO, then the
 * BeaNachricht row. A message already stored (e.g. via another user of the same
 * Kanzleipostfach or a parallel job) yields { neu: false }.
 */
export async function speichereEingang(
  n: BeaNachrichtVoll,
  postfachSafeId: string,
  userId: string,
): Promise<{ id: string; neu: boolean }> {
  const pfad = nachrichtPfad(postfachSafeId, n.messageId);
  const namen = eindeutigeNamen(n.anhaenge.map((a) => a.name));

  const anhaenge: BeaAnhangRef[] = [];
  let xjustizData: XJustizData | null = null;
  for (const [i, a] of n.anhaenge.entries()) {
    const storageKey = `${pfad}/${namen[i]}`;
    await uploadFile(storageKey, a.inhalt, a.mimeType, a.inhalt.length);
    anhaenge.push({
      id: namen[i], name: a.name, storageKey, mimeType: a.mimeType, groesse: a.inhalt.length, art: a.typ,
    });
    if (!xjustizData && a.name.toLowerCase() === XJUSTIZ_DATEI) {
      xjustizData = parseXJustiz(a.inhalt.toString("utf8"));
    }
  }

  const exportPfad = `${pfad}/nachricht.json`;
  const meta = {
    messageId: n.messageId,
    osciMessageId: n.osciMessageId,
    postfachSafeId,
    betreff: n.betreff,
    absender: n.absender,
    empfaenger: n.empfaenger,
    aktenzeichenAbsender: n.aktenzeichenAbsender,
    aktenzeichenJustiz: n.aktenzeichenJustiz,
    empfangenAm: n.empfangenAm?.toISOString() ?? null,
    eebAngefordert: n.eebAngefordert,
    vertraulich: n.vertraulich,
    dringend: n.dringend,
    anhaenge: anhaenge.map(({ name, storageKey, mimeType, groesse, art }) => ({ name, storageKey, mimeType, groesse, art })),
  };
  const json = Buffer.from(JSON.stringify(meta, null, 2), "utf8");
  await uploadFile(exportPfad, json, "application/json", json.length);

  let id: string;
  try {
    const zeile = await prisma.beaNachricht.create({
      data: {
        nachrichtenId: n.messageId,
        betreff: n.betreff,
        absender: n.absender.name,
        empfaenger: n.empfaenger.map((e) => e.name).join(", "),
        inhalt: n.text,
        status: "EINGANG",
        richtung: "EINGANG",
        empfangenAm: n.empfangenAm,
        safeIdAbsender: n.absender.safeId || null,
        safeIdEmpfaenger: postfachSafeId,
        postfachSafeId,
        aktenzeichenAbsender: n.aktenzeichenAbsender,
        aktenzeichenJustiz: n.aktenzeichenJustiz,
        eebAngefordert: n.eebAngefordert,
        eebStatus: n.eebAngefordert ? "AUSSTEHEND" : null,
        anhaenge: anhaenge as unknown as object,
        xjustizData: (xjustizData ?? undefined) as unknown as object | undefined,
        xjustizNachrichtenId: xjustizData?.nachrichtenId ?? null,
        exportPfad,
      },
      select: { id: true },
    });
    id = zeile.id;
  } catch (e) {
    if (!istP2002(e)) throw e;
    const vorhanden = await prisma.beaNachricht.findUnique({
      where: { nachrichtenId: n.messageId },
      select: { id: true },
    });
    return { id: vorhanden?.id ?? "", neu: false };
  }

  const zuordnung = await ordneZu(id, n, userId);

  await logAuditEvent({
    userId,
    akteId: zuordnung,
    aktion: "BEA_NACHRICHT_EMPFANGEN",
    details: {
      nachrichtId: id,
      postfachSafeId,
      anhaengeAnzahl: anhaenge.length,
      automatischZugeordnet: zuordnung !== null,
      ergebnis: "ERFOLG",
    },
  }).catch(() => {});

  return { id, neu: true };
}

/**
 * Auto-assigns only on SICHER confidence. Documents are created before the
 * message is marked ZUGEORDNET, so a failure leaves it unassigned for manual
 * assignment (which creates the documents again, idempotently).
 */
async function ordneZu(id: string, n: BeaNachrichtVoll, userId: string): Promise<string | null> {
  try {
    const r = await autoAssignToAkte({
      betreff: n.betreff,
      absender: n.absender.name,
      inhalt: n.text,
      safeIdAbsender: n.absender.safeId || null,
    });
    if (r.confidence !== "SICHER" || !r.akteId) return null;
    await legeDokumenteAn(id, r.akteId, userId);
    await prisma.beaNachricht.update({ where: { id }, data: { akteId: r.akteId, status: "ZUGEORDNET" } });
    return r.akteId;
  } catch (e) {
    console.warn(`[bea] Automatische Zuordnung fehlgeschlagen (nachrichtId=${id}): ${fehlermeldung(e)}`);
    return null;
  }
}

async function ladeDatei(key: string): Promise<Buffer> {
  const body = await getFileStream(key);
  if (!body) throw new Error("Datei nicht gefunden im Speicher");
  return Buffer.from(await body.transformToByteArray());
}

/**
 * Creates Akte documents for the message's attachments. Attachments that already
 * have a dokumentId are skipped, so repeated calls are safe. The file is copied
 * into the Akte's storage area so deleting the document leaves the beA archive intact.
 * userId: creator of the documents; defaults to the Akte's lawyer or clerk.
 */
export async function legeDokumenteAn(beaNachrichtId: string, akteId: string, userId?: string): Promise<number> {
  const nachricht = await prisma.beaNachricht.findUnique({
    where: { id: beaNachrichtId },
    select: { anhaenge: true },
  });
  if (!nachricht) throw new Error("beA-Nachricht nicht gefunden");
  const anhaenge = (Array.isArray(nachricht.anhaenge) ? nachricht.anhaenge : []) as unknown as BeaAnhangRef[];
  const offen = anhaenge.filter((a) => !a.dokumentId && a.storageKey);
  if (offen.length === 0) return 0;

  let ersteller = userId;
  if (!ersteller) {
    const akte = await prisma.akte.findUnique({
      where: { id: akteId },
      select: { anwaltId: true, sachbearbeiterId: true },
    });
    ersteller = akte?.anwaltId ?? akte?.sachbearbeiterId ?? undefined;
    if (!ersteller) throw new Error("Akte ohne Anwalt oder Sachbearbeiter: Ersteller unbekannt");
  }

  let angelegt = 0;
  for (const a of offen) {
    const inhalt = await ladeDatei(a.storageKey);
    const name = bereinigeDateiname(a.name);
    // generateStorageKey maps non-ASCII to "_" and only adds a ms timestamp:
    // the attachment position keeps keys of one message apart.
    const dateipfad = generateStorageKey(akteId, `${anhaenge.indexOf(a) + 1}_${name}`);
    await uploadFile(dateipfad, inhalt, a.mimeType, inhalt.length);

    const istText = TEXT_MIMES.has(a.mimeType);
    const ocr = !istText && !OHNE_OCR.has(a.mimeType);
    const dokument = await prisma.dokument.create({
      data: {
        akteId,
        name,
        dateipfad,
        mimeType: a.mimeType,
        groesse: inhalt.length,
        ordner: "beA",
        tags: ["beA"],
        // Incoming mail is not a draft
        status: "FREIGEGEBEN",
        erstelltDurch: "system",
        createdById: ersteller,
        ocrStatus: ocr ? "AUSSTEHEND" : "NICHT_NOETIG",
        ocrText: istText ? inhalt.toString("utf8") : null,
        ocrAbgeschlossen: ocr ? null : new Date(),
      },
      select: { id: true },
    });

    // Persist progress after each document so a later failure does not duplicate it.
    a.dokumentId = dokument.id;
    await prisma.beaNachricht.update({
      where: { id: beaNachrichtId },
      data: { anhaenge: anhaenge as unknown as object },
    });
    angelegt += 1;

    if (ocr) {
      const job: OcrJobData = { dokumentId: dokument.id, akteId, storagePath: dateipfad, mimeType: a.mimeType, fileName: name };
      await ocrQueue.add("ocr-document", job).catch((e: unknown) => {
        console.error(`[bea] OCR-Auftrag für Dokument ${dokument.id} nicht eingereiht: ${fehlermeldung(e)}`);
      });
    }
  }
  return angelegt;
}

// ---------- retrieval ----------

/**
 * Classifies a failure while handling one message (ruling R21). Only problems
 * of the message itself count against it: an undecryptable message, a 4xx answer
 * for it, or a mapping error of its content while fetching. Transport outages
 * (status null / 5xx) and every failure of our own stack while storing
 * (MinIO, database) are infrastructure: the run aborts and the job retries.
 */
function istNachrichtenFehler(e: unknown, phase: "holen" | "speichern"): boolean {
  if (phase === "speichern") return false;
  if (e instanceof BeaEntschluesselungError) return true;
  if (e instanceof BeaExpertError) return e.status !== null && e.status < 500;
  return true;
}

/** Message-level failure: count it; on the last allowed attempt report it once. */
async function meldeNachrichtFehler(userId: string, postfachSafeId: string, messageId: string, e: unknown): Promise<void> {
  const anzahl = await zaehleFehlversuch(postfachSafeId, messageId);
  console.warn(`[bea] Nachricht nicht übernommen (postfach=${postfachSafeId}, messageId=${messageId}, versuch=${anzahl}): ${fehlermeldung(e)}`);
  if (anzahl !== MAX_FEHLVERSUCHE) return;
  await logAuditEvent({
    userId,
    aktion: "BEA_NACHRICHT_FEHLER",
    details: { postfachSafeId, messageId, versuche: anzahl, fehler: fehlermeldung(e), ergebnis: "FEHLER" },
  }).catch(() => {});
}

/**
 * Fetches new inbox messages for the user's certificate.
 * - BeaNichtEingerichtetError (no/failed certificate, wrong PIN) ends quietly:
 *   the certificate is already FEHLER or absent, so no further login is attempted.
 * - Outages and infrastructure failures (see istNachrichtenFehler) abort the run
 *   and are returned in fehler[] (job retries with backoff).
 * - A failure of the message itself is counted per messageId and does not fail
 *   the run; after MAX_FEHLVERSUCHE attempts the message is skipped (reported once).
 */
export async function rufeZertifikatAb(userId: string): Promise<{ neu: number; fehler: string[] }> {
  let neu = 0;

  let auftraege: { postfachSafeId: string; messageIds: string[] }[];
  try {
    auftraege = await mitBeaSitzung(userId, async (s, p) => {
      const ergebnis: { postfachSafeId: string; messageIds: string[] }[] = [];
      for (const postfach of await p.listePostfaecher(s)) {
        const eingang = waehlePosteingang(await p.listeOrdner(s, postfach.safeId));
        if (!eingang) {
          console.warn(`[bea] Kein Posteingang im Postfach ${postfach.safeId} gefunden.`);
          continue;
        }
        const ids = [...new Set((await p.listeNachrichten(s, eingang.id)).map((k) => k.messageId).filter(Boolean))];
        ergebnis.push({ postfachSafeId: postfach.safeId, messageIds: ids });
      }
      return ergebnis;
    }, { wiederholen: true });
  } catch (e) {
    if (e instanceof BeaNichtEingerichtetError) return { neu: 0, fehler: [] };
    return { neu: 0, fehler: [fehlermeldung(e)] };
  }

  for (const { postfachSafeId, messageIds } of auftraege) {
    const vorhanden = new Set(
      (await prisma.beaNachricht.findMany({
        where: { nachrichtenId: { in: messageIds } },
        select: { nachrichtenId: true },
      })).map((v) => v.nachrichtenId),
    );

    for (const messageId of messageIds.filter((id) => !vorhanden.has(id))) {
      if ((await fehlversuche(postfachSafeId, messageId)) >= MAX_FEHLVERSUCHE) continue;
      let phase: "holen" | "speichern" = "holen";
      try {
        // Each message has its own retry so one stale session does not fail the rest.
        const n = await mitBeaSitzung(userId, (s, p) => p.holeNachricht(s, messageId), { wiederholen: true });
        phase = "speichern";
        if ((await speichereEingang(n, postfachSafeId, userId)).neu) neu += 1;
      } catch (e) {
        if (e instanceof BeaNichtEingerichtetError) return { neu, fehler: [] };
        if (!istNachrichtenFehler(e, phase)) return { neu, fehler: [`Nachricht ${messageId}: ${fehlermeldung(e)}`] };
        await meldeNachrichtFehler(userId, postfachSafeId, messageId, e);
      }
    }
  }

  await prisma.beaZertifikat.updateMany({ where: { userId }, data: { letzterAbruf: new Date() } });
  return { neu, fehler: [] };
}
