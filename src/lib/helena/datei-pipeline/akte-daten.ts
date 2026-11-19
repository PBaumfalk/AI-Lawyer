/**
 * Akte data the Datenschutz-Schleuse needs: Mandant consent and the personal
 * values of all Beteiligte (known values for the egress guard).
 */

import { prisma } from "@/lib/db";
import type { Einwilligung } from "./modelle";

/** Reads the consent of an Akte; no Akte means no consent. */
export async function einwilligungDerAkte(akteId: string | null): Promise<Einwilligung> {
  if (!akteId) return "KEINE";
  const a = await prisma.akte.findUnique({ where: { id: akteId }, select: { kiEinwilligung: true } });
  return (a?.kiEinwilligung as Einwilligung | undefined) ?? "KEINE";
}

function fmtDatum(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/** Personal values of all Beteiligte of an Akte: known values for the egress guard. */
export async function bekannteWerteDerAkte(akteId: string): Promise<string[]> {
  const beteiligte = await prisma.beteiligter.findMany({
    where: { akteId },
    select: {
      kontakt: {
        select: {
          vorname: true, nachname: true, firma: true, kurzname: true, strasse: true, plz: true, ort: true,
          telefon: true, mobil: true, email: true, iban: true, geburtsdatum: true,
        },
      },
    },
  });
  const werte = new Set<string>();
  for (const { kontakt: k } of beteiligte) {
    const name = [k.vorname, k.nachname].filter(Boolean).join(" ");
    for (const w of [name, k.nachname, k.firma, k.kurzname, k.strasse, k.telefon, k.mobil, k.email, k.iban]) {
      if (w && w.trim().length >= 3) werte.add(w.trim());
    }
    if (k.plz && k.ort) werte.add(`${k.plz} ${k.ort}`);
    if (k.geburtsdatum) werte.add(fmtDatum(k.geburtsdatum));
  }
  return [...werte];
}
