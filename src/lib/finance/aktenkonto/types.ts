// Aktenkonto Types
// Types for case account bookings, Fremdgeld compliance, and balance tracking

import type { BuchungsTyp, KontoTyp } from '@prisma/client';

/** Input for creating a new Aktenkonto booking */
export interface BookingInput {
  /** Case ID */
  akteId: string;
  /** Type of booking */
  buchungstyp: BuchungsTyp;
  /** Amount (always positive, sign determined by buchungstyp) */
  betrag: number;
  /** Purpose / description */
  verwendungszweck: string;
  /** Booking date (defaults to now) */
  buchungsdatum?: Date;
  /** Link to invoice */
  rechnungId?: string;
  /** Link to bank transaction */
  bankTransaktionId?: string;
  /** Link to document (Beleg) */
  dokumentId?: string;
  /** Cost center */
  kostenstelle?: string;
  /** Account type (Geschaeft or Anderkonto) */
  konto?: KontoTyp;
  /** User creating the booking */
  gebuchtVon: string;
}

/** Input for creating a Storno (reversal) booking */
export interface StornoInput {
  /** ID of the original booking to reverse */
  originalId: string;
  /** Reason for the reversal */
  grund: string;
  /** User performing the reversal */
  userId: string;
}

/** Balance breakdown for a case account */
export interface SaldoResult {
  /** Total balance across all booking types */
  gesamtSaldo: number;
  /** Total income */
  einnahmen: number;
  /** Total expenses */
  ausgaben: number;
  /** Total Fremdgeld (third-party funds) */
  fremdgeld: number;
  /** Total disbursements */
  auslagen: number;
  /** Open receivables (invoiced but not yet paid) */
  offeneForderungen: number;
}

/** Alert for a Fremdgeld booking approaching its forwarding deadline */
export interface FremdgeldAlert {
  /** Booking ID */
  buchungId: string;
  /** Case ID */
  akteId: string;
  /** Amount of the Fremdgeld booking */
  betrag: number;
  /** Date the Fremdgeld was received */
  eingangsDatum: Date;
  /** Deadline for forwarding (5 business days) */
  frist: Date;
  /** Remaining business days until deadline */
  verbleibendeTage: number;
  /** Urgency level */
  dringlichkeit: 'normal' | 'warnung' | 'kritisch' | 'ueberfaellig';
}

/** Alert when total Fremdgeld approaches the 15k Anderkonto threshold */
export interface AnderkontoAlert {
  /** Case ID */
  akteId: string;
  /** Current total Fremdgeld amount */
  totalFremdgeld: number;
  /** Threshold amount (15000 EUR) */
  schwelle: number;
  /** Whether the threshold is exceeded */
  ueberschritten: boolean;
}

/** Fremdgeld compliance check result */
export interface FremdgeldComplianceResult {
  /** Active Fremdgeld alerts */
  alerts: FremdgeldAlert[];
  /** Anderkonto threshold alert (if applicable) */
  anderkontoAlert?: AnderkontoAlert;
}

/** Anderkonto threshold constant */
export const ANDERKONTO_SCHWELLE = 15000;

/** Default Bundesland for holiday calculation */
export const DEFAULT_BUNDESLAND = 'NW';
