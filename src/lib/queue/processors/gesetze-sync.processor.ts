/**
 * BullMQ processor for daily Gesetze sync from bundestag/gesetze GitHub repo.
 *
 * Flow:
 * 1. Load SHA cache from SystemSetting (track which files were last processed)
 * 2. Fetch all file paths+SHAs from GitHub git trees API (one request)
 * 3. For each index.md: skip if SHA unchanged, otherwise:
 *    a. Fetch raw Markdown content
 *    b. Encoding smoke test (reject if § appears as "Â§")
 *    c. Parse Markdown into LawParagraph[]
 *    d. Upsert law_chunks (delete + re-insert with fresh embedding)
 *    e. Update SHA cache entry
 * 4. Persist SHA cache to SystemSetting (save only at end or per-Gesetz)
 */

import { createLogger } from "@/lib/logger";
import { fetchAllGesetzeFiles, fetchRawFileContent } from "@/lib/gesetze/github-client";
import { encodingSmokePassed, parseGesetzeMarkdown } from "@/lib/gesetze/markdown-parser";
import { upsertLawChunks, loadShaCache, saveShaCache } from "@/lib/gesetze/ingestion";

const log = createLogger("gesetze-sync-processor");

export interface GesetzeSyncResult {
  processed: number;
  skipped: number;
  failed: number;
}

/**
 * Main processor for the gesetze-sync BullMQ job.
 * Called by the gesetze-sync Worker in src/worker.ts.
 * No job data required — runs as cron sweep.
 */
export async function processGesetzeSyncJob(): Promise<GesetzeSyncResult> {
  log.info("Starting Gesetze sync from bundestag/gesetze");

  // 1. Load SHA cache (empty on first run)
  const shaCache = await loadShaCache();

  // 2. Fetch all file paths + SHAs from GitHub (one API request)
  let allFiles;
  try {
    allFiles = await fetchAllGesetzeFiles();
    log.info({ total: allFiles.length }, "GitHub tree fetched");
  } catch (err) {
    log.error({ err }, "Failed to fetch GitHub tree — aborting sync");
    throw err; // Let BullMQ retry (attempts: 2)
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of allFiles) {
    // 3. Skip unchanged files (SHA comparison)
    if (shaCache[file.path] === file.sha) {
      skipped++;
      continue;
    }

    // Extract slug from path format: {letter}/{slug}/index.md
    const pathParts = file.path.split("/");
    const slug = pathParts[1];

    try {
      // 4a. Fetch raw Markdown
      const content = await fetchRawFileContent(file.path);

      // 4b. Encoding smoke test — skip files with mojibake §
      if (!encodingSmokePassed(content, slug)) {
        failed++;
        continue;
      }

      // 4c. Parse Markdown into paragraphs
      const paragraphs = parseGesetzeMarkdown(content, slug);
      if (paragraphs.length === 0) {
        log.warn({ path: file.path }, "No paragraphs parsed — skipping (no ##### § headings found)");
        failed++;
        continue;
      }

      // 4d. Upsert law_chunks (delete existing + insert with fresh embedding)
      const { inserted, skipped: chunkSkipped } = await upsertLawChunks(paragraphs);

      // 4e. Update SHA cache entry for this file
      shaCache[file.path] = file.sha;
      processed++;

      log.info(
        { slug, inserted, chunkSkipped, paragraphsFound: paragraphs.length },
        "Gesetz synced"
      );
    } catch (err) {
      log.warn({ path: file.path, slug, err }, "Failed to sync Gesetz (non-fatal, continuing with next)");
      failed++;
      // Do NOT update shaCache[file.path] — will retry on next cron run
    }
  }

  // 5. Persist updated SHA cache (batch save at end — avoids N Settings writes)
  try {
    await saveShaCache(shaCache);
  } catch (err) {
    log.error({ err }, "Failed to persist SHA cache — progress may be lost");
    // Non-fatal: files will be re-processed on next run (idempotent)
  }

  log.info({ processed, skipped, failed }, "Gesetze sync completed");
  return { processed, skipped, failed };
}
