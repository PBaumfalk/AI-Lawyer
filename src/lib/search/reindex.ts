/**
 * Full rebuild of the Meilisearch index "dokumente" from the database.
 *
 * Used by POST /api/dokumente/reindex (admin) and by the CLI
 * src/cli/reindex-suche.ts, which scripts/restore.sh runs after a restore.
 *
 * Unlike indexDokument() (fire-and-forget, errors only logged) every
 * Meilisearch task is awaited and checked here, so a failed rebuild is
 * reported as an error instead of silently leaving an incomplete index.
 * The index is dropped and recreated, so repeated runs give the same result
 * and entries of documents that no longer exist disappear.
 */

import type { EnqueuedTaskPromise, MeiliSearch, Task } from "meilisearch";
import type { ExtendedPrismaClient } from "@/lib/db";
import {
  DOKUMENTE_INDEX,
  DOKUMENTE_INDEX_SETTINGS,
  type DokumentSearchRecord,
} from "@/lib/meilisearch";

/** Row shape the rebuild needs from the database. */
export interface ReindexZeile {
  id: string;
  akteId: string;
  name: string;
  mimeType: string;
  ordner: string | null;
  tags: string[];
  ocrText: string | null;
  createdById: string;
  createdAt: Date;
  ocrStatus: string;
  status: string;
  akte: { aktenzeichen: string; kurzrubrum: string };
  createdBy: { name: string };
}

/** Loads up to `anzahl` rows ordered by id, starting after `nachId`. */
export type SeitenLader = (nachId: string | undefined, anzahl: number) => Promise<ReindexZeile[]>;

export interface ReindexOptionen {
  client: MeiliSearch;
  ladeSeite: SeitenLader;
  /** Rows per database page and per Meilisearch batch (default 500). */
  seitenGroesse?: number;
  /** Max wait per Meilisearch task in ms (default 120000). */
  taskTimeoutMs?: number;
  /** Called after each batch with the number of documents indexed so far. */
  fortschritt?: (indexiert: number) => void;
}

export interface ReindexErgebnis {
  /** Documents read from the database and sent to Meilisearch. */
  indexiert: number;
  /** numberOfDocuments reported by Meilisearch afterwards. */
  imIndex: number;
}

export function zuSuchDatensatz(z: ReindexZeile): DokumentSearchRecord {
  return {
    id: z.id,
    akteId: z.akteId,
    name: z.name,
    mimeType: z.mimeType,
    ordner: z.ordner,
    tags: z.tags,
    ocrText: z.ocrText,
    createdById: z.createdById,
    createdByName: z.createdBy.name,
    aktenzeichen: z.akte.aktenzeichen,
    kurzrubrum: z.akte.kurzrubrum,
    createdAt: Math.floor(new Date(z.createdAt).getTime() / 1000),
    ocrStatus: z.ocrStatus,
    dokumentStatus: z.status,
  };
}

/** Keyset pagination over Dokument (stable under concurrent inserts, no OFFSET). */
export function prismaSeitenLader(db: ExtendedPrismaClient): SeitenLader {
  return (nachId, anzahl) =>
    db.dokument.findMany({
      take: anzahl,
      ...(nachId ? { skip: 1, cursor: { id: nachId } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        akteId: true,
        name: true,
        mimeType: true,
        ordner: true,
        tags: true,
        ocrText: true,
        createdById: true,
        createdAt: true,
        ocrStatus: true,
        status: true,
        akte: { select: { aktenzeichen: true, kurzrubrum: true } },
        createdBy: { select: { name: true } },
      },
    });
}

async function warteAufTask(
  p: EnqueuedTaskPromise,
  was: string,
  timeout: number,
  erlaubterFehler?: string
): Promise<Task> {
  const task = await p.waitTask({ timeout, interval: 100 });
  if (task.status === "succeeded") return task;
  if (erlaubterFehler && task.error?.code === erlaubterFehler) return task;
  throw new Error(
    `${was}: Meilisearch-Task ${task.uid} ${task.status}` +
      (task.error ? ` (${task.error.code}: ${task.error.message})` : "")
  );
}

export async function reindexDokumente(o: ReindexOptionen): Promise<ReindexErgebnis> {
  const groesse = o.seitenGroesse ?? 500;
  const timeout = o.taskTimeoutMs ?? 120_000;
  if (!Number.isInteger(groesse) || groesse < 1) throw new Error("seitenGroesse muss >= 1 sein");

  // Drop and recreate: idempotent, removes stale entries.
  await warteAufTask(o.client.deleteIndex(DOKUMENTE_INDEX), "Index löschen", timeout, "index_not_found");
  await warteAufTask(o.client.createIndex(DOKUMENTE_INDEX, { primaryKey: "id" }), "Index anlegen", timeout);
  const index = o.client.index(DOKUMENTE_INDEX);
  await warteAufTask(index.updateSettings(DOKUMENTE_INDEX_SETTINGS), "Index-Einstellungen", timeout);

  let indexiert = 0;
  let nachId: string | undefined;
  for (;;) {
    const seite = await o.ladeSeite(nachId, groesse);
    if (seite.length === 0) break;
    await warteAufTask(index.addDocuments(seite.map(zuSuchDatensatz)), "Dokumente indexieren", timeout);
    indexiert += seite.length;
    nachId = seite[seite.length - 1].id;
    o.fortschritt?.(indexiert);
    if (seite.length < groesse) break;
  }

  const stats = await index.getStats();
  if (stats.numberOfDocuments !== indexiert) {
    throw new Error(
      `Index unvollständig: ${indexiert} Dokumente gesendet, Meilisearch meldet ${stats.numberOfDocuments}`
    );
  }
  return { indexiert, imIndex: stats.numberOfDocuments };
}
