/**
 * CalDAV Sync Engine
 *
 * Implements full sync logic:
 * - Phase A: Push Fristen as read-only events (no writeback from external)
 * - Phase B: Bidirectional Termine sync (create/update/delete both ways)
 * - Phase C: Update sync state (CTag, letzterSync, syncStatus)
 *
 * Uses ETag per-event and CTag per-calendar for incremental change detection.
 */

import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { createCalDavClient, fetchEvents, fetchCalendars, createEvent, updateEvent, deleteEvent } from "./client";
import { decryptCalDavCredential } from "./crypto";
import { kalenderEintragToVEvent, vEventToCalDavEvent } from "./ical-builder";
import type { CalDavProvider, CalDavEvent } from "./types";

const log = createLogger("caldav-sync");

export interface SyncResult {
  pushed: number;
  pulled: number;
  deleted: number;
  errors: string[];
}

/**
 * Sync a single CalDavKonto: push Fristen, bidi Termine, pull external events.
 * Returns aggregate counts. Never throws -- errors are captured in result.errors.
 */
export async function syncCalDavKonto(kontoId: string): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, deleted: 0, errors: [] };

  try {
    // ─── Load konto with decrypted credentials ─────────────────────────
    const konto = await (prisma as any).calDavKonto.findUnique({
      where: { id: kontoId },
    });

    if (!konto) {
      result.errors.push(`CalDavKonto ${kontoId} nicht gefunden`);
      return result;
    }

    if (!konto.aktiv) {
      log.info({ kontoId }, "Konto inaktiv, ueberspringe Sync");
      return result;
    }

    if (!konto.selectedCalendarUrl) {
      result.errors.push("Kein Kalender ausgewaehlt (selectedCalendarUrl fehlt)");
      await updateKontoStatus(kontoId, "FEHLER", result.errors);
      return result;
    }

    // Create CalDAV client
    const client = await createCalDavClient(
      konto.provider as CalDavProvider,
      konto.serverUrl,
      {
        username: konto.benutzername,
        password: konto.passwortEnc
          ? decryptCalDavCredential(konto.passwortEnc)
          : undefined,
        oauthTokens: konto.oauthTokens
          ? { accessToken: (konto.oauthTokens as any).accessToken }
          : undefined,
      }
    );

    // ─── Check CTag for incremental sync ─────────────────────────────
    const calendars = await fetchCalendars(client);
    const calendar = calendars.find((c) => c.url === konto.selectedCalendarUrl);
    const remoteCTag = calendar?.ctag ?? null;

    if (remoteCTag && remoteCTag === konto.ctag) {
      log.info({ kontoId, ctag: remoteCTag }, "CTag unveraendert, kein Sync noetig");
      // Still update letzterSync to show health
      await (prisma as any).calDavKonto.update({
        where: { id: kontoId },
        data: { letzterSync: new Date() },
      });
      return result;
    }

    // Fetch all remote events
    const { events: remoteEvents, ctag: fetchedCTag } = await fetchEvents(
      client,
      konto.selectedCalendarUrl
    );

    // Build remote event map by UID
    const remoteByUid = new Map<string, CalDavEvent>();
    for (const evt of remoteEvents) {
      remoteByUid.set(evt.uid, evt);
    }

    // ─── Phase A: Push Fristen (read-only export) ──────────────────────
    try {
      const fristResult = await pushFristen(kontoId, konto, client, remoteByUid);
      result.pushed += fristResult.pushed;
      result.deleted += fristResult.deleted;
      result.errors.push(...fristResult.errors);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Frist-Push fehlgeschlagen: ${msg}`);
      log.error({ kontoId, err }, "Frist push phase failed");
    }

    // ─── Phase B: Bidi Termine ─────────────────────────────────────────
    try {
      const terminResult = await syncTermineBidi(kontoId, konto, client, remoteByUid);
      result.pushed += terminResult.pushed;
      result.pulled += terminResult.pulled;
      result.deleted += terminResult.deleted;
      result.errors.push(...terminResult.errors);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Termin-Sync fehlgeschlagen: ${msg}`);
      log.error({ kontoId, err }, "Termin bidi sync phase failed");
    }

    // ─── Phase C: Update sync state ────────────────────────────────────
    await (prisma as any).calDavKonto.update({
      where: { id: kontoId },
      data: {
        ctag: fetchedCTag || remoteCTag,
        letzterSync: new Date(),
        syncStatus: result.errors.length === 0 ? "VERBUNDEN" : "FEHLER",
        fehlerLog: result.errors.length > 0
          ? result.errors.slice(-5) // Keep last 5 errors
          : undefined,
      },
    });

    log.info(
      { kontoId, pushed: result.pushed, pulled: result.pulled, deleted: result.deleted, errors: result.errors.length },
      "CalDAV sync completed"
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Sync-Fehler: ${msg}`);
    log.error({ kontoId, err }, "CalDAV sync failed");

    await updateKontoStatus(kontoId, "FEHLER", result.errors).catch(() => {});
  }

  return result;
}

// ─── Phase A: Push Fristen ──────────────────────────────────────────────────

async function pushFristen(
  kontoId: string,
  konto: any,
  client: any,
  remoteByUid: Map<string, CalDavEvent>
): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, deleted: 0, errors: [] };

  // Get all active (non-erledigt) Fristen for this user
  const fristen = await (prisma as any).kalenderEintrag.findMany({
    where: {
      typ: "FRIST",
      verantwortlichId: konto.userId,
      erledigt: false,
    },
  });

  // Get existing PUSH mappings for this konto
  const existingMappings = await (prisma as any).calDavSyncMapping.findMany({
    where: {
      kontoId,
      richtung: "PUSH",
    },
    include: { kalenderEintrag: true },
  });

  const mappingByEintragId = new Map<string, any>();
  for (const m of existingMappings) {
    if (m.kalenderEintragId) {
      mappingByEintragId.set(m.kalenderEintragId, m);
    }
  }

  const activeFristIds = new Set(fristen.map((f: any) => f.id));

  // Push each Frist to CalDAV
  for (const frist of fristen) {
    try {
      const mapping = mappingByEintragId.get(frist.id);
      const icalString = kalenderEintragToVEvent(frist);
      const uid = `${frist.id}@ai-lawyer.local`;

      if (!mapping) {
        // New Frist -- create on CalDAV
        const { etag } = await createEvent(client, konto.selectedCalendarUrl, {
          uid,
          summary: `[FRIST] ${frist.titel}`,
          description: frist.beschreibung ?? undefined,
          dtstart: frist.datum,
          dtend: frist.datumBis ?? undefined,
          allDay: frist.ganztaegig,
        });

        await (prisma as any).calDavSyncMapping.create({
          data: {
            kontoId,
            kalenderEintragId: frist.id,
            externalUid: uid,
            etag,
            richtung: "PUSH",
            letzterSync: new Date(),
          },
        });
        result.pushed++;
      } else {
        // Existing mapping -- check if local changed
        const localUpdated = new Date(frist.updatedAt).getTime();
        const mappingSync = new Date(mapping.letzterSync).getTime();

        if (localUpdated > mappingSync) {
          // Local is newer, push update
          const remoteEvent = remoteByUid.get(mapping.externalUid);
          const eventUrl = remoteEvent?.url ?? `${konto.selectedCalendarUrl}${uid}.ics`;

          const { etag } = await updateEvent(
            client,
            konto.selectedCalendarUrl,
            eventUrl,
            {
              uid: mapping.externalUid,
              summary: `[FRIST] ${frist.titel}`,
              description: frist.beschreibung ?? undefined,
              dtstart: frist.datum,
              dtend: frist.datumBis ?? undefined,
              allDay: frist.ganztaegig,
            },
            mapping.etag ?? ""
          );

          await (prisma as any).calDavSyncMapping.update({
            where: { id: mapping.id },
            data: { etag, letzterSync: new Date() },
          });
          result.pushed++;
        }
        // If same or remote only: skip (Fristen are read-only push)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Frist ${frist.id} push failed: ${msg}`);
      log.warn({ kontoId, fristId: frist.id, err }, "Frist push failed");
    }
  }

  // Delete mappings for Fristen that are erledigt or deleted
  for (const mapping of existingMappings) {
    if (!mapping.kalenderEintragId || !activeFristIds.has(mapping.kalenderEintragId)) {
      try {
        // Also check if the KalenderEintrag was marked erledigt
        let shouldDelete = !mapping.kalenderEintragId || !activeFristIds.has(mapping.kalenderEintragId);

        if (shouldDelete) {
          const remoteEvent = remoteByUid.get(mapping.externalUid);
          if (remoteEvent?.url) {
            await deleteEvent(client, remoteEvent.url, mapping.etag ?? "");
          }

          await (prisma as any).calDavSyncMapping.delete({
            where: { id: mapping.id },
          });
          result.deleted++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Frist mapping ${mapping.id} delete failed: ${msg}`);
        log.warn({ kontoId, mappingId: mapping.id, err }, "Frist mapping delete failed");
      }
    }
  }

  return result;
}

// ─── Phase B: Bidi Termine ──────────────────────────────────────────────────

async function syncTermineBidi(
  kontoId: string,
  konto: any,
  client: any,
  remoteByUid: Map<string, CalDavEvent>
): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, deleted: 0, errors: [] };

  // Get all Termine for this user
  const termine = await (prisma as any).kalenderEintrag.findMany({
    where: {
      typ: "TERMIN",
      verantwortlichId: konto.userId,
    },
  });

  // Get all BIDI and PULL mappings for this konto
  const existingMappings = await (prisma as any).calDavSyncMapping.findMany({
    where: {
      kontoId,
      richtung: { in: ["BIDI", "PULL"] },
    },
  });

  const mappingByEintragId = new Map<string, any>();
  const mappingByUid = new Map<string, any>();
  for (const m of existingMappings) {
    if (m.kalenderEintragId) {
      mappingByEintragId.set(m.kalenderEintragId, m);
    }
    mappingByUid.set(m.externalUid, m);
  }

  // ─── Push local Termine to CalDAV ─────────────────────────────────
  for (const termin of termine) {
    try {
      const mapping = mappingByEintragId.get(termin.id);
      const uid = `${termin.id}@ai-lawyer.local`;

      if (!mapping) {
        // New local Termin -- push to CalDAV
        const { etag } = await createEvent(client, konto.selectedCalendarUrl, {
          uid,
          summary: termin.titel,
          description: termin.beschreibung ?? undefined,
          dtstart: termin.datum,
          dtend: termin.datumBis ?? undefined,
          allDay: termin.ganztaegig,
        });

        await (prisma as any).calDavSyncMapping.create({
          data: {
            kontoId,
            kalenderEintragId: termin.id,
            externalUid: uid,
            etag,
            richtung: "BIDI",
            letzterSync: new Date(),
          },
        });
        result.pushed++;
      } else {
        // Existing mapping -- check for changes
        const localUpdated = new Date(termin.updatedAt).getTime();
        const mappingSync = new Date(mapping.letzterSync).getTime();
        const remoteEvent = remoteByUid.get(mapping.externalUid);

        // Check if remote etag changed (remote was modified)
        const remoteChanged = remoteEvent && remoteEvent.etag && remoteEvent.etag !== mapping.etag;

        if (remoteChanged) {
          // CONFLICT: remote wins (safer for external calendar authority)
          if (remoteEvent) {
            await updateLocalTerminFromRemote(termin.id, remoteEvent);

            await (prisma as any).calDavSyncMapping.update({
              where: { id: mapping.id },
              data: { etag: remoteEvent.etag, letzterSync: new Date() },
            });
            result.pulled++;
          }
        } else if (localUpdated > mappingSync) {
          // Local is newer, push update
          const eventUrl = remoteEvent?.url ?? `${konto.selectedCalendarUrl}${uid}.ics`;

          const { etag } = await updateEvent(
            client,
            konto.selectedCalendarUrl,
            eventUrl,
            {
              uid: mapping.externalUid,
              summary: termin.titel,
              description: termin.beschreibung ?? undefined,
              dtstart: termin.datum,
              dtend: termin.datumBis ?? undefined,
              allDay: termin.ganztaegig,
            },
            mapping.etag ?? ""
          );

          await (prisma as any).calDavSyncMapping.update({
            where: { id: mapping.id },
            data: { etag, letzterSync: new Date() },
          });
          result.pushed++;
        }
        // If both unchanged: skip
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Termin ${termin.id} sync failed: ${msg}`);
      log.warn({ kontoId, terminId: termin.id, err }, "Termin sync failed");
    }
  }

  // ─── Pull remote events to local ─────────────────────────────────
  for (const [uid, remoteEvent] of Array.from(remoteByUid.entries())) {
    // Skip our own pushed events (deterministic UID pattern)
    if (uid.endsWith("@ai-lawyer.local")) continue;

    // Skip if already mapped (PUSH mappings are for Fristen, skip those UIDs too)
    const allMappingsForUid = await (prisma as any).calDavSyncMapping.findFirst({
      where: { kontoId, externalUid: uid },
    });

    if (!allMappingsForUid) {
      // New external event -- create PULL mapping
      try {
        await (prisma as any).calDavSyncMapping.create({
          data: {
            kontoId,
            kalenderEintragId: null,
            externalUid: uid,
            etag: remoteEvent.etag ?? null,
            richtung: "PULL",
            letzterSync: new Date(),
          },
        });
        result.pulled++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Pull mapping for ${uid} failed: ${msg}`);
        log.warn({ kontoId, uid, err }, "Pull mapping creation failed");
      }
    } else if (allMappingsForUid.richtung === "BIDI" || allMappingsForUid.richtung === "PULL") {
      // Check if remote etag changed
      if (remoteEvent.etag && remoteEvent.etag !== allMappingsForUid.etag) {
        try {
          if (allMappingsForUid.richtung === "BIDI" && allMappingsForUid.kalenderEintragId) {
            // Update local KalenderEintrag from remote
            await updateLocalTerminFromRemote(allMappingsForUid.kalenderEintragId, remoteEvent);
          }

          await (prisma as any).calDavSyncMapping.update({
            where: { id: allMappingsForUid.id },
            data: { etag: remoteEvent.etag, letzterSync: new Date() },
          });
          result.pulled++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Pull update for ${uid} failed: ${msg}`);
          log.warn({ kontoId, uid, err }, "Pull update failed");
        }
      }
    }
  }

  // ─── Handle deleted remote events ─────────────────────────────────
  const remoteUids = new Set(remoteByUid.keys());

  for (const mapping of existingMappings) {
    if (!remoteUids.has(mapping.externalUid)) {
      // Remote event was deleted
      try {
        if (mapping.richtung === "BIDI" && mapping.kalenderEintragId) {
          // Mark local Termin as erledigt
          await (prisma as any).kalenderEintrag.update({
            where: { id: mapping.kalenderEintragId },
            data: { erledigt: true, erledigtAm: new Date() },
          });
        }

        // Delete mapping
        await (prisma as any).calDavSyncMapping.delete({
          where: { id: mapping.id },
        });
        result.deleted++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Delete mapping ${mapping.id} failed: ${msg}`);
        log.warn({ kontoId, mappingId: mapping.id, err }, "Delete mapping failed");
      }
    }
  }

  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function updateLocalTerminFromRemote(
  kalenderEintragId: string,
  remoteEvent: CalDavEvent
): Promise<void> {
  await (prisma as any).kalenderEintrag.update({
    where: { id: kalenderEintragId },
    data: {
      titel: remoteEvent.summary,
      beschreibung: remoteEvent.description ?? null,
      datum: remoteEvent.dtstart,
      datumBis: remoteEvent.dtend ?? null,
      ganztaegig: remoteEvent.allDay,
    },
  });
}

async function updateKontoStatus(
  kontoId: string,
  status: string,
  errors: string[]
): Promise<void> {
  await (prisma as any).calDavKonto.update({
    where: { id: kontoId },
    data: {
      syncStatus: status,
      fehlerLog: errors.slice(-5),
    },
  });
}
