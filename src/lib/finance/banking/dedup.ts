// Bank Transaction Duplicate Detection
// SHA-256 hash-based deduplication for bank statement imports

import { createHash } from 'crypto';
import { prisma } from '@/lib/db';
import type { BankTransaction } from './types';

/**
 * Generate a SHA-256 hash for a bank transaction.
 * Hash is computed from: date + amount + purpose + sender/recipient.
 * This hash is stored as importHash on BankTransaktion to prevent duplicate imports.
 *
 * @param tx - Normalized bank transaction
 * @returns Hex-encoded SHA-256 hash string
 */
export function hashTransaction(tx: BankTransaction): string {
  const dateStr = tx.buchungsdatum.toISOString().substring(0, 10);
  const amountStr = tx.betrag.toFixed(2);
  const purpose = (tx.verwendungszweck ?? '').trim().toLowerCase();
  const sender = (tx.absenderEmpfaenger ?? '').trim().toLowerCase();

  const data = `${dateStr}|${amountStr}|${purpose}|${sender}`;
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Check transactions against existing BankTransaktion records and separate
 * into unique (new) and duplicate (already imported) sets.
 *
 * @param transactions - Parsed transactions to check
 * @returns Object with unique and duplicate arrays, each item includes its importHash
 */
export async function findDuplicates(
  transactions: BankTransaction[],
): Promise<{
  unique: Array<BankTransaction & { importHash: string }>;
  duplicates: Array<BankTransaction & { importHash: string }>;
}> {
  // Compute hashes for all transactions
  const withHashes = transactions.map((tx) => ({
    ...tx,
    importHash: hashTransaction(tx),
  }));

  if (withHashes.length === 0) {
    return { unique: [], duplicates: [] };
  }

  // Query existing hashes from DB
  const hashes = withHashes.map((tx) => tx.importHash);
  const existing = await prisma.bankTransaktion.findMany({
    where: {
      importHash: { in: hashes },
    },
    select: { importHash: true },
  });

  const existingSet = new Set(existing.map((e) => e.importHash));

  // Also deduplicate within the current batch
  const seenInBatch = new Set<string>();
  const unique: Array<BankTransaction & { importHash: string }> = [];
  const duplicates: Array<BankTransaction & { importHash: string }> = [];

  for (const tx of withHashes) {
    if (existingSet.has(tx.importHash) || seenInBatch.has(tx.importHash)) {
      duplicates.push(tx);
    } else {
      seenInBatch.add(tx.importHash);
      unique.push(tx);
    }
  }

  return { unique, duplicates };
}
