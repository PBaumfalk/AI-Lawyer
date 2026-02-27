/**
 * BullMQ processor for daily Urteile RSS sync.
 * Fetches all 7 BMJ RSS feeds, skips already-seen GUIDs,
 * ingests new items through the inline PII gate.
 */
import { createLogger } from "@/lib/logger";
import { fetchUrteileFeed, BMJ_RSS_FEEDS } from "@/lib/urteile/rss-client";
import { ingestUrteilItem, loadGuidCache, saveGuidCache } from "@/lib/urteile/ingestion";

const log = createLogger("urteile-sync-processor");

export async function processUrteileSyncJob(): Promise<{
  inserted: number;
  skipped: number;
  piiRejected: number;
  failed: number;
}> {
  const guidCache = await loadGuidCache();
  let inserted = 0, skipped = 0, piiRejected = 0, failed = 0;

  for (const gerichtCode of Object.keys(BMJ_RSS_FEEDS)) {
    let items;
    try {
      items = await fetchUrteileFeed(gerichtCode);
    } catch (err) {
      log.error({ err, gerichtCode }, "RSS fetch failed — skipping court");
      failed++;
      continue;
    }

    for (const item of items) {
      if (guidCache.has(item.guid)) {
        skipped++;
        continue;
      }

      const result = await ingestUrteilItem(item);

      if (result === "inserted") {
        guidCache.add(item.guid);
        inserted++;
      } else if (result === "pii_rejected") {
        guidCache.add(item.guid); // Mark seen — do NOT retry PII-rejected items
        piiRejected++;
      } else {
        // "error" — do NOT add to guidCache (retry on next cron)
        failed++;
      }
    }
  }

  // Save cache AFTER all courts processed (batch save, same as gesetze SHA cache pattern)
  await saveGuidCache(guidCache);
  log.info({ inserted, skipped, piiRejected, failed }, "Urteile sync completed");
  return { inserted, skipped, piiRejected, failed };
}
