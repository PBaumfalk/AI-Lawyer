// Invoice System - TypeScript Types
// Types for invoice creation, status management, and PDF generation

import type { RechnungStatus } from '@prisma/client';

/** A single invoice line item (SS 14 UStG compliant) */
export interface InvoicePosition {
  /** VV number (for RVG invoices) */
  vvNr?: string;
  /** Description of the line item */
  beschreibung: string;
  /** Quantity */
  menge: number;
  /** Unit price (net) */
  einzelpreis: number;
  /** VAT rate (e.g., 19, 7, 0) */
  ustSatz: number;
  /** Total for this line item (menge * einzelpreis) */
  betrag: number;
}

/** Per-rate USt breakdown for the invoice */
export interface UstSummary {
  /** Tax rate (e.g., 19, 7) */
  satz: number;
  /** Net amount at this rate (Bemessungsgrundlage) */
  bemessungsgrundlage: number;
  /** Tax amount at this rate */
  betrag: number;
}

/** Status transition definition */
export interface StatusTransition {
  from: RechnungStatus;
  to: RechnungStatus;
  validatedBy?: string;
}

/** Kanzlei data for invoice header/footer */
export interface InvoiceKanzleiData {
  name: string;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  telefon?: string | null;
  fax?: string | null;
  email?: string | null;
  website?: string | null;
  steuernr?: string | null;
  ustIdNr?: string | null;
  bankName?: string | null;
  iban?: string | null;
  bic?: string | null;
  logo?: string | null;
}

/** Contact/recipient data */
export interface InvoiceRecipientData {
  name: string;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  land?: string | null;
}

/** Full invoice data for PDF generation */
export interface InvoiceData {
  /** Invoice number (e.g., "RE-2025-0001") */
  rechnungsnummer: string;
  /** Invoice date */
  rechnungsdatum: Date;
  /** Due date */
  faelligAm?: Date | null;
  /** Payment terms in days */
  zahlungszielTage: number;
  /** Case reference (Aktenzeichen) */
  aktenzeichen?: string | null;
  /** Mandant name */
  mandantName?: string | null;
  /** Kanzlei/firm data for letterhead */
  kanzlei: InvoiceKanzleiData;
  /** Recipient data */
  empfaenger: InvoiceRecipientData;
  /** Line items */
  positionen: InvoicePosition[];
  /** Net total */
  betragNetto: number;
  /** Per-rate USt breakdown */
  ustSummary: UstSummary[];
  /** Gross total */
  betragBrutto: number;
  /** Additional notes */
  notizen?: string | null;
  /** Whether this is a PKH invoice */
  isPkh?: boolean;
  /** Whether this is a Stornorechnung */
  isStorno?: boolean;
  /** Original invoice number (for Storno) */
  stornoVon?: string | null;
}

/** Result of a status transition attempt */
export interface TransitionResult {
  success: boolean;
  error?: string;
  sideEffects?: {
    stornoRechnungId?: string;
    mahnungId?: string;
  };
}
