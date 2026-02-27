/**
 * Data-driven registry of Klageart (filing type) definitions.
 *
 * Each Klageart defines:
 * - Required and optional slots ({{UPPER_SNAKE_CASE}} placeholders)
 * - Section configurations with RAG query templates
 * - Streitwert calculation rules
 * - ERV-specific validation checks
 *
 * The registry is the single source of truth for what information
 * is needed per filing type and how sections should be assembled.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Definition of a single slot (placeholder field) */
export interface SlotDefinition {
  /** UPPER_SNAKE_CASE key, e.g. "KLAEGER_NAME" */
  key: string;
  /** Human-readable German label, e.g. "Name des Klaegers" */
  label: string;
  /** Value type for input validation */
  type: "text" | "date" | "currency" | "number" | "boolean";
  /** Whether this slot must be filled for a complete Schriftsatz */
  required: boolean;
  /** Optional hint for pre-fill source: "mandant", "gegner", "akte", "gericht" */
  prefillFrom?: string;
}

/** Configuration for a Schriftsatz section */
export interface SectionConfig {
  /** Section identifier, e.g. "rubrum", "sachverhalt" */
  id: string;
  /** German display label */
  label: string;
  /** Which RAG sources to query for this section */
  ragSources: Array<"gesetz" | "urteil" | "muster">;
  /** RAG query template with {{SLOT}} placeholders */
  ragQuery: string;
  /** Whether to generate content via LLM (false = assemble from slots only) */
  generateViaLlm: boolean;
}

/** Rule for automatic Streitwert calculation */
export interface StreitwertRegel {
  /** Calculation type */
  typ: "VIERTELJAHRESGEHALT" | "FESTBETRAG" | "SUMME" | "MANUELL";
  /** Multiplier for salary-based calculations (e.g. 3 for KSchG) */
  faktor?: number;
  /** Fixed amount for FESTBETRAG type */
  festbetrag?: number;
}

/** ERV/beA validation check definition */
export interface ErvPruefung {
  /** Check identifier */
  id: string;
  /** Check type (matched by the ERV-Validator) */
  check: string;
  /** Parameters for the check (e.g. slot references) */
  params: Record<string, string>;
}

/** Complete definition of a Klageart (filing type) */
export interface KlageartDefinition {
  /** Unique identifier, e.g. "kschg_klage" */
  id: string;
  /** German display label, e.g. "Kuendigungsschutzklage" */
  label: string;
  /** Primary Rechtsgebiet (matches Prisma Sachgebiet or string) */
  rechtsgebiet: string;
  /** Supported procedural stages */
  stadien: string[];
  /** Slots that MUST be filled for a complete Schriftsatz */
  requiredSlots: SlotDefinition[];
  /** Slots that improve quality but can remain empty */
  optionalSlots: SlotDefinition[];
  /** Section assembly configurations */
  sections: SectionConfig[];
  /** Rule for automatic Streitwert calculation */
  streitwertRegel: StreitwertRegel;
  /** ERV-specific validation checks */
  ervPruefungen: ErvPruefung[];
}

// ---------------------------------------------------------------------------
// Shared slot definitions (reused across Klagearten)
// ---------------------------------------------------------------------------

const SLOT_KLAEGER_NAME: SlotDefinition = {
  key: "KLAEGER_NAME",
  label: "Name des Klaegers",
  type: "text",
  required: true,
  prefillFrom: "mandant",
};

const SLOT_KLAEGER_ADRESSE: SlotDefinition = {
  key: "KLAEGER_ADRESSE",
  label: "Anschrift des Klaegers",
  type: "text",
  required: true,
  prefillFrom: "mandant",
};

const SLOT_BEKLAGTER_NAME: SlotDefinition = {
  key: "BEKLAGTER_NAME",
  label: "Name des Beklagten",
  type: "text",
  required: true,
  prefillFrom: "gegner",
};

const SLOT_BEKLAGTER_ADRESSE: SlotDefinition = {
  key: "BEKLAGTER_ADRESSE",
  label: "Anschrift des Beklagten",
  type: "text",
  required: true,
  prefillFrom: "gegner",
};

const SLOT_GERICHT: SlotDefinition = {
  key: "GERICHT",
  label: "Zustaendiges Gericht",
  type: "text",
  required: true,
  prefillFrom: "gericht",
};

const SLOT_AKTENZEICHEN: SlotDefinition = {
  key: "AKTENZEICHEN",
  label: "Aktenzeichen",
  type: "text",
  required: false,
};

// ---------------------------------------------------------------------------
// Shared section configurations
// ---------------------------------------------------------------------------

const STANDARD_SECTIONS: SectionConfig[] = [
  {
    id: "rubrum",
    label: "Rubrum",
    ragSources: [],
    ragQuery: "",
    generateViaLlm: false, // Assembled from slots
  },
  {
    id: "antraege",
    label: "Antraege",
    ragSources: ["muster"],
    ragQuery: "{{KLAGEART}} Antraege Muster",
    generateViaLlm: true,
  },
  {
    id: "sachverhalt",
    label: "Sachverhalt",
    ragSources: [],
    ragQuery: "",
    generateViaLlm: true,
  },
  {
    id: "rechtliche_wuerdigung",
    label: "Rechtliche Wuerdigung",
    ragSources: ["gesetz", "urteil", "muster"],
    ragQuery: "{{KLAGEART}} {{RECHTSGEBIET}} Anspruchsgrundlage Rechtsprechung",
    generateViaLlm: true,
  },
  {
    id: "beweisangebote",
    label: "Beweisangebote",
    ragSources: [],
    ragQuery: "",
    generateViaLlm: false, // Auto-generated from Akte Dokumente
  },
  {
    id: "anlagen",
    label: "Anlagenverzeichnis",
    ragSources: [],
    ragQuery: "",
    generateViaLlm: false, // Auto-generated from Dokumente
  },
  {
    id: "kosten",
    label: "Kosten",
    ragSources: [],
    ragQuery: "",
    generateViaLlm: false, // Calculated from Streitwert
  },
  {
    id: "formales",
    label: "Formales",
    ragSources: [],
    ragQuery: "",
    generateViaLlm: false, // Static fields
  },
];

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Registry of all supported Klagearten (filing types).
 *
 * Goldstandard entries (kschg_klage, lohnklage) are fully detailed.
 * Other entries have specific slot definitions for their filing type.
 * The "generic" entry serves as fallback for unknown types.
 */
export const KLAGEART_REGISTRY: Record<string, KlageartDefinition> = {
  // =========================================================================
  // GOLDSTANDARD: Kuendigungsschutzklage (KSchG)
  // =========================================================================
  kschg_klage: {
    id: "kschg_klage",
    label: "Kuendigungsschutzklage",
    rechtsgebiet: "ARBEITSRECHT",
    stadien: ["ERSTINSTANZ", "BERUFUNG"],
    requiredSlots: [
      SLOT_KLAEGER_NAME,
      SLOT_KLAEGER_ADRESSE,
      SLOT_BEKLAGTER_NAME,
      SLOT_BEKLAGTER_ADRESSE,
      SLOT_GERICHT,
      {
        key: "KUENDIGUNGSDATUM",
        label: "Datum der Kuendigung",
        type: "date",
        required: true,
      },
      {
        key: "ZUGANG_DATUM",
        label: "Zugang der Kuendigung (wann erhalten?)",
        type: "date",
        required: true,
      },
      {
        key: "EINTRITTSDATUM",
        label: "Eintrittsdatum beim Arbeitgeber",
        type: "date",
        required: true,
      },
      {
        key: "BRUTTOGEHALT",
        label: "Monatliches Bruttogehalt",
        type: "currency",
        required: true,
      },
      {
        key: "BERUFSBEZEICHNUNG",
        label: "Berufsbezeichnung / Taetigkeit",
        type: "text",
        required: true,
      },
      {
        key: "KUENDIGUNGSART",
        label: "Art der Kuendigung (ordentlich/ausserordentlich/fristlos)",
        type: "text",
        required: true,
      },
    ],
    optionalSlots: [
      SLOT_AKTENZEICHEN,
      {
        key: "KUENDIGUNGSGRUND",
        label: "Vom Arbeitgeber genannter Kuendigungsgrund",
        type: "text",
        required: false,
      },
      {
        key: "BETRIEBSRAT_ANHOERUNG",
        label: "Wurde der Betriebsrat angehoert? (ja/nein/kein Betriebsrat)",
        type: "text",
        required: false,
      },
      {
        key: "BETRIEBSGROESSE",
        label: "Anzahl der Mitarbeiter im Betrieb",
        type: "number",
        required: false,
      },
      {
        key: "SONDERKUENDIGUNGSSCHUTZ",
        label: "Besonderer Kuendigungsschutz (Schwangerschaft, Schwerbehinderung, Betriebsrat, etc.)",
        type: "text",
        required: false,
      },
      {
        key: "WEITERBESCHAEFTIGUNG",
        label: "Wird Weiterbeschaeftigung beantragt?",
        type: "boolean",
        required: false,
      },
    ],
    sections: [
      ...STANDARD_SECTIONS.map((s) =>
        s.id === "rechtliche_wuerdigung"
          ? {
              ...s,
              ragSources: ["gesetz", "urteil", "muster"] as Array<
                "gesetz" | "urteil" | "muster"
              >,
              ragQuery:
                "Kuendigungsschutzklage KSchG SS 1 SS 4 Kuendigungsschutzgesetz Sozialwidrigkeit Kuendigung",
            }
          : s.id === "antraege"
            ? {
                ...s,
                ragQuery:
                  "Kuendigungsschutzklage Feststellungsantrag Weiterbeschaeftigungsantrag SS 4 KSchG Muster",
              }
            : s
      ),
    ],
    streitwertRegel: {
      typ: "VIERTELJAHRESGEHALT",
      faktor: 3, // 3x Bruttomonatsgehalt
    },
    ervPruefungen: [
      {
        id: "kschg_3_wochen_frist",
        check: "3_WOCHEN_FRIST",
        params: { fromSlot: "ZUGANG_DATUM" },
      },
      {
        id: "betriebsrat_anhoerung",
        check: "BETRIEBSRAT_ANHOERUNG",
        params: { slot: "BETRIEBSRAT_ANHOERUNG" },
      },
    ],
  },

  // =========================================================================
  // GOLDSTANDARD: Lohn-/Gehaltsklage
  // =========================================================================
  lohnklage: {
    id: "lohnklage",
    label: "Lohn-/Gehaltsklage",
    rechtsgebiet: "ARBEITSRECHT",
    stadien: ["ERSTINSTANZ", "BERUFUNG"],
    requiredSlots: [
      SLOT_KLAEGER_NAME,
      SLOT_KLAEGER_ADRESSE,
      SLOT_BEKLAGTER_NAME,
      SLOT_BEKLAGTER_ADRESSE,
      SLOT_GERICHT,
      {
        key: "ZEITRAUM_VON",
        label: "Ausstehender Lohn ab (Monat/Jahr)",
        type: "date",
        required: true,
      },
      {
        key: "ZEITRAUM_BIS",
        label: "Ausstehender Lohn bis (Monat/Jahr)",
        type: "date",
        required: true,
      },
      {
        key: "MONATSBETRAG",
        label: "Monatliches Bruttogehalt",
        type: "currency",
        required: true,
      },
      {
        key: "ZAHLUNGSGRUND",
        label: "Rechtsgrund des Anspruchs (Arbeitsvertrag, Tarifvertrag, etc.)",
        type: "text",
        required: true,
      },
    ],
    optionalSlots: [
      SLOT_AKTENZEICHEN,
      {
        key: "AUSSTEHENDE_SUMME",
        label: "Gesamter ausstehender Betrag (brutto)",
        type: "currency",
        required: false,
      },
      {
        key: "VERZUGSZINSEN",
        label: "Verzugszinsen ab wann?",
        type: "date",
        required: false,
      },
      {
        key: "ABRECHNUNG_VERLANGT",
        label: "Wird auch Abrechnung verlangt?",
        type: "boolean",
        required: false,
      },
      {
        key: "MAHNUNG_DATUM",
        label: "Datum der letzten Mahnung",
        type: "date",
        required: false,
      },
    ],
    sections: [
      ...STANDARD_SECTIONS.map((s) =>
        s.id === "rechtliche_wuerdigung"
          ? {
              ...s,
              ragSources: ["gesetz", "urteil", "muster"] as Array<
                "gesetz" | "urteil" | "muster"
              >,
              ragQuery:
                "Lohnklage Gehaltsklage SS 611a BGB Verguetungsanspruch Arbeitsentgelt Verzug SS 288 BGB",
            }
          : s.id === "antraege"
            ? {
                ...s,
                ragQuery:
                  "Lohnklage Zahlungsantrag Abrechnungsantrag Verzugszinsen Muster",
              }
            : s
      ),
    ],
    streitwertRegel: {
      typ: "SUMME",
      // Streitwert = ausstehende Summe (calculated from MONATSBETRAG * Monate)
    },
    ervPruefungen: [
      {
        id: "lohn_faelligkeit",
        check: "FAELLIGKEIT_PRUEFUNG",
        params: { fromSlot: "ZEITRAUM_VON" },
      },
    ],
  },

  // =========================================================================
  // Einstweilige Verfuegung / Einstweiliger Rechtsschutz
  // =========================================================================
  ev_antrag: {
    id: "ev_antrag",
    label: "Antrag auf einstweilige Verfuegung",
    rechtsgebiet: "SONSTIGES",
    stadien: ["EV"],
    requiredSlots: [
      {
        key: "ANTRAGSTELLER_NAME",
        label: "Name des Antragstellers",
        type: "text",
        required: true,
        prefillFrom: "mandant",
      },
      {
        key: "ANTRAGSTELLER_ADRESSE",
        label: "Anschrift des Antragstellers",
        type: "text",
        required: true,
        prefillFrom: "mandant",
      },
      {
        key: "ANTRAGSGEGNER_NAME",
        label: "Name des Antragsgegners",
        type: "text",
        required: true,
        prefillFrom: "gegner",
      },
      {
        key: "ANTRAGSGEGNER_ADRESSE",
        label: "Anschrift des Antragsgegners",
        type: "text",
        required: true,
        prefillFrom: "gegner",
      },
      SLOT_GERICHT,
      {
        key: "VERFUEGUNGSANSPRUCH",
        label: "Verfuegungsanspruch (welches Recht wird verletzt?)",
        type: "text",
        required: true,
      },
      {
        key: "VERFUEGUNGSGRUND",
        label: "Verfuegungsgrund (warum ist Eilbeduerftigkeit gegeben?)",
        type: "text",
        required: true,
      },
    ],
    optionalSlots: [
      SLOT_AKTENZEICHEN,
      {
        key: "GLAUBHAFTMACHUNG",
        label: "Mittel der Glaubhaftmachung",
        type: "text",
        required: false,
      },
      {
        key: "SCHUTZSCHRIFT",
        label: "Wurde eine Schutzschrift hinterlegt?",
        type: "boolean",
        required: false,
      },
    ],
    sections: [
      ...STANDARD_SECTIONS.map((s) =>
        s.id === "rechtliche_wuerdigung"
          ? {
              ...s,
              ragSources: ["gesetz", "urteil", "muster"] as Array<
                "gesetz" | "urteil" | "muster"
              >,
              ragQuery:
                "Einstweilige Verfuegung SS 935 SS 940 ZPO Verfuegungsanspruch Verfuegungsgrund Glaubhaftmachung",
            }
          : s.id === "antraege"
            ? {
                ...s,
                ragQuery:
                  "Einstweilige Verfuegung Antrag Eilantrag Muster SS 935 ZPO",
              }
            : s
      ),
    ],
    streitwertRegel: {
      typ: "MANUELL",
    },
    ervPruefungen: [
      {
        id: "ev_dringlichkeit",
        check: "DRINGLICHKEIT",
        params: {},
      },
    ],
  },

  // =========================================================================
  // Klageerwiderung (generic)
  // =========================================================================
  klageerwiderung: {
    id: "klageerwiderung",
    label: "Klageerwiderung",
    rechtsgebiet: "SONSTIGES",
    stadien: ["ERSTINSTANZ", "BERUFUNG"],
    requiredSlots: [
      SLOT_BEKLAGTER_NAME,
      SLOT_BEKLAGTER_ADRESSE,
      SLOT_KLAEGER_NAME,
      SLOT_KLAEGER_ADRESSE,
      SLOT_GERICHT,
      {
        key: "AZ",
        label: "Aktenzeichen des Gerichts",
        type: "text",
        required: true,
        prefillFrom: "akte",
      },
      {
        key: "KLAGE_DATUM",
        label: "Datum der Klageschrift",
        type: "date",
        required: true,
      },
    ],
    optionalSlots: [
      {
        key: "KLAGE_ZUSAMMENFASSUNG",
        label: "Zusammenfassung der Klage",
        type: "text",
        required: false,
      },
      {
        key: "ERWIDERUNGSFRIST",
        label: "Frist fuer die Klageerwiderung",
        type: "date",
        required: false,
      },
    ],
    sections: [
      ...STANDARD_SECTIONS.map((s) =>
        s.id === "rechtliche_wuerdigung"
          ? {
              ...s,
              ragSources: ["gesetz", "urteil", "muster"] as Array<
                "gesetz" | "urteil" | "muster"
              >,
              ragQuery:
                "Klageerwiderung Verteidigung {{RECHTSGEBIET}} Einwendungen Einreden",
            }
          : s.id === "antraege"
            ? {
                ...s,
                ragQuery: "Klageerwiderung Klageabweisungsantrag Muster",
              }
            : s
      ),
    ],
    streitwertRegel: {
      typ: "MANUELL",
      // Streitwert from the original Klageschrift
    },
    ervPruefungen: [
      {
        id: "erwiderungsfrist",
        check: "ERWIDERUNGSFRIST",
        params: { fromSlot: "ERWIDERUNGSFRIST" },
      },
    ],
  },

  // =========================================================================
  // Berufung (generic)
  // =========================================================================
  berufung: {
    id: "berufung",
    label: "Berufungsschrift",
    rechtsgebiet: "SONSTIGES",
    stadien: ["BERUFUNG"],
    requiredSlots: [
      {
        key: "BERUFUNGSKLAEGER",
        label: "Name des Berufungsklaegers",
        type: "text",
        required: true,
        prefillFrom: "mandant",
      },
      {
        key: "BERUFUNGSKLAEGER_ADRESSE",
        label: "Anschrift des Berufungsklaegers",
        type: "text",
        required: true,
        prefillFrom: "mandant",
      },
      {
        key: "BERUFUNGSBEKLAGTER",
        label: "Name des Berufungsbeklagten",
        type: "text",
        required: true,
        prefillFrom: "gegner",
      },
      {
        key: "BERUFUNGSBEKLAGTER_ADRESSE",
        label: "Anschrift des Berufungsbeklagten",
        type: "text",
        required: true,
        prefillFrom: "gegner",
      },
      SLOT_GERICHT,
      {
        key: "URTEIL_DATUM",
        label: "Datum des angefochtenen Urteils",
        type: "date",
        required: true,
      },
      {
        key: "URTEIL_AZ",
        label: "Aktenzeichen des angefochtenen Urteils",
        type: "text",
        required: true,
      },
      {
        key: "BERUFUNGSGRUENDE",
        label: "Wesentliche Berufungsgruende",
        type: "text",
        required: true,
      },
    ],
    optionalSlots: [
      {
        key: "URTEIL_ZUSTELLUNG",
        label: "Datum der Urteilszustellung",
        type: "date",
        required: false,
      },
      {
        key: "BERUFUNGSFRIST_ENDE",
        label: "Ende der Berufungsfrist",
        type: "date",
        required: false,
      },
    ],
    sections: [
      ...STANDARD_SECTIONS.map((s) =>
        s.id === "rechtliche_wuerdigung"
          ? {
              ...s,
              ragSources: ["gesetz", "urteil", "muster"] as Array<
                "gesetz" | "urteil" | "muster"
              >,
              ragQuery:
                "Berufung {{RECHTSGEBIET}} SS 511 SS 513 SS 520 ZPO Berufungsbegruendung Rechtsfehler",
            }
          : s.id === "antraege"
            ? {
                ...s,
                ragQuery:
                  "Berufungsantrag Abgaenderungsantrag Aufhebungsantrag Muster SS 520 ZPO",
              }
            : s
      ),
    ],
    streitwertRegel: {
      typ: "MANUELL",
      // Streitwert typically from first instance
    },
    ervPruefungen: [
      {
        id: "berufungsfrist",
        check: "BERUFUNGSFRIST",
        params: { fromSlot: "URTEIL_ZUSTELLUNG" },
      },
      {
        id: "berufungsbegruendungsfrist",
        check: "BERUFUNGSBEGRUENDUNGSFRIST",
        params: { fromSlot: "URTEIL_ZUSTELLUNG" },
      },
    ],
  },

  // =========================================================================
  // Abmahnung (aussergerichtlich)
  // =========================================================================
  abmahnung: {
    id: "abmahnung",
    label: "Abmahnung",
    rechtsgebiet: "SONSTIGES",
    stadien: ["AUSSERGERICHTLICH"],
    requiredSlots: [
      {
        key: "ABSENDER",
        label: "Name des Absenders",
        type: "text",
        required: true,
        prefillFrom: "mandant",
      },
      {
        key: "ABSENDER_ADRESSE",
        label: "Anschrift des Absenders",
        type: "text",
        required: true,
        prefillFrom: "mandant",
      },
      {
        key: "EMPFAENGER",
        label: "Name des Empfaengers",
        type: "text",
        required: true,
        prefillFrom: "gegner",
      },
      {
        key: "EMPFAENGER_ADRESSE",
        label: "Anschrift des Empfaengers",
        type: "text",
        required: true,
        prefillFrom: "gegner",
      },
      {
        key: "VERSTOSS",
        label: "Beschreibung des Verstosses / Abmahngrundes",
        type: "text",
        required: true,
      },
      {
        key: "FRIST",
        label: "Frist zur Unterlassung / Abhilfe",
        type: "date",
        required: true,
      },
    ],
    optionalSlots: [
      {
        key: "RECHTSGRUNDLAGE",
        label: "Rechtsgrundlage der Abmahnung",
        type: "text",
        required: false,
      },
      {
        key: "SCHADENSERSATZ",
        label: "Schadensersatzforderung",
        type: "currency",
        required: false,
      },
      {
        key: "STRAFBEWEHRTE_UNTERLASSUNG",
        label: "Strafbewehrte Unterlassungserklaerung beigefuegt?",
        type: "boolean",
        required: false,
      },
    ],
    sections: [
      {
        id: "rubrum",
        label: "Absender/Empfaenger",
        ragSources: [],
        ragQuery: "",
        generateViaLlm: false,
      },
      {
        id: "sachverhalt",
        label: "Sachverhalt",
        ragSources: [],
        ragQuery: "",
        generateViaLlm: true,
      },
      {
        id: "rechtliche_wuerdigung",
        label: "Rechtliche Begruendung",
        ragSources: ["gesetz", "urteil"],
        ragQuery:
          "Abmahnung {{RECHTSGEBIET}} Unterlassungsanspruch Beseitigungsanspruch",
        generateViaLlm: true,
      },
      {
        id: "forderung",
        label: "Aufforderung / Fristsetzung",
        ragSources: ["muster"],
        ragQuery: "Abmahnung Fristsetzung Unterlassungserklaerung Muster",
        generateViaLlm: true,
      },
      {
        id: "formales",
        label: "Formales",
        ragSources: [],
        ragQuery: "",
        generateViaLlm: false,
      },
    ],
    streitwertRegel: {
      typ: "MANUELL",
    },
    ervPruefungen: [],
  },

  // =========================================================================
  // Generic fallback (any Klageart not in registry)
  // =========================================================================
  generic: {
    id: "generic",
    label: "Allgemeiner Schriftsatz",
    rechtsgebiet: "SONSTIGES",
    stadien: [
      "ERSTINSTANZ",
      "BERUFUNG",
      "REVISION",
      "BESCHWERDE",
      "EV",
      "AUSSERGERICHTLICH",
    ],
    requiredSlots: [
      {
        key: "PARTEI_A_NAME",
        label: "Name der ersten Partei",
        type: "text",
        required: true,
        prefillFrom: "mandant",
      },
      {
        key: "PARTEI_A_ADRESSE",
        label: "Anschrift der ersten Partei",
        type: "text",
        required: true,
        prefillFrom: "mandant",
      },
      {
        key: "PARTEI_B_NAME",
        label: "Name der zweiten Partei",
        type: "text",
        required: true,
        prefillFrom: "gegner",
      },
      {
        key: "PARTEI_B_ADRESSE",
        label: "Anschrift der zweiten Partei",
        type: "text",
        required: true,
        prefillFrom: "gegner",
      },
      {
        key: "BETREFF",
        label: "Betreff / Gegenstand",
        type: "text",
        required: true,
      },
    ],
    optionalSlots: [
      SLOT_GERICHT,
      SLOT_AKTENZEICHEN,
      {
        key: "STREITWERT",
        label: "Streitwert",
        type: "currency",
        required: false,
        prefillFrom: "akte",
      },
    ],
    sections: STANDARD_SECTIONS,
    streitwertRegel: {
      typ: "MANUELL",
    },
    ervPruefungen: [],
  },
};

// ---------------------------------------------------------------------------
// Accessor
// ---------------------------------------------------------------------------

/**
 * Get the KlageartDefinition for a given klageart ID.
 * Falls back to "generic" if the ID is not in the registry.
 */
export function getKlageartDefinition(id: string): KlageartDefinition {
  return KLAGEART_REGISTRY[id] ?? KLAGEART_REGISTRY["generic"];
}
