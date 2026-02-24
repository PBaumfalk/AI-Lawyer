// RVG Fee Calculator - TypeScript Types
// Domain types for German legal fee calculation (RVG/GKG)

/** A single step in the RVG Anlage 2 fee table */
export interface FeeTableStep {
  /** Upper bound of Streitwert for this step (inclusive) */
  upTo: number;
  /** Base fee at this step boundary */
  baseFee: number;
  /** Fee increment per step within this range */
  increment: number;
  /** Size of each step within this range */
  stepSize: number;
}

/** Version metadata for a fee table */
export interface FeeTableVersion {
  /** Identifier (e.g., "RVG_2025") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Law reference (e.g., "KostBRaeG 2025") */
  lawReference: string;
  /** Start of validity period */
  validFrom: Date;
  /** End of validity period (null = currently valid) */
  validUntil: Date | null;
  /** The step algorithm data */
  steps: FeeTableStep[];
  /** Initial base fee (for Streitwert up to first step) */
  initialFee: number;
}

/** Fee type classification */
export type FeeType =
  | 'wertgebuehr'       // Value-based fee (rate * base fee)
  | 'betragsrahmen'     // Range-based fee (min-max)
  | 'festgebuehr'       // Fixed fee amount
  | 'auslagen';         // Expenses (percentage or fixed)

/** A position in the VV (Verguetungsverzeichnis) catalog */
export interface VVPosition {
  /** VV number (e.g., "3100", "7002") */
  nr: string;
  /** German name */
  name: string;
  /** Fee type classification */
  feeType: FeeType;
  /** Default rate (e.g., 1.3 for Verfahrensgebuehr) */
  defaultRate: number;
  /** Minimum allowed rate (null if no range) */
  minRate: number | null;
  /** Maximum allowed rate (null if no range) */
  maxRate: number | null;
  /** VV part (1-7) */
  part: number;
  /** Category within part */
  category: string;
  /** Whether this position triggers Anrechnung */
  triggersAnrechnung: boolean;
  /** VV number that Anrechnung applies against */
  anrechnungTarget: string | null;
  /** Whether this position can be auto-added (e.g., Auslagen, USt) */
  isAutoAddable: boolean;
  /** Description / notes */
  description?: string;
}

/** Options when adding a position to the calculator */
export interface PositionOptions {
  /** Override the default rate */
  rate?: number;
  /** Override the Gegenstandswert for this position */
  gegenstandswert?: number;
  /** Number of Auftraggeber (for Erhoehungsgebuehr 1008) */
  anzahlAuftraggeber?: number;
  /** Kilometers (for Fahrtkosten 7003) */
  km?: number;
  /** Days of absence (for Abwesenheitsgeld 7005) */
  tage?: number;
  /** Fixed amount override (for Festgebuehr/Auslagen) */
  betrag?: number;
  /** Disable Anrechnung for this position */
  disableAnrechnung?: boolean;
}

/** Anrechnung calculation result */
export interface AnrechnungResult {
  /** Source position (e.g., "2300" Geschaeftsgebuehr) */
  sourceNr: string;
  /** Target position (e.g., "3100" Verfahrensgebuehr) */
  targetNr: string;
  /** Original source rate (e.g., 1.3) */
  sourceRate: number;
  /** Halved rate (e.g., 0.65) */
  halvedRate: number;
  /** Capped rate (min of halved, 0.75) */
  cappedRate: number;
  /** Credit amount in EUR */
  creditAmount: number;
  /** Description of the Anrechnung */
  description: string;
}

/** A single calculated line item */
export interface CalculationItem {
  /** VV position number */
  vvNr: string;
  /** VV position name */
  name: string;
  /** Fee type */
  feeType: FeeType;
  /** Applied rate (null for fixed/auslagen) */
  rate: number | null;
  /** Base fee from table (null for fixed/auslagen) */
  baseFee: number | null;
  /** Gegenstandswert used */
  gegenstandswert: number;
  /** Calculated amount before Anrechnung */
  amount: number;
  /** Anrechnung deduction (negative, 0 if none) */
  anrechnungDeduction: number;
  /** Final amount after Anrechnung */
  finalAmount: number;
  /** Additional notes */
  notes?: string;
}

/** Complete calculation result */
export interface CalculationResult {
  /** All line items */
  items: CalculationItem[];
  /** Anrechnung details (if applied) */
  anrechnung: AnrechnungResult | null;
  /** Primary Streitwert */
  streitwert: number;
  /** Date of Auftragseingang (determines fee table version) */
  auftragseingang: Date;
  /** Fee table version used */
  feeTableVersion: string;
  /** Subtotal before USt */
  nettoGesamt: number;
  /** USt amount (19%) */
  ustBetrag: number;
  /** Total including USt */
  bruttoGesamt: number;
  /** Auto-generated description lines */
  notices: string[];
}

/** GKG (Gerichtskostengesetz) fee table entry */
export interface GkgTableEntry {
  /** Upper bound of Streitwert */
  upTo: number;
  /** Fee per Gebuehr unit */
  fee: number;
}

/** GKG fee table version */
export interface GkgTableVersion {
  id: string;
  name: string;
  lawReference: string;
  validFrom: Date;
  validUntil: Date | null;
  entries: GkgTableEntry[];
  /** Formula parameters for values above the table maximum */
  aboveMaxFormula: {
    /** Base fee at max table value */
    baseFee: number;
    /** Increment per step above max */
    increment: number;
    /** Step size above max */
    stepSize: number;
  };
}

/** PKH (Prozesskostenhilfe) reduced fee table entry */
export interface PkhTableEntry {
  /** Upper bound of Streitwert */
  upTo: number;
  /** Reduced fee */
  fee: number;
}

/** PKH fee table version */
export interface PkhTableVersion {
  id: string;
  name: string;
  lawReference: string;
  validFrom: Date;
  validUntil: Date | null;
  /** Cap: above this Streitwert, use full RVG table */
  cap: number;
  entries: PkhTableEntry[];
}

/** A preset configuration for common case types */
export interface CalculatorPreset {
  /** Unique identifier */
  id: string;
  /** German display name */
  name: string;
  /** Description */
  description: string;
  /** VV positions to add */
  vvPositions: { nr: string; options?: PositionOptions }[];
}

/** Streitwert suggestion for common case types */
export interface StreitwertVorschlag {
  /** Unique identifier */
  id: string;
  /** Case type name (German) */
  name: string;
  /** Formula description */
  formel: string;
  /** Example value */
  beispiel: number;
  /** Multiplier (e.g., 3 for Kuendigungsschutz = 3 * Monatsgehalt) */
  multiplier?: number;
  /** Base unit description */
  basisEinheit?: string;
}
