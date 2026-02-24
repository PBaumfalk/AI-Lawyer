/**
 * IMAP Connection Manager: maintains one ImapFlow connection per active mailbox.
 * Handles IDLE, reconnection with exponential backoff, and dispatches events via Socket.IO.
 *
 * CRITICAL: Always create a NEW ImapFlow instance (never reuse after close).
 */

import { ImapFlow } from "imapflow";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { decryptCredential } from "@/lib/email/crypto";
import { syncMailbox } from "@/lib/email/imap/sync";
import { initialSync } from "@/lib/email/imap/sync";
import { syncFolders } from "@/lib/email/imap/folder-sync";
import { startIdleMonitoring, stopIdleMonitoring } from "@/lib/email/imap/idle-handler";
import { getSocketEmitter } from "@/lib/socket/emitter";
import { createNotification } from "@/lib/notifications/service";
import type { ManagedConnection } from "@/lib/email/types";

const log = createLogger("imap:manager");

/** Active connections keyed by kontoId */
const connections = new Map<string, ManagedConnection>();

/** Reconnection constants */
const BASE_RECONNECT_DELAY = 5_000;   // 5 seconds
const MAX_RECONNECT_DELAY = 300_000;  // 5 minutes
const ADMIN_NOTIFY_THRESHOLD = 3;     // Notify admin after this many consecutive failures

/**
 * Start an IMAP connection for a mailbox.
 * Creates a new ImapFlow instance, connects, syncs folders, enters IDLE on INBOX.
 */
export async function startImapConnection(konto: {
  id: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  benutzername: string;
  passwortEnc: string | null;
  oauthTokens: any;
  authTyp: string;
  initialSync: string;
  emailAdresse: string;
}): Promise<void> {
  // Stop any existing connection for this konto
  await stopImapConnection(konto.id);

  log.info({ kontoId: konto.id, host: konto.imapHost }, "Starting IMAP connection");

  // Decrypt credentials
  let password: string | undefined;
  let accessToken: string | undefined;

  if (konto.authTyp === "PASSWORT" && konto.passwortEnc) {
    try {
      password = decryptCredential(konto.passwortEnc);
    } catch (err) {
      log.error({ kontoId: konto.id, err }, "Failed to decrypt password");
      await updateKontoError(konto.id, "Passwort-Entschlüsselung fehlgeschlagen");
      return;
    }
  } else if (konto.authTyp === "OAUTH2" && konto.oauthTokens) {
    const tokens = typeof konto.oauthTokens === "string"
      ? JSON.parse(konto.oauthTokens)
      : konto.oauthTokens;
    accessToken = tokens.accessToken;
  }

  // CRITICAL: Always create a NEW ImapFlow instance
  const client = new ImapFlow({
    host: konto.imapHost,
    port: konto.imapPort,
    secure: konto.imapSecure,
    auth: accessToken
      ? { user: konto.benutzername, accessToken }
      : { user: konto.benutzername, pass: password! },
    logger: false, // Use our own logger
    maxIdleTime: 300_000, // 5 min, then re-IDLE
  });

  const managed: ManagedConnection = {
    kontoId: konto.id,
    client,
    reconnectTimer: null,
    heartbeatTimer: null,
    failCount: 0,
    state: "connecting",
  };

  connections.set(konto.id, managed);

  // Handle new messages via IDLE
  client.on("exists", async (data: { path: string; count: number; prevCount: number }) => {
    const newCount = data.count - data.prevCount;
    if (newCount <= 0) return;

    log.info(
      { kontoId: konto.id, folder: data.path, newCount, total: data.count },
      "New message(s) detected via IDLE"
    );

    try {
      // Incremental sync: fetch only since last sync
      const lastSync = await prisma.emailKonto.findUnique({
        where: { id: konto.id },
        select: { letzterSync: true },
      });

      const since = lastSync?.letzterSync ?? new Date(Date.now() - 60 * 60 * 1000);
      const result = await syncMailbox(client, konto.id, data.path, since);

      // Update last sync time
      await prisma.emailKonto.update({
        where: { id: konto.id },
        data: { letzterSync: new Date() },
      });

      // Emit real-time folder update
      const dbFolder = await prisma.emailOrdner.findFirst({
        where: { kontoId: konto.id, pfad: data.path },
      });

      if (dbFolder) {
        try {
          getSocketEmitter()
            .to(`mailbox:${konto.id}`)
            .emit("email:folder-update", {
              kontoId: konto.id,
              ordnerId: dbFolder.id,
              ungeleseneAnzahl: dbFolder.ungeleseneAnzahl + result.newMessages,
            });
        } catch {
          // Non-fatal: socket emit failure
        }
      }

      log.info(
        { kontoId: konto.id, newMessages: result.newMessages },
        "Incremental sync complete"
      );
    } catch (err) {
      log.error({ kontoId: konto.id, err }, "Error during incremental sync");
    }
  });

  // Handle connection close (reconnect with backoff)
  client.on("close", () => {
    log.warn({ kontoId: konto.id }, "IMAP connection closed");
    managed.state = "disconnected";
    stopIdleMonitoring(managed);
    scheduleReconnect(konto);
  });

  // Handle errors
  client.on("error", (err: Error) => {
    log.error({ kontoId: konto.id, err: err.message }, "IMAP connection error");
  });

  try {
    // Connect to IMAP server
    await client.connect();
    managed.state = "connected";
    managed.failCount = 0;

    log.info({ kontoId: konto.id }, "IMAP connected successfully");

    // Sync folders first
    await syncFolders(client, konto.id);

    // Run initial sync if this is the first connection
    const existingMessages = await prisma.emailNachricht.count({
      where: { emailKontoId: konto.id },
    });

    if (existingMessages === 0) {
      await initialSync(
        client,
        konto.id,
        konto.initialSync as any
      );
    }

    // Open INBOX and let ImapFlow auto-IDLE
    await client.mailboxOpen("INBOX");
    managed.state = "idle";

    // Start heartbeat monitoring
    startIdleMonitoring(managed);

    // Update konto status
    await prisma.emailKonto.update({
      where: { id: konto.id },
      data: { syncStatus: "VERBUNDEN" },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error({ kontoId: konto.id, err: errMsg }, "Failed to connect to IMAP");
    managed.state = "error";
    managed.failCount++;
    await updateKontoError(konto.id, errMsg);
    scheduleReconnect(konto);
  }
}

/**
 * Schedule a reconnection with exponential backoff.
 */
function scheduleReconnect(konto: {
  id: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  benutzername: string;
  passwortEnc: string | null;
  oauthTokens: any;
  authTyp: string;
  initialSync: string;
  emailAdresse: string;
}): void {
  const managed = connections.get(konto.id);
  if (!managed) return;

  // Clear existing timer
  if (managed.reconnectTimer) {
    clearTimeout(managed.reconnectTimer);
  }

  managed.failCount++;
  const delay = Math.min(
    BASE_RECONNECT_DELAY * Math.pow(2, managed.failCount - 1),
    MAX_RECONNECT_DELAY
  );

  log.info(
    { kontoId: konto.id, failCount: managed.failCount, delayMs: delay },
    "Scheduling IMAP reconnect"
  );

  // Notify admin after consecutive failures
  if (managed.failCount >= ADMIN_NOTIFY_THRESHOLD) {
    notifyAdminConnectionFailure(konto.id, konto.emailAdresse, managed.failCount);
  }

  managed.reconnectTimer = setTimeout(async () => {
    try {
      await startImapConnection(konto);
    } catch (err) {
      log.error({ kontoId: konto.id, err }, "Reconnection attempt failed");
    }
  }, delay);
}

/**
 * Notify admin users about persistent connection failures.
 */
async function notifyAdminConnectionFailure(
  kontoId: string,
  emailAdresse: string,
  failCount: number
): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", aktiv: true },
      select: { id: true },
    });

    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: "email:connection-failure",
        title: "E-Mail-Verbindung fehlgeschlagen",
        message: `Postfach "${emailAdresse}" konnte ${failCount}x nicht verbunden werden.`,
        data: { kontoId, failCount },
      });
    }
  } catch (err) {
    log.warn({ err }, "Failed to notify admins about connection failure");
  }
}

/**
 * Update EmailKonto with error information.
 */
async function updateKontoError(kontoId: string, error: string): Promise<void> {
  try {
    // Get existing error log
    const konto = await prisma.emailKonto.findUnique({
      where: { id: kontoId },
      select: { fehlerLog: true },
    });

    const existingErrors = Array.isArray(konto?.fehlerLog)
      ? (konto.fehlerLog as any[])
      : [];

    const newErrors = [
      ...existingErrors,
      { timestamp: new Date().toISOString(), message: error },
    ].slice(-5); // Keep last 5 errors

    await prisma.emailKonto.update({
      where: { id: kontoId },
      data: {
        syncStatus: "FEHLER",
        fehlerLog: newErrors,
      },
    });
  } catch (err) {
    log.warn({ kontoId, err }, "Failed to update konto error status");
  }
}

/**
 * Stop an IMAP connection for a specific mailbox.
 */
export async function stopImapConnection(kontoId: string): Promise<void> {
  const managed = connections.get(kontoId);
  if (!managed) return;

  log.info({ kontoId }, "Stopping IMAP connection");

  // Stop monitoring
  stopIdleMonitoring(managed);

  // Clear reconnect timer
  if (managed.reconnectTimer) {
    clearTimeout(managed.reconnectTimer);
    managed.reconnectTimer = null;
  }

  // Close IMAP connection
  try {
    if (managed.client.usable) {
      await managed.client.logout();
    }
  } catch (err) {
    log.debug({ kontoId, err }, "Error during IMAP logout (ignored)");
  }

  connections.delete(kontoId);

  // Update status
  try {
    await prisma.emailKonto.update({
      where: { id: kontoId },
      data: { syncStatus: "GETRENNT" },
    });
  } catch {
    // Ignore DB errors during shutdown
  }
}

/**
 * Stop all active IMAP connections (graceful shutdown).
 */
export async function stopAllConnections(): Promise<void> {
  log.info({ count: connections.size }, "Stopping all IMAP connections");

  const stopPromises = Array.from(connections.keys()).map((kontoId) =>
    stopImapConnection(kontoId)
  );

  await Promise.allSettled(stopPromises);
  log.info("All IMAP connections stopped");
}

/**
 * Start IMAP connections for all active EmailKonto records.
 * Called at worker startup.
 */
export async function startImapConnections(): Promise<void> {
  log.info("Starting IMAP connections for all active mailboxes");

  try {
    const activeKonten = await prisma.emailKonto.findMany({
      where: { aktiv: true },
    });

    log.info({ count: activeKonten.length }, "Found active email accounts");

    for (const konto of activeKonten) {
      try {
        await startImapConnection(konto);
      } catch (err) {
        log.error(
          { kontoId: konto.id, err },
          "Failed to start IMAP connection for mailbox"
        );
      }
    }
  } catch (err) {
    log.error({ err }, "Failed to query active email accounts");
  }
}

/**
 * Get the managed connection for a kontoId (used by sync operations).
 */
export function getManagedConnection(kontoId: string): ManagedConnection | undefined {
  return connections.get(kontoId);
}

/**
 * Get the number of active connections.
 */
export function getConnectionCount(): number {
  return connections.size;
}
