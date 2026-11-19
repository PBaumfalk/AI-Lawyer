/**
 * Akte data the Datenschutz-Schleuse needs: the personal values of all
 * Beteiligte (known values for the egress guard).
 */

import { prisma } from "@/lib/db";

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
    for (const w of [name, k.vorname, k.nachname, k.firma, k.kurzname, k.strasse, k.telefon, k.mobil, k.email, k.iban]) {
      if (w && w.trim().length >= 3) werte.add(w.trim());
    }
    if (k.plz && k.ort) werte.add(`${k.plz} ${k.ort}`);
    if (k.geburtsdatum) werte.add(fmtDatum(k.geburtsdatum));
  }
  // Staff names (lawyer and clerk of the Akte, the user in the prompt) are personal data too.
  const mitarbeiter = await prisma.user.findMany({ select: { name: true } });
  for (const m of mitarbeiter) {
    if (m.name && m.name.trim().length >= 3) {
      werte.add(m.name.trim());
      for (const teil of m.name.trim().split(/\s+/)) if (teil.length >= 3) werte.add(teil);
    }
  }
  return [...werte];
}
