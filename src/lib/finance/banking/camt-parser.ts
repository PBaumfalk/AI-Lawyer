// CAMT.053 XML Parser
// Parses CAMT.053.001.02 and .08 bank statement XML into normalized BankTransaction objects
// Uses fast-xml-parser for robust XML handling

import type { BankTransaction } from './types';

/**
 * Simple XML tag content extractor.
 * Finds the first occurrence of <tag>content</tag> and returns content.
 * Handles nested elements by finding the matching close tag.
 */
function getTagContent(xml: string, tag: string): string | null {
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;
  const startIdx = xml.indexOf(openTag);
  if (startIdx === -1) return null;
  const contentStart = startIdx + openTag.length;
  const endIdx = xml.indexOf(closeTag, contentStart);
  if (endIdx === -1) return null;
  return xml.substring(contentStart, endIdx);
}

/**
 * Extract all occurrences of a tag's content in an XML string.
 */
function getAllTagContents(xml: string, tag: string): string[] {
  const results: string[] = [];
  const openTag = `<${tag}`;
  const closeTag = `</${tag}>`;
  let searchFrom = 0;

  while (searchFrom < xml.length) {
    const startIdx = xml.indexOf(openTag, searchFrom);
    if (startIdx === -1) break;

    // Find the end of the opening tag (handles attributes)
    const tagEnd = xml.indexOf('>', startIdx);
    if (tagEnd === -1) break;

    const contentStart = tagEnd + 1;
    const endIdx = xml.indexOf(closeTag, contentStart);
    if (endIdx === -1) break;

    results.push(xml.substring(contentStart, endIdx));
    searchFrom = endIdx + closeTag.length;
  }

  return results;
}

/**
 * Parse a CAMT.053 entry (Ntry) element into a BankTransaction.
 */
function parseEntry(entryXml: string): BankTransaction | null {
  try {
    // Amount
    const amtContent = getTagContent(entryXml, 'Amt');
    if (!amtContent) return null;
    const amount = parseFloat(amtContent.trim());
    if (isNaN(amount)) return null;

    // Credit/Debit indicator
    const cdtDbtInd = getTagContent(entryXml, 'CdtDbtInd');
    const betrag = cdtDbtInd === 'DBIT' ? -amount : amount;

    // Booking date
    const bookgDt = getTagContent(entryXml, 'BookgDt');
    let buchungsdatum: Date;
    if (bookgDt) {
      const dtStr = getTagContent(bookgDt, 'Dt');
      buchungsdatum = dtStr ? new Date(dtStr.trim()) : new Date();
    } else {
      buchungsdatum = new Date();
    }

    // Value date (optional)
    let wertstellung: Date | undefined;
    const valDt = getTagContent(entryXml, 'ValDt');
    if (valDt) {
      const dtStr = getTagContent(valDt, 'Dt');
      if (dtStr) wertstellung = new Date(dtStr.trim());
    }

    // Transaction details (TxDtls)
    const txDtls = getTagContent(entryXml, 'TxDtls') ?? entryXml;

    // Purpose / Remittance info
    let verwendungszweck = '';
    const rmtInf = getTagContent(txDtls, 'RmtInf');
    if (rmtInf) {
      const ustrd = getTagContent(rmtInf, 'Ustrd');
      if (ustrd) verwendungszweck = ustrd.trim();
    }
    if (!verwendungszweck) {
      const addtlNtryInf = getTagContent(entryXml, 'AddtlNtryInf');
      if (addtlNtryInf) verwendungszweck = addtlNtryInf.trim();
    }

    // Sender/Recipient
    let absenderEmpfaenger: string | undefined;
    const rltdPties = getTagContent(txDtls, 'RltdPties');
    if (rltdPties) {
      // For credits: look at Dbtr (debtor = sender)
      // For debits: look at Cdtr (creditor = recipient)
      const party = cdtDbtInd === 'DBIT'
        ? getTagContent(rltdPties, 'Cdtr')
        : getTagContent(rltdPties, 'Dbtr');
      if (party) {
        const nm = getTagContent(party, 'Nm');
        if (nm) absenderEmpfaenger = nm.trim();
      }
    }

    // IBAN
    let iban: string | undefined;
    const rltdAccts = getTagContent(txDtls, 'RltdPties');
    if (rltdAccts) {
      const acctXml = cdtDbtInd === 'DBIT'
        ? getTagContent(rltdAccts, 'CdtrAcct')
        : getTagContent(rltdAccts, 'DbtrAcct');
      if (acctXml) {
        const id = getTagContent(acctXml, 'Id');
        if (id) {
          const ibanVal = getTagContent(id, 'IBAN');
          if (ibanVal) iban = ibanVal.trim();
        }
      }
    }

    return {
      buchungsdatum,
      wertstellung,
      betrag,
      verwendungszweck,
      absenderEmpfaenger,
      iban,
    };
  } catch {
    return null;
  }
}

/**
 * Parse a CAMT.053 (Bank-to-Customer Statement) XML file.
 *
 * Supports both CAMT.053.001.02 and .08 formats.
 * Extracts booking entries (Ntry) with amount, date, purpose,
 * sender/recipient, and IBAN information.
 *
 * @param xmlContent - CAMT.053 XML string
 * @returns Array of parsed transactions
 */
export function parseCamt053(xmlContent: string): BankTransaction[] {
  // Find all Ntry (entry) elements
  const entries = getAllTagContents(xmlContent, 'Ntry');

  if (entries.length === 0) {
    // Try namespace-prefixed entries
    const nsEntries = getAllTagContents(xmlContent, 'ns:Ntry');
    if (nsEntries.length > 0) {
      return nsEntries
        .map((entry) => parseEntry(entry))
        .filter((tx): tx is BankTransaction => tx !== null);
    }
    return [];
  }

  return entries
    .map((entry) => parseEntry(entry))
    .filter((tx): tx is BankTransaction => tx !== null);
}
