// DATEV + SEPA Export Types
// Types for DATEV Buchungsstapel CSV and SEPA pain.001/pain.008 XML generation

/** DATEV EXTF_ file header metadata */
export interface DatevHeader {
  /** Format version (always 700) */
  formatVersion: 700;
  /** Data category (21 = Buchungsstapel) */
  dataCategory: 21;
  /** Format name (always "Buchungsstapel") */
  formatName: 'Buchungsstapel';
  /** Format version of the booking data (13) */
  formatVersionData: 13;
  /** Generated timestamp */
  created: Date;
  /** Beraternummer (tax advisor number) */
  beraternummer: number;
  /** Mandantennummer (client number) */
  mandantennummer: number;
  /** Start of the fiscal year */
  wirtschaftsjahrBeginn: Date;
  /** Kontenlange (account number length, 4-8) */
  kontenlaenge: number;
  /** Start of the booking period */
  periodeStart: Date;
  /** End of the booking period */
  periodeEnd: Date;
}

/** A single DATEV booking row */
export interface DatevBooking {
  /** Amount in EUR (always positive, direction from debitCredit) */
  amount: string;
  /** S = Soll (debit), H = Haben (credit) */
  debitCredit: 'S' | 'H';
  /** Currency (default "EUR") */
  currency: string;
  /** Account number (Konto) */
  account: string;
  /** Contra account (Gegenkonto) */
  contraAccount: string;
  /** BU-Schluessel for tax handling (optional) */
  buKey?: string;
  /** Booking date in DDMM format */
  date: string;
  /** Reference field 1 (Belegfeld 1, max 36 chars) */
  reference1?: string;
  /** Reference field 2 (Belegfeld 2, max 12 chars) */
  reference2?: string;
  /** Booking text (max 60 chars) */
  text: string;
  /** Cost center 1 (Kostenstelle 1) */
  costCenter1?: string;
}

/** Options for DATEV export generation */
export interface DatevExportOptions {
  /** Start of the export period */
  periodeStart: Date;
  /** End of the export period */
  periodeEnd: Date;
  /** Kanzlei ID for loading settings */
  kanzleiId: string;
  /** Kontenrahmen: SKR03 or SKR04 */
  kontenrahmen: 'SKR03' | 'SKR04';
  /** Tax advisor number (default 1001) */
  beraternummer?: number;
  /** Client number (default 1) */
  mandantennummer?: number;
}

/** SEPA payment (credit transfer) data */
export interface SepaPayment {
  /** Creditor (recipient) name */
  creditorName: string;
  /** Creditor IBAN */
  creditorIban: string;
  /** Creditor BIC (optional) */
  creditorBic?: string;
  /** Amount in EUR */
  amount: number;
  /** Payment reference / end-to-end ID */
  reference: string;
  /** Purpose / remittance info */
  purpose: string;
}

/** SEPA debtor (payer) info for credit transfers */
export interface SepaDebtor {
  /** Debtor name */
  name: string;
  /** Debtor IBAN */
  iban: string;
  /** Debtor BIC */
  bic: string;
}

/** SEPA creditor info for direct debits */
export interface SepaCreditor {
  /** Creditor name */
  name: string;
  /** Creditor IBAN */
  iban: string;
  /** Creditor BIC */
  bic: string;
  /** Creditor ID (Glaeubiger-ID) */
  creditorId: string;
}

/** SEPA direct debit mandate data */
export interface SepaMandate {
  /** Mandate ID */
  mandateId: string;
  /** Creditor ID (Glaeubiger-Identifikationsnummer) */
  creditorId: string;
  /** Debtor (payer) name */
  debtorName: string;
  /** Debtor IBAN */
  debtorIban: string;
  /** Debtor BIC (optional) */
  debtorBic?: string;
  /** Mandate signature date */
  signatureDate: Date;
  /** Amount to collect */
  amount: number;
  /** Payment reference */
  reference: string;
  /** Purpose / remittance info */
  purpose: string;
}

/** SKR03/SKR04 account mapping for common booking categories */
export interface KontenrahmenMapping {
  /** Mandantengelder (client funds) */
  mandantengelder: string;
  /** Fremdgeld (third-party funds) */
  fremdgeld: string;
  /** Honorar (fees / revenue) */
  honorar: string;
  /** Auslagen (disbursements) */
  auslagen: string;
  /** Bank account */
  bank: string;
  /** Cash */
  kasse: string;
}

/** Default SKR03 account mapping */
export const SKR03_MAPPING: KontenrahmenMapping = {
  mandantengelder: '1590',
  fremdgeld: '1599',
  honorar: '8400',
  auslagen: '4900',
  bank: '1200',
  kasse: '1000',
};

/** Default SKR04 account mapping */
export const SKR04_MAPPING: KontenrahmenMapping = {
  mandantengelder: '3590',
  fremdgeld: '3599',
  honorar: '4400',
  auslagen: '6300',
  bank: '1800',
  kasse: '1600',
};
