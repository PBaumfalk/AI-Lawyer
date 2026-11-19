/**
 * Contract for outgoing beA messages between the UI and the server routes
 * POST /api/bea/messages (send or save draft, server-side via the beA provider)
 * and POST /api/bea/messages/versand-pruefung (pre-flight check, sends nothing).
 *
 * Client-safe: zod and types only, no server imports.
 */
import { z } from "zod";
import type { ZeichenVerstoss } from "./regeln";

export const BEA_NACHRICHTEN_TYPEN = ["ALLGEMEINE_NACHRICHT", "MAHN_ANTRAG", "TESTNACHRICHT"] as const;

const anhangSchema = z.object({
  dokumentId: z.string().trim().min(1),
  art: z.enum(["SCHRIFTSATZ", "ATTACHMENT"]),
});

const eindeutigeDokumente = (anhaenge: { dokumentId: string }[]) =>
  new Set(anhaenge.map((a) => a.dokumentId)).size === anhaenge.length;
const DOPPELT = { message: "Ein Dokument ist mehrfach angehängt", path: ["anhaenge"] };

export const beaVersandSchema = z
  .object({
    akteId: z.string().min(1).optional(),
    postfachSafeId: z.string().trim().min(1, "Absender-Postfach fehlt"),
    empfaengerSafeIds: z.array(z.string().trim().min(1)).min(1, "Mindestens ein Empfänger ist erforderlich"),
    betreff: z.string().min(1, "Betreff fehlt"),
    text: z.string(),
    aktenzeichenAbsender: z.string().optional(),
    aktenzeichenEmpfaenger: z.string().optional(),
    nachrichtenTyp: z.enum(BEA_NACHRICHTEN_TYPEN),
    eebAnfordern: z.boolean(),
    dringend: z.boolean(),
    anhaenge: z.array(anhangSchema),
    alsEntwurf: z.boolean(),
  })
  .refine((d) => eindeutigeDokumente(d.anhaenge), DOPPELT);

export type BeaVersandRequest = z.infer<typeof beaVersandSchema>;

/**
 * Pre-flight body: same fields as the send, but lenient so that a missing
 * subject or recipient is reported by pruefeVersand instead of a 400.
 */
export const beaVersandPruefungSchema = z
  .object({
    akteId: z.string().min(1).optional(),
    postfachSafeId: z.string().optional(),
    empfaengerSafeIds: z.array(z.string()).default([]),
    betreff: z.string().default(""),
    text: z.string().default(""),
    aktenzeichenAbsender: z.string().optional(),
    aktenzeichenEmpfaenger: z.string().optional(),
    nachrichtenTyp: z.enum(BEA_NACHRICHTEN_TYPEN).optional(),
    eebAnfordern: z.boolean().default(false),
    dringend: z.boolean().optional(),
    anhaenge: z.array(anhangSchema).max(5000).default([]),
    alsEntwurf: z.boolean().optional(),
  })
  .refine((d) => eindeutigeDokumente(d.anhaenge), DOPPELT);

export type BeaVersandPruefungRequest = z.input<typeof beaVersandPruefungSchema>;

/** Document that failed access or the Versand-Gate. */
export interface BeaDokumentFehler {
  dokumentId: string;
  name: string;
  status: string;
  reason: string;
}

/** Response of versand-pruefung; POST /api/bea/messages answers 422 with fehler/warnungen/verstoesse. */
export interface BeaVersandPruefungResponse {
  ok: boolean;
  fehler: string[];
  warnungen: string[];
  verstoesse: ZeichenVerstoss[];
  /** Documents rejected by access check or Versand-Gate (HTTP 400). */
  errors: BeaDokumentFehler[];
}

/** Hint stored on a message whose send outcome is unknown. */
export const VERSANDSTATUS_UNKLAR = "Versandstatus unklar – bitte im beA-Webclient prüfen";
