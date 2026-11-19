// Gemeinsamer Vertrag zwischen Benutzerverwaltung (Oberfläche) und API.
import { z } from "zod";

export const MIN_PASSWORT_LAENGE = 12;

/** Rollen für Kanzleikonten. MANDANT-Konten entstehen nur über die Portal-Einladung. */
export const KANZLEI_ROLLEN = ["ADMIN", "ANWALT", "SACHBEARBEITER", "SEKRETARIAT"] as const;
export type KanzleiRolle = (typeof KANZLEI_ROLLEN)[number];

export const ROLLEN_LABEL: Record<KanzleiRolle, string> = {
  ADMIN: "Administrator",
  ANWALT: "Anwalt/Anwältin",
  SACHBEARBEITER: "Sachbearbeitung",
  SEKRETARIAT: "Sekretariat",
};

export const passwortSchema = z
  .string()
  .min(MIN_PASSWORT_LAENGE, `Mindestens ${MIN_PASSWORT_LAENGE} Zeichen`)
  .max(200, "Höchstens 200 Zeichen");

export const benutzerAnlegenSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ungültige E-Mail-Adresse"),
  name: z.string().trim().min(2, "Name fehlt").max(120),
  role: z.enum(KANZLEI_ROLLEN),
  position: z.string().trim().max(120).optional().nullable(),
  /** Leer: Server erzeugt ein Startpasswort und gibt es einmalig zurück. */
  passwort: passwortSchema.optional(),
});
export type BenutzerAnlegen = z.infer<typeof benutzerAnlegenSchema>;

export const benutzerAendernSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    role: z.enum(KANZLEI_ROLLEN),
    position: z.string().trim().max(120).nullable(),
    aktiv: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Keine Änderung angegeben");
export type BenutzerAendern = z.infer<typeof benutzerAendernSchema>;

export const passwortZuruecksetzenSchema = z.object({
  /** Zwei-Faktor-Anmeldung ebenfalls zurücksetzen (Gerät verloren). */
  totpZuruecksetzen: z.boolean().optional(),
});

export const eigenesPasswortSchema = z
  .object({
    aktuell: z.string().min(1, "Aktuelles Passwort fehlt"),
    neu: passwortSchema,
  })
  .refine((v) => v.aktuell !== v.neu, { message: "Das neue Passwort muss sich unterscheiden", path: ["neu"] });

export interface BenutzerZeile {
  id: string;
  email: string;
  name: string;
  role: KanzleiRolle;
  position: string | null;
  aktiv: boolean;
  totpEnabled: boolean;
  createdAt: string;
}

/** Antwort auf Anlegen/Zurücksetzen: Startpasswort nur in dieser einen Antwort. */
export interface StartpasswortAntwort {
  benutzer: BenutzerZeile;
  startpasswort?: string;
}
