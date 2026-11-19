/**
 * Rebuilds the Meilisearch index "dokumente" from the database without an
 * admin session. Bundled to dist-worker/reindex-suche.mjs (scripts/build-worker.ts)
 * and therefore present in the app/worker image:
 *
 *   docker compose exec -T app node dist-worker/reindex-suche.mjs
 *
 * Needs DATABASE_URL, MEILISEARCH_URL and MEILISEARCH_API_KEY (set in the
 * container). Prints the number of indexed documents; exit code 0 only if
 * Meilisearch reports exactly as many documents as the database holds.
 * Called automatically by scripts/restore.sh.
 */

import { prisma } from "@/lib/db";
import { meiliClient } from "@/lib/meilisearch";
import { prismaSeitenLader, reindexDokumente } from "@/lib/search/reindex";

async function main(): Promise<number> {
  const start = Date.now();
  const gesamt = await prisma.dokument.count();
  console.log(`Suchindex-Neuaufbau: ${gesamt} Dokument(e) in der Datenbank`);
  const { indexiert, imIndex } = await reindexDokumente({
    client: meiliClient,
    ladeSeite: prismaSeitenLader(prisma),
    fortschritt: (n) => {
      if (gesamt > 500) console.log(`  ${n}/${gesamt} indexiert`);
    },
  });
  const sek = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Suchindex-Neuaufbau fertig: ${indexiert} indexiert, ${imIndex} im Index (${sek} s)`);
  // Machine-readable last line for scripts/restore.sh
  console.log(`REINDEX_OK indexiert=${indexiert}`);
  return 0;
}

main()
  .catch((err: unknown) => {
    console.error(`Suchindex-Neuaufbau FEHLGESCHLAGEN: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  })
  .then(async (code) => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(code);
  });
