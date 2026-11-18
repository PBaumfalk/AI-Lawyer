/**
 * Contract between beA UI (bea-compose, eeb-button) and the server routes
 * POST /api/bea/messages and POST /api/bea/messages/[id]/eeb.
 *
 * The actual transmission happens in the browser through the bea.expert
 * library (src/lib/bea/client.ts). The server can only record what the
 * browser reports, so the rules are enforced on both sides:
 *  - a message is recorded as GESENDET only with the beA message ID that
 *    bea.expert returned for the send;
 *  - an eEB is recorded as BESTAETIGT only after bea.expert confirmed it,
 *    referencing the stored beA message ID.
 * If the library is missing or the call fails, nothing is recorded.
 */
import { z } from "zod";

/** Minimal shape of a bea.expert call result (see BeaResult in client.ts). */
export interface BeaErgebnis<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export const beaNachrichtSchema = z
  .object({
    nachrichtenId: z.string().trim().min(1).optional(),
    betreff: z.string().min(1, "Betreff ist erforderlich"),
    absender: z.string().min(1, "Absender ist erforderlich"),
    empfaenger: z.string().min(1, "Empfaenger ist erforderlich"),
    inhalt: z.string().optional(),
    status: z.enum(["EINGANG", "GELESEN", "ZUGEORDNET", "GESENDET", "FEHLER"]).default("EINGANG"),
    safeIdAbsender: z.string().optional(),
    safeIdEmpfaenger: z.string().optional(),
    pruefprotokoll: z.any().optional(),
    anhaenge: z.any().optional(),
    dokumentIds: z.array(z.string()).optional(), // DMS document IDs for Versand-Gate check
    akteId: z.string().optional(),
    empfangenAm: z.string().optional(),
    gesendetAm: z.string().optional(),
    eebErforderlich: z.boolean().optional(),
    xjustizXml: z.string().optional(),
  })
  .refine((d) => d.status !== "GESENDET" || !!d.nachrichtenId, {
    message: "Gesendete Nachrichten brauchen die beA-Nachrichten-ID aus dem Versand",
    path: ["nachrichtenId"],
  });

export type BeaNachrichtRequest = z.input<typeof beaNachrichtSchema>;

/** Form data of bea-compose. */
export interface BeaVersandFormular {
  betreff: string;
  inhalt: string;
  absender: string;
  safeIdAbsender: string;
  empfaenger: string;
  safeIdEmpfaenger: string;
  dokumentIds: string[];
  anhaenge: { name: string; mimeType: string; dokumentId: string }[];
  akteId?: string | null;
}

/**
 * Build the record for a sent message. Throws unless bea.expert reported a
 * successful send with a message ID — a failed or unconfirmed send is never
 * stored as GESENDET.
 */
export function buildGesendetNachricht(
  ergebnis: BeaErgebnis<{ nachrichtenId: string }>,
  form: BeaVersandFormular,
  jetzt: Date = new Date()
): BeaNachrichtRequest {
  const id = ergebnis.data?.nachrichtenId?.trim();
  if (!ergebnis.ok || !id) {
    throw new Error(
      ergebnis.error ||
        "beA-Versand nicht bestaetigt (keine Nachrichten-ID). Die Nachricht wurde nicht als gesendet gespeichert."
    );
  }
  return {
    nachrichtenId: id,
    betreff: form.betreff,
    absender: form.absender,
    empfaenger: form.empfaenger,
    inhalt: form.inhalt,
    status: "GESENDET",
    safeIdAbsender: form.safeIdAbsender,
    safeIdEmpfaenger: form.safeIdEmpfaenger,
    gesendetAm: jetzt.toISOString(),
    dokumentIds: form.dokumentIds,
    anhaenge: form.anhaenge,
    akteId: form.akteId ?? undefined,
  };
}

export const eebBestaetigungSchema = z.object({
  /** beA message ID the eEB was sent for (must match the stored message). */
  nachrichtenId: z.string().trim().min(1),
  /** Date stated in the eEB as sent to bea.expert. */
  eebDatum: z.string().datetime(),
});

export type EebBestaetigung = z.infer<typeof eebBestaetigungSchema>;

/** Build the eEB record; throws unless bea.expert confirmed the eEB. */
export function buildEebBestaetigung(
  ergebnis: BeaErgebnis<{ success: boolean }>,
  nachrichtenId: string,
  eebDatum: Date
): EebBestaetigung {
  if (!ergebnis.ok || !ergebnis.data?.success) {
    throw new Error(
      ergebnis.error || "eEB wurde von beA nicht bestaetigt und daher nicht gespeichert."
    );
  }
  return { nachrichtenId, eebDatum: eebDatum.toISOString() };
}

/** Body/response of POST /api/bea/messages/versand-pruefung (pre-flight). */
export interface BeaVersandPruefungRequest {
  dokumentIds: string[];
}
export interface BeaVersandPruefungResponse {
  ok: boolean;
  errors: { dokumentId: string; name: string; status: string; reason: string }[];
}
