// SEPA XML Generation
// Generates pain.001 (credit transfer) and pain.008 (direct debit) XML files
// Uses the 'sepa' npm package (v2.1.0)

import SEPA from 'sepa';
import type { SepaPayment, SepaDebtor, SepaCreditor, SepaMandate } from './types';

/**
 * Generate a unique SEPA message ID based on timestamp
 */
function generateMessageId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T.Z]/g, '').substring(0, 14);
  const rand = Math.random().toString(36).substring(2, 8);
  return `MSG-${ts}-${rand}`;
}

/**
 * Generate SEPA pain.001 Credit Transfer XML.
 *
 * Creates a SEPA XML file for outgoing payments (Ueberweisungen),
 * typically used for Fremdgeld forwarding or vendor payments.
 *
 * @param debtor - Debtor (payer) info (Kanzlei bank account)
 * @param payments - Array of payment instructions
 * @param executionDate - Requested execution date
 * @returns SEPA pain.001 XML string
 */
export function generateSepaCreditTransfer(
  debtor: SepaDebtor,
  payments: SepaPayment[],
  executionDate: Date,
): string {
  if (payments.length === 0) {
    throw new Error('Mindestens eine Zahlung erforderlich');
  }

  const doc = new SEPA.Document('pain.001.001.09');

  // Group header
  doc.grpHdr.id = generateMessageId();
  doc.grpHdr.created = new Date();
  doc.grpHdr.initiatorName = debtor.name;

  // Payment info block
  const pi = doc.createPaymentInfo();
  pi.requestedExecutionDate = executionDate;
  pi.debtorIBAN = debtor.iban;
  pi.debtorBIC = debtor.bic;
  pi.debtorName = debtor.name;

  // Add transactions
  for (const payment of payments) {
    const tx = pi.createTransaction();
    tx.creditorName = payment.creditorName;
    tx.creditorIBAN = payment.creditorIban;
    if (payment.creditorBic) {
      tx.creditorBIC = payment.creditorBic;
    }
    tx.amount = payment.amount;
    tx.end2endId = payment.reference;
    tx.remittanceInfo = payment.purpose;
    pi.addTransaction(tx);
  }

  doc.addPaymentInfo(pi);

  return doc.toString();
}

/**
 * Generate SEPA pain.008 Direct Debit XML.
 *
 * Creates a SEPA XML file for incoming payments (Lastschriften),
 * typically used for recurring fee collection.
 *
 * @param creditor - Creditor (collector) info with Glaeubiger-ID
 * @param mandates - Array of mandates with debit instructions
 * @param collectionDate - Requested collection date
 * @returns SEPA pain.008 XML string
 */
export function generateSepaDirectDebit(
  creditor: SepaCreditor,
  mandates: SepaMandate[],
  collectionDate: Date,
): string {
  if (mandates.length === 0) {
    throw new Error('Mindestens ein Mandat erforderlich');
  }

  const doc = new SEPA.Document('pain.008.001.08');

  // Group header
  doc.grpHdr.id = generateMessageId();
  doc.grpHdr.created = new Date();
  doc.grpHdr.initiatorName = creditor.name;

  // Payment info block
  const pi = doc.createPaymentInfo();
  pi.collectionDate = collectionDate;
  pi.creditorIBAN = creditor.iban;
  pi.creditorBIC = creditor.bic;
  pi.creditorName = creditor.name;
  pi.creditorId = creditor.creditorId;
  pi.localInstrumentation = 'CORE';
  pi.sequenceType = 'OOFF';

  // Add transactions from mandates
  for (const mandate of mandates) {
    const tx = pi.createTransaction();
    tx.debtorName = mandate.debtorName;
    tx.debtorIBAN = mandate.debtorIban;
    if (mandate.debtorBic) {
      tx.debtorBIC = mandate.debtorBic;
    }
    tx.amount = mandate.amount;
    tx.mandateId = mandate.mandateId;
    tx.mandateSignatureDate = mandate.signatureDate;
    tx.end2endId = mandate.reference;
    tx.remittanceInfo = mandate.purpose;
    pi.addTransaction(tx);
  }

  doc.addPaymentInfo(pi);

  return doc.toString();
}
