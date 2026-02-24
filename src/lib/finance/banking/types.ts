// Banking Types
// Types for bank statement import, transaction parsing, and invoice matching

/** A normalized bank transaction from any bank format */
export interface BankTransaction {
  /** Booking date */
  buchungsdatum: Date;
  /** Value date (optional) */
  wertstellung?: Date;
  /** Amount (positive = credit, negative = debit) */
  betrag: number;
  /** Purpose / Verwendungszweck */
  verwendungszweck: string;
  /** Sender or recipient name */
  absenderEmpfaenger?: string;
  /** Account balance after transaction */
  saldo?: number;
  /** IBAN of counterparty */
  iban?: string;
}

/** Bank CSV format definition for auto-detection */
export interface BankFormat {
  /** Format name (e.g., "Sparkasse", "VR-Bank") */
  name: string;
  /** Column name or index for the booking date */
  dateColumn: string;
  /** Column name or index for the amount */
  amountColumn: string;
  /** Column name or index for the purpose */
  purposeColumn: string;
  /** Column name or index for sender/recipient */
  senderRecipientColumn: string;
  /** CSV delimiter */
  delimiter: string;
  /** Date format string (e.g., "DD.MM.YYYY", "YYYY-MM-DD") */
  dateFormat: string;
  /** Optional: column for value date */
  valueDateColumn?: string;
  /** Optional: column for balance */
  balanceColumn?: string;
  /** Optional: column for IBAN */
  ibanColumn?: string;
}

/** Result of matching a bank transaction to invoices */
export interface MatchResult {
  /** Bank transaction ID (from DB) */
  transaktionId: string;
  /** Transaction details for display */
  transaktion: {
    buchungsdatum: Date;
    betrag: number;
    verwendungszweck: string;
    absenderEmpfaenger?: string | null;
  };
  /** Suggested invoice matches sorted by confidence */
  matches: MatchSuggestion[];
}

/** A single match suggestion for a bank transaction */
export interface MatchSuggestion {
  /** Invoice ID */
  rechnungId: string;
  /** Invoice number */
  rechnungsnummer: string;
  /** Invoice gross amount */
  rechnungBetrag: number;
  /** Match confidence (0.0 - 1.0) */
  confidence: number;
  /** Reasons for the match score */
  matchReasons: string[];
}

/** Predefined bank formats for German banks */
export const BANK_FORMATS: Record<string, BankFormat> = {
  sparkasse: {
    name: 'Sparkasse',
    dateColumn: 'Buchungstag',
    amountColumn: 'Betrag',
    purposeColumn: 'Verwendungszweck',
    senderRecipientColumn: 'Beguenstigter/Zahlungspflichtiger',
    delimiter: ';',
    dateFormat: 'DD.MM.YY',
    valueDateColumn: 'Wertstellung',
    balanceColumn: 'Saldo nach Buchung',
    ibanColumn: 'Kontonummer/IBAN',
  },
  vrbank: {
    name: 'VR-Bank',
    dateColumn: 'Buchungstag',
    amountColumn: 'Umsatz',
    purposeColumn: 'Vorgang/Verwendungszweck',
    senderRecipientColumn: 'Empfaenger/Zahlungspflichtiger',
    delimiter: ';',
    dateFormat: 'DD.MM.YYYY',
    valueDateColumn: 'Wertstellung',
    ibanColumn: 'IBAN',
  },
  deutschebank: {
    name: 'Deutsche Bank',
    dateColumn: 'Buchungstag',
    amountColumn: 'Betrag (EUR)',
    purposeColumn: 'Verwendungszweck',
    senderRecipientColumn: 'Auftraggeber / Beguenstigter',
    delimiter: ';',
    dateFormat: 'DD.MM.YYYY',
    valueDateColumn: 'Wert',
    balanceColumn: 'Saldo (EUR)',
  },
  commerzbank: {
    name: 'Commerzbank',
    dateColumn: 'Buchungstag',
    amountColumn: 'Betrag',
    purposeColumn: 'Buchungstext',
    senderRecipientColumn: 'Auftraggeber / Beguenstigter',
    delimiter: ';',
    dateFormat: 'DD.MM.YYYY',
    valueDateColumn: 'Wertstellung',
  },
  generic: {
    name: 'Generisch',
    dateColumn: 'Datum',
    amountColumn: 'Betrag',
    purposeColumn: 'Verwendungszweck',
    senderRecipientColumn: 'Name',
    delimiter: ';',
    dateFormat: 'DD.MM.YYYY',
  },
};
