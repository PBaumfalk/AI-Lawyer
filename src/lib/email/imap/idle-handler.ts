/**
 * IDLE lifecycle management for IMAP connections.
 * Provides periodic NOOP heartbeat to detect dead connections.
 */

import type { ManagedConnection } from "@/lib/email/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("imap:idle");

/** Heartbeat interval: 4 minutes (NOOP before most servers' 5-min IDLE timeout) */
const HEARTBEAT_INTERVAL = 4 * 60 * 1000;

/**
 * Start periodic NOOP heartbeat monitoring for an IMAP connection.
 * Sends NOOP every 4 minutes to keep the connection alive and detect dead sockets.
 *
 * @param managed - The managed connection to monitor
 */
export function startIdleMonitoring(managed: ManagedConnection): void {
  // Clear any existing heartbeat
  stopIdleMonitoring(managed);

  managed.heartbeatTimer = setInterval(async () => {
    try {
      // ImapFlow's NOOP keeps the connection alive
      // If the connection is dead, this will throw and trigger reconnection
      if (managed.client.usable) {
        await managed.client.noop();
        log.debug({ kontoId: managed.kontoId }, "NOOP heartbeat sent");
      }
    } catch (err) {
      log.warn(
        { kontoId: managed.kontoId, err },
        "NOOP heartbeat failed — connection may be dead"
      );
      // The "close" event handler on the client will trigger reconnection
    }
  }, HEARTBEAT_INTERVAL);

  log.debug(
    { kontoId: managed.kontoId, intervalMs: HEARTBEAT_INTERVAL },
    "IDLE monitoring started"
  );
}

/**
 * Stop the heartbeat monitoring for an IMAP connection.
 *
 * @param managed - The managed connection to stop monitoring
 */
export function stopIdleMonitoring(managed: ManagedConnection): void {
  if (managed.heartbeatTimer) {
    clearInterval(managed.heartbeatTimer);
    managed.heartbeatTimer = null;
    log.debug({ kontoId: managed.kontoId }, "IDLE monitoring stopped");
  }
}
