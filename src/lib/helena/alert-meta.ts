/**
 * Auto-resolution data stored in HelenaAlert.meta by the scanner and shown by
 * the alert UI (alert center, Akte alerts section). Single source for the key
 * names: the UI read `resolveReason` while the scanner wrote `resolvedReason`.
 */
export interface AlertResolution {
  resolvedAt: string;
  resolvedReason: string;
}

/** Meta object with the resolution merged in (scanner side). */
export function withResolution(
  meta: Record<string, unknown> | null | undefined,
  reason: string,
  at: Date = new Date()
): Record<string, unknown> & AlertResolution {
  return { ...(meta ?? {}), resolvedAt: at.toISOString(), resolvedReason: reason };
}

/** Resolution info if the alert was auto-resolved (UI side). */
export function readResolution(meta: unknown): { resolvedAt: string; reason: string | null } | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const m = meta as Record<string, unknown>;
  if (typeof m.resolvedAt !== "string") return null;
  return { resolvedAt: m.resolvedAt, reason: typeof m.resolvedReason === "string" ? m.resolvedReason : null };
}
