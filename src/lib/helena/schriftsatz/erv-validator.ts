/**
 * Stage 5: ERV-Validator -- Pure validation over SchriftsatzSchema.
 *
 * Produces ErvWarnung[] with inhaltlich (SS 253 ZPO) + formal + frist checks.
 * NEVER hard-blocks draft creation -- warnings only, never throws.
 *
 * Validation categories:
 * 1. Inhaltliche Pruefungen (SS 253 ZPO): Rubrum, Parteien, Antraege
 * 2. Formale Pruefungen: Datum, Unterschrift, PDF/A, Signatur, Dateigroesse
 * 3. Frist-Pruefungen: Rechtsgebiet-specific deadline checks
 * 4. Vollstaendigkeits-Check: Unresolved {{PLATZHALTER}} detection
 */

import type { Schriftsatz, ErvWarnung } from "./schemas";
import type { KlageartDefinition } from "./klageart-registry";
import type { SlotValues } from "./slot-filler";
import { extractUnresolvedPlatzhalter } from "./platzhalter";

// ---------------------------------------------------------------------------
// Severity ordering for sort
// ---------------------------------------------------------------------------

const SCHWERE_ORDER: Record<string, number> = {
  KRITISCH: 0,
  WARNUNG: 1,
  INFO: 2,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a Schriftsatz against ERV/beA requirements.
 *
 * Pure function: no LLM, no DB, no side effects.
 * Returns sorted warnings (KRITISCH first, then WARNUNG, then INFO).
 * NEVER throws -- all errors are captured as KRITISCH warnings.
 *
 * @param schriftsatz - The assembled Schriftsatz to validate
 * @param klageart - The Klageart definition for type-specific checks
 * @param slots - Current slot values for frist calculations
 * @returns Sorted array of ErvWarnung (may be empty if all checks pass)
 */
export function validateErv(
  schriftsatz: Schriftsatz,
  klageart: KlageartDefinition,
  slots: SlotValues,
): ErvWarnung[] {
  const warnungen: ErvWarnung[] = [];

  try {
    // 1. Inhaltliche Pruefungen (SS 253 ZPO)
    validateInhalt(schriftsatz, warnungen);

    // 2. Formale Pruefungen
    validateFormal(schriftsatz, warnungen);

    // 3. Frist-Pruefungen (rechtsgebietsspezifisch)
    validateFristen(klageart, slots, warnungen);

    // 4. Vollstaendigkeits-Check
    validateVollstaendigkeit(schriftsatz, warnungen);
  } catch (error: unknown) {
    // Safety net: never throw, capture as KRITISCH
    const msg =
      error instanceof Error ? error.message : String(error);
    warnungen.push({
      typ: "FORM",
      schwere: "KRITISCH",
      text: `Validierungsfehler: ${msg}`,
    });
  }

  // Sort by severity: KRITISCH first, then WARNUNG, then INFO
  return warnungen.sort(
    (a, b) => (SCHWERE_ORDER[a.schwere] ?? 9) - (SCHWERE_ORDER[b.schwere] ?? 9),
  );
}

// ---------------------------------------------------------------------------
// 1. Inhaltliche Pruefungen (SS 253 ZPO)
// ---------------------------------------------------------------------------

function validateInhalt(
  schriftsatz: Schriftsatz,
  warnungen: ErvWarnung[],
): void {
  const { rubrum, antraege } = schriftsatz;

  // Rubrum completeness
  if (
    !rubrum.gericht ||
    rubrum.gericht.trim() === "" ||
    containsPlatzhalter(rubrum.gericht)
  ) {
    warnungen.push({
      typ: "INHALT",
      schwere: "KRITISCH",
      text: "Gericht fehlt im Rubrum (SS 253 Abs. 2 Nr. 1 ZPO)",
      feld: "rubrum.gericht",
    });
  }

  // Klaeger name
  if (
    !rubrum.klaeger?.name ||
    rubrum.klaeger.name.trim() === "" ||
    containsPlatzhalter(rubrum.klaeger.name)
  ) {
    warnungen.push({
      typ: "INHALT",
      schwere: "KRITISCH",
      text: "Name des Klaegers fehlt im Rubrum (SS 253 Abs. 2 Nr. 1 ZPO)",
      feld: "rubrum.klaeger.name",
    });
  }

  // Beklagter name
  if (
    !rubrum.beklagter?.name ||
    rubrum.beklagter.name.trim() === "" ||
    containsPlatzhalter(rubrum.beklagter.name)
  ) {
    warnungen.push({
      typ: "INHALT",
      schwere: "KRITISCH",
      text: "Name des Beklagten fehlt im Rubrum (SS 253 Abs. 2 Nr. 1 ZPO)",
      feld: "rubrum.beklagter.name",
    });
  }

  // Parteienbezeichnung: warn if address is missing (not KRITISCH)
  if (!rubrum.klaeger?.anschrift) {
    warnungen.push({
      typ: "INHALT",
      schwere: "WARNUNG",
      text: "Anschrift des Klaegers fehlt -- fuer Zustellungen erforderlich",
      feld: "rubrum.klaeger.anschrift",
    });
  }

  if (!rubrum.beklagter?.anschrift) {
    warnungen.push({
      typ: "INHALT",
      schwere: "WARNUNG",
      text: "Anschrift des Beklagten fehlt -- fuer Zustellungen erforderlich",
      feld: "rubrum.beklagter.anschrift",
    });
  }

  // Aktenzeichen: INFO if missing (may be new filing)
  if (!rubrum.aktenzeichen) {
    warnungen.push({
      typ: "INHALT",
      schwere: "INFO",
      text: "Kein Aktenzeichen angegeben (bei Neueinreichung normal)",
      feld: "rubrum.aktenzeichen",
    });
  }

  // Antraege: at least one required
  if (!antraege || antraege.length === 0) {
    warnungen.push({
      typ: "INHALT",
      schwere: "KRITISCH",
      text: "Keine Antraege formuliert (SS 253 Abs. 2 Nr. 2 ZPO erfordert bestimmten Antrag)",
      feld: "antraege",
    });
  }

  // Wegen-Angabe
  if (!rubrum.wegen || rubrum.wegen.trim() === "") {
    warnungen.push({
      typ: "INHALT",
      schwere: "WARNUNG",
      text: "Wegen-Angabe fehlt im Rubrum",
      feld: "rubrum.wegen",
    });
  }
}

// ---------------------------------------------------------------------------
// 2. Formale Pruefungen
// ---------------------------------------------------------------------------

function validateFormal(
  schriftsatz: Schriftsatz,
  warnungen: ErvWarnung[],
): void {
  const { formales } = schriftsatz;

  // Datum
  if (!formales.datum || formales.datum.trim() === "") {
    warnungen.push({
      typ: "FORM",
      schwere: "WARNUNG",
      text: "Datum fehlt im Schriftsatz",
      feld: "formales.datum",
    });
  }

  // Unterschrift
  if (!formales.unterschrift || formales.unterschrift.trim() === "") {
    warnungen.push({
      typ: "FORM",
      schwere: "WARNUNG",
      text: "Unterschrift / Anwaltsbezeichnung fehlt",
      feld: "formales.unterschrift",
    });
  }

  // Static ERV info notices (always added)
  warnungen.push({
    typ: "FORM",
    schwere: "INFO",
    text: "Schriftsatz muss als PDF/A eingereicht werden (SS 2 ERVV)",
  });

  warnungen.push({
    typ: "FORM",
    schwere: "INFO",
    text: "Qualifizierte elektronische Signatur erforderlich (SS 130a ZPO)",
  });

  warnungen.push({
    typ: "FORM",
    schwere: "INFO",
    text: "beA Dateigroesse max. 60 MB",
  });
}

// ---------------------------------------------------------------------------
// 3. Frist-Pruefungen (rechtsgebietsspezifisch)
// ---------------------------------------------------------------------------

function validateFristen(
  klageart: KlageartDefinition,
  slots: SlotValues,
  warnungen: ErvWarnung[],
): void {
  if (!klageart.ervPruefungen) return;

  for (const pruefung of klageart.ervPruefungen) {
    switch (pruefung.check) {
      case "3_WOCHEN_FRIST":
        check3WochenFrist(pruefung, slots, warnungen);
        break;

      case "SCHLICHTUNGSKLAUSEL":
        warnungen.push({
          typ: "FRIST",
          schwere: "INFO",
          text: "Pruefe Schlichtungsklausel: SS 15a EGZPO erfordert ggf. vorgerichtliche Streitschlichtung",
        });
        break;

      case "BETRIEBSRAT_ANHOERUNG":
        checkBetriebsratAnhoerung(pruefung, slots, warnungen);
        break;

      case "GEBUEHRENVORSCHUSS":
        if (klageart.rechtsgebiet === "ARBEITSRECHT") {
          warnungen.push({
            typ: "FRIST",
            schwere: "INFO",
            text: "Kein Gebuehrenvorschuss beim Arbeitsgericht erforderlich",
          });
        }
        break;

      case "FAELLIGKEIT_PRUEFUNG":
        // Lohnklage: check if claim period has started
        checkFaelligkeit(pruefung, slots, warnungen);
        break;

      case "DRINGLICHKEIT":
        warnungen.push({
          typ: "FRIST",
          schwere: "INFO",
          text: "Dringlichkeitsvermutung bei einstweiliger Verfuegung pruefen -- Verfuegungsgrund muss glaubhaft gemacht werden",
        });
        break;

      case "ERWIDERUNGSFRIST":
        checkErwiderungsfrist(pruefung, slots, warnungen);
        break;

      case "BERUFUNGSFRIST":
        checkBerufungsfrist(pruefung, slots, warnungen);
        break;

      case "BERUFUNGSBEGRUENDUNGSFRIST":
        checkBerufungsbegruendungsfrist(pruefung, slots, warnungen);
        break;

      default:
        // Unknown check -- skip silently
        break;
    }
  }

  // Arbeitsrecht: no court fee advance
  if (klageart.rechtsgebiet === "ARBEITSRECHT") {
    warnungen.push({
      typ: "FRIST",
      schwere: "INFO",
      text: "Kein Gebuehrenvorschuss beim Arbeitsgericht erforderlich",
    });
  }
}

// ---------------------------------------------------------------------------
// Frist check implementations
// ---------------------------------------------------------------------------

function check3WochenFrist(
  pruefung: { params: Record<string, string> },
  slots: SlotValues,
  warnungen: ErvWarnung[],
): void {
  const slotKey = pruefung.params.fromSlot || "ZUGANG_DATUM";
  const zugangDatum = slots[slotKey];

  if (!zugangDatum || typeof zugangDatum !== "string") return;
  if (zugangDatum.startsWith("{{")) return; // Unresolved placeholder

  const parsed = parseDateString(zugangDatum);
  if (!parsed) return;

  // Calculate deadline: Zugang + 21 calendar days
  // Use date-only arithmetic (YYYY-MM-DD) to avoid timezone issues
  const fristEnde = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate() + 21,
  );

  const today = new Date();
  const todayDateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const daysRemaining = Math.ceil(
    (fristEnde.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24),
  );

  const fristStr = formatDate(fristEnde);

  if (daysRemaining < 0) {
    warnungen.push({
      typ: "FRIST",
      schwere: "KRITISCH",
      text: `3-Wochen-Frist nach SS 4 KSchG ist am ${fristStr} abgelaufen! Nachtraegliche Zulassung nach SS 5 KSchG pruefen.`,
      feld: slotKey,
    });
  } else if (daysRemaining < 7) {
    warnungen.push({
      typ: "FRIST",
      schwere: "WARNUNG",
      text: `3-Wochen-Frist nach SS 4 KSchG endet am ${fristStr} (noch ${daysRemaining} Tag(e)). Eilbeduerftigkeit beachten!`,
      feld: slotKey,
    });
  }
}

function checkBetriebsratAnhoerung(
  pruefung: { params: Record<string, string> },
  slots: SlotValues,
  warnungen: ErvWarnung[],
): void {
  const slotKey = pruefung.params.slot || "BETRIEBSRAT_ANHOERUNG";
  const value = slots[slotKey];

  if (!value || (typeof value === "string" && value.trim() === "")) {
    warnungen.push({
      typ: "INHALT",
      schwere: "WARNUNG",
      text: "Betriebsrat-Anhoerung (SS 102 BetrVG) nicht angegeben -- wenn Betriebsrat vorhanden, ist fehlende Anhoerung Unwirksamkeitsgrund",
      feld: slotKey,
    });
  }
}

function checkFaelligkeit(
  pruefung: { params: Record<string, string> },
  slots: SlotValues,
  warnungen: ErvWarnung[],
): void {
  const slotKey = pruefung.params.fromSlot || "ZEITRAUM_VON";
  const value = slots[slotKey];

  if (!value || typeof value !== "string") return;
  if (value.startsWith("{{")) return;

  const parsed = parseDateString(value);
  if (!parsed) return;

  const today = new Date();
  if (parsed > today) {
    warnungen.push({
      typ: "FRIST",
      schwere: "WARNUNG",
      text: `Lohnanspruch ab ${formatDate(parsed)} ist noch nicht faellig -- Klage ggf. verfrueht`,
      feld: slotKey,
    });
  }
}

function checkErwiderungsfrist(
  pruefung: { params: Record<string, string> },
  slots: SlotValues,
  warnungen: ErvWarnung[],
): void {
  const slotKey = pruefung.params.fromSlot || "ERWIDERUNGSFRIST";
  const value = slots[slotKey];

  if (!value || typeof value !== "string") return;
  if (value.startsWith("{{")) return;

  const parsed = parseDateString(value);
  if (!parsed) return;

  const today = new Date();
  const todayDateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const daysRemaining = Math.ceil(
    (parsed.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysRemaining < 0) {
    warnungen.push({
      typ: "FRIST",
      schwere: "KRITISCH",
      text: `Erwiderungsfrist am ${formatDate(parsed)} abgelaufen! Fristverlängerung beantragen.`,
      feld: slotKey,
    });
  } else if (daysRemaining < 7) {
    warnungen.push({
      typ: "FRIST",
      schwere: "WARNUNG",
      text: `Erwiderungsfrist endet am ${formatDate(parsed)} (noch ${daysRemaining} Tag(e)).`,
      feld: slotKey,
    });
  }
}

function checkBerufungsfrist(
  pruefung: { params: Record<string, string> },
  slots: SlotValues,
  warnungen: ErvWarnung[],
): void {
  const slotKey = pruefung.params.fromSlot || "URTEIL_ZUSTELLUNG";
  const value = slots[slotKey];

  if (!value || typeof value !== "string") return;
  if (value.startsWith("{{")) return;

  const parsed = parseDateString(value);
  if (!parsed) return;

  // Berufungsfrist: 1 Monat nach Zustellung (SS 517 ZPO)
  const fristEnde = new Date(
    parsed.getFullYear(),
    parsed.getMonth() + 1,
    parsed.getDate(),
  );

  const today = new Date();
  const todayDateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const daysRemaining = Math.ceil(
    (fristEnde.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysRemaining < 0) {
    warnungen.push({
      typ: "FRIST",
      schwere: "KRITISCH",
      text: `Berufungsfrist (1 Monat, SS 517 ZPO) am ${formatDate(fristEnde)} abgelaufen!`,
      feld: slotKey,
    });
  } else if (daysRemaining < 7) {
    warnungen.push({
      typ: "FRIST",
      schwere: "WARNUNG",
      text: `Berufungsfrist (SS 517 ZPO) endet am ${formatDate(fristEnde)} (noch ${daysRemaining} Tag(e)).`,
      feld: slotKey,
    });
  }
}

function checkBerufungsbegruendungsfrist(
  pruefung: { params: Record<string, string> },
  slots: SlotValues,
  warnungen: ErvWarnung[],
): void {
  const slotKey = pruefung.params.fromSlot || "URTEIL_ZUSTELLUNG";
  const value = slots[slotKey];

  if (!value || typeof value !== "string") return;
  if (value.startsWith("{{")) return;

  const parsed = parseDateString(value);
  if (!parsed) return;

  // Berufungsbegruendungsfrist: 2 Monate nach Zustellung (SS 520 ZPO)
  const fristEnde = new Date(
    parsed.getFullYear(),
    parsed.getMonth() + 2,
    parsed.getDate(),
  );

  const today = new Date();
  const todayDateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const daysRemaining = Math.ceil(
    (fristEnde.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysRemaining < 0) {
    warnungen.push({
      typ: "FRIST",
      schwere: "KRITISCH",
      text: `Berufungsbegruendungsfrist (2 Monate, SS 520 ZPO) am ${formatDate(fristEnde)} abgelaufen!`,
      feld: slotKey,
    });
  } else if (daysRemaining < 14) {
    warnungen.push({
      typ: "FRIST",
      schwere: "WARNUNG",
      text: `Berufungsbegruendungsfrist (SS 520 ZPO) endet am ${formatDate(fristEnde)} (noch ${daysRemaining} Tag(e)).`,
      feld: slotKey,
    });
  }
}

// ---------------------------------------------------------------------------
// 4. Vollstaendigkeits-Check
// ---------------------------------------------------------------------------

function validateVollstaendigkeit(
  schriftsatz: Schriftsatz,
  warnungen: ErvWarnung[],
): void {
  const unresolved = extractUnresolvedPlatzhalter(schriftsatz);

  if (unresolved.length > 0) {
    warnungen.push({
      typ: "INHALT",
      schwere: "WARNUNG",
      text: `${unresolved.length} unaufgeloeste Platzhalter: ${unresolved.map((p) => `{{${p}}}`).join(", ")}`,
      feld: "platzhalter",
    });
  }
}

// ---------------------------------------------------------------------------
// Date helpers (date-only, no timezone issues)
// ---------------------------------------------------------------------------

/**
 * Parse a date string in DD.MM.YYYY or YYYY-MM-DD format.
 * Returns a Date set to midnight local time, or null if unparseable.
 */
function parseDateString(dateStr: string): Date | null {
  // DD.MM.YYYY
  const deMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (deMatch) {
    return new Date(
      parseInt(deMatch[3]),
      parseInt(deMatch[2]) - 1,
      parseInt(deMatch[1]),
    );
  }

  // YYYY-MM-DD
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(
      parseInt(isoMatch[1]),
      parseInt(isoMatch[2]) - 1,
      parseInt(isoMatch[3]),
    );
  }

  return null;
}

/**
 * Format a Date as DD.MM.YYYY (German convention).
 */
function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// ---------------------------------------------------------------------------
// Placeholder detection helper
// ---------------------------------------------------------------------------

/**
 * Check if a string contains any {{...}} placeholder.
 */
function containsPlatzhalter(str: string): boolean {
  return /\{\{[A-Z_]+\}\}/.test(str);
}
