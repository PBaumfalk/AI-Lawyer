/**
 * Shared contract for POST /api/email-send.
 *
 * Imported by the route AND by every compose component, so TypeScript reports
 * any drift between what the UI sends and what the route accepts.
 *
 * Attachments are explicit references, never bare strings:
 *  - "dms":    a document of an Akte (goes through the Versand-Gate and is
 *              marked VERSENDET after the SMTP send succeeded)
 *  - "upload": a file the user uploaded via POST /api/email-send/anhang
 *              (stored under the user's own upload prefix)
 *  - "email":  an attachment of an existing email (forwarding)
 */
import { z } from "zod";

export const emailAnhangRefSchema = z.discriminatedUnion("quelle", [
  z.object({ quelle: z.literal("dms"), dokumentId: z.string().min(1) }),
  z.object({
    quelle: z.literal("upload"),
    speicherPfad: z.string().min(1),
    dateiname: z.string().min(1).max(255),
    mimeType: z.string().min(1),
    groesse: z.number().int().nonnegative(),
  }),
  z.object({ quelle: z.literal("email"), anhangId: z.string().min(1) }),
]);

export type EmailAnhangRef = z.infer<typeof emailAnhangRefSchema>;

export const emailSendSchema = z.object({
  kontoId: z.string().min(1, "Postfach ist erforderlich"),
  empfaenger: z.array(z.string().email()).min(1, "Mindestens ein Empfänger"),
  cc: z.array(z.string().email()).default([]),
  bcc: z.array(z.string().email()).default([]),
  betreff: z.string().min(1, "Betreff ist erforderlich"),
  inhalt: z.string().min(1, "Inhalt ist erforderlich"),
  inhaltText: z.string().optional(),
  akteId: z.string().optional(),
  anhaenge: z.array(emailAnhangRefSchema).max(50).default([]),
  prioritaet: z.enum(["NIEDRIG", "NORMAL", "HOCH"]).default("NORMAL"),
  lesebestaetigung: z.boolean().default(false),
  /** ID of the EmailNachricht this is a reply to (sets In-Reply-To/References). */
  antwortAufId: z.string().optional(),
  geplanterVersand: z.string().datetime().optional(),
});

/** What a client sends (defaults optional). */
export type EmailSendRequest = z.input<typeof emailSendSchema>;
export type EmailSendData = z.output<typeof emailSendSchema>;

export interface EmailSendResponse {
  emailId: string;
  jobId: string;
  delay: number;
  sendeStatus: "GEPLANT" | "WIRD_GESENDET";
}

/** Body of POST /api/email-send/cancel. */
export interface EmailSendCancelRequest {
  emailId: string;
}

/** Response of POST /api/email-send/anhang (multipart upload). */
export interface EmailUploadResponse {
  speicherPfad: string;
  dateiname: string;
  mimeType: string;
  groesse: number;
}

/** Storage prefix for a user's own email uploads. */
export function emailUploadPrefix(userId: string): string {
  return `email-anhaenge/${userId}/`;
}

/** Split a comma/semicolon separated address field into addresses. */
export function splitAdressen(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
