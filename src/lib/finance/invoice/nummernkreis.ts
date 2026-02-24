// Atomic Invoice Number Generator (Nummernkreis)
// Uses PostgreSQL UPSERT with RETURNING for gap-free sequence generation
// Safe under concurrent access - no duplicate numbers possible

import type { PrismaClient } from '@prisma/client';

type PrismaTransaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Generate the next invoice number atomically using PostgreSQL UPSERT.
 *
 * The sequence is gap-free and safe under concurrent access:
 * - INSERT with ON CONFLICT DO UPDATE ensures atomic increment
 * - RETURNING gives the new sequence value in the same statement
 * - No race conditions between read and write
 *
 * @param tx - Prisma transaction client
 * @param prefix - Number prefix (e.g., "RE" for invoices, "GS" for Storno)
 * @param year - Year for the sequence (each year starts fresh)
 * @param pattern - Format pattern (e.g., "RE-{YEAR}-{SEQ:4}")
 * @returns Formatted invoice number (e.g., "RE-2025-0001")
 */
export async function getNextInvoiceNumber(
  tx: PrismaTransaction,
  prefix: string,
  year: number,
  pattern?: string,
): Promise<string> {
  // Use raw SQL for atomic UPSERT with RETURNING
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Array<{ sequence: number }> = await (tx as any).$queryRawUnsafe(
    `INSERT INTO nummernkreise (id, prefix, year, sequence)
     VALUES (gen_random_uuid(), $1, $2, 1)
     ON CONFLICT (prefix, year)
     DO UPDATE SET sequence = nummernkreise.sequence + 1
     RETURNING sequence`,
    prefix,
    year,
  );

  const sequence = result[0].sequence;

  // Format according to pattern
  return formatInvoiceNumber(prefix, year, sequence, pattern);
}

/**
 * Format an invoice number from its components.
 *
 * Supported pattern tokens:
 * - {YEAR} - 4-digit year
 * - {SEQ:N} - Zero-padded sequence with N digits
 * - {PREFIX} - The prefix string
 *
 * Default pattern: "{PREFIX}-{YEAR}-{SEQ:4}" -> "RE-2025-0001"
 */
export function formatInvoiceNumber(
  prefix: string,
  year: number,
  sequence: number,
  pattern?: string,
): string {
  const fmt = pattern ?? `${prefix}-{YEAR}-{SEQ:4}`;

  return fmt
    .replace('{PREFIX}', prefix)
    .replace('{YEAR}', String(year))
    .replace(/\{SEQ:(\d+)\}/g, (_match, digits) => {
      return String(sequence).padStart(parseInt(digits, 10), '0');
    });
}
