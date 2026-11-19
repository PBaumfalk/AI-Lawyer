/**
 * Name für die Begrüßung „Willkommen, …" im Dashboard.
 *
 * Der Benutzername ist ein einzelnes Freitextfeld („Dr. Max Mustermann",
 * „Prof. Dr. Erika Muster", „RAin Anna Beispiel"). Akademische Grade,
 * Berufsbezeichnungen und Anreden am Anfang werden übersprungen; begrüßt
 * wird mit dem ersten verbleibenden Wort (Vorname).
 */
const TITEL = new Set([
  "dr", "prof", "professor", "pd", "mag", "ll.m", "llm",
  "ra", "rain", "rechtsanwalt", "rechtsanwältin", "notar", "notarin",
  "herr", "frau", "hr", "fr", "med", "jur", "rer", "nat", "pol", "phil", "h.c", "mult",
]);

function istTitel(wort: string): boolean {
  const w = wort.toLowerCase().replace(/[.,]+$/, "");
  // auch zusammengesetzte Grade wie "Dr.-Ing.", "Dipl.-Jur.", "Priv.-Doz."
  return TITEL.has(w) || /^(dr|dipl|priv)\.-/.test(w);
}

export function begruessungsName(name: string | null | undefined): string {
  const woerter = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (woerter.length === 0) return "";
  // Erstes Wort, das kein Titel ist; besteht der Name nur aus "Titeln", das letzte Wort
  return woerter.find((w) => !istTitel(w)) ?? woerter[woerter.length - 1];
}
