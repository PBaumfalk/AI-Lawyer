import { prisma } from "@/lib/db";
import { createRedisConnection } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { SystemSetting } from "@prisma/client";
import { encryptCredential, decryptCredential } from "@/lib/email/crypto";

const log = createLogger("settings");

// ---------------------------------------------------------------------------
// Secret settings
// ---------------------------------------------------------------------------

const SECRET_PREFIX = "enc:v1:";

export function isSecretSetting(key: string): boolean {
  return DEFAULT_SETTINGS.some((d) => d.key === key && d.secret === true);
}

/** Encrypt a secret setting value for storage. Non-secrets pass through. */
export function sealSettingValue(key: string, value: string): string {
  if (!isSecretSetting(key) || value === "" || value.startsWith(SECRET_PREFIX)) return value;
  return SECRET_PREFIX + encryptCredential(value);
}

/** Decrypt a stored value. Legacy plaintext secrets are returned unchanged. */
export function openSettingValue(key: string, stored: string): string {
  if (!stored.startsWith(SECRET_PREFIX)) return stored;
  try {
    return decryptCredential(stored.slice(SECRET_PREFIX.length));
  } catch (err) {
    log.error({ key, err }, "Secret setting could not be decrypted (EMAIL_ENCRYPTION_KEY changed?)");
    return "";
  }
}

/** Setting as shown to clients: secrets are blanked, `secretSet` tells whether one is stored. */
export function redactSetting<T extends { key: string; value: string }>(
  s: T
): T & { secret?: boolean; secretSet?: boolean } {
  if (!isSecretSetting(s.key)) return s;
  return { ...s, value: "", secret: true, secretSet: s.value !== "" };
}

// ---------------------------------------------------------------------------
// In-memory settings cache with TTL (avoids repeated DB roundtrips)
// ---------------------------------------------------------------------------

/** Cache TTL in milliseconds (30 seconds) */
const SETTINGS_CACHE_TTL = 30_000;

interface CacheEntry {
  setting: SystemSetting | null;
  expiresAt: number;
}

const settingsCache = new Map<string, CacheEntry>();

/**
 * Get a cached setting, fetching from DB only if cache is empty or expired.
 */
async function getCachedSetting(key: string): Promise<SystemSetting | null> {
  const now = Date.now();
  const cached = settingsCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.setting;
  }

  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  settingsCache.set(key, { setting, expiresAt: now + SETTINGS_CACHE_TTL });
  return setting;
}

/**
 * Invalidate the settings cache for a specific key or all keys.
 */
export function invalidateSettingsCache(key?: string): void {
  if (key) {
    settingsCache.delete(key);
  } else {
    settingsCache.clear();
  }
}

/**
 * Get a single setting value by key.
 * Returns null if the setting does not exist.
 */
export async function getSetting(key: string): Promise<string | null> {
  const setting = await getCachedSetting(key);
  return setting ? openSettingValue(key, setting.value) : null;
}

/**
 * Get a typed setting value with a default fallback.
 * Parses the stored string value based on the setting's type field.
 */
export async function getSettingTyped<T>(
  key: string,
  defaultValue: T
): Promise<T> {
  const setting = await getCachedSetting(key);
  if (!setting) return defaultValue;
  const value = openSettingValue(key, setting.value);

  try {
    switch (setting.type) {
      case "number": {
        const n = parseInt(value, 10);
        return (Number.isFinite(n) ? n : defaultValue) as T;
      }
      case "boolean":
        return (value === "true") as T;
      case "json":
        return JSON.parse(value) as T;
      default:
        return value as T;
    }
  } catch (err) {
    log.warn({ key, err }, "Failed to parse setting value, returning default");
    return defaultValue;
  }
}

/**
 * Get all settings ordered by category, then key.
 */
export async function getAllSettings(): Promise<SystemSetting[]> {
  return prisma.systemSetting.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });
}

/**
 * Update a single setting value.
 * Upserts in the database and publishes a change notification via Redis pub/sub
 * so the worker process picks up the change within seconds.
 */
export async function updateSetting(
  key: string,
  value: string,
  meta?: { type?: string; category?: string; label?: string }
): Promise<void> {
  // Find the default to get type and category
  const def = DEFAULT_SETTINGS.find((d) => d.key === key);

  // Empty secret = "unchanged": the browser never sees the stored secret, so
  // it sends "" back when the admin did not type a new one.
  if (isSecretSetting(key) && value === "") return;
  const stored = sealSettingValue(key, value);

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: stored },
    create: {
      key,
      value: stored,
      type: def?.type ?? meta?.type ?? "string",
      category: def?.category ?? meta?.category ?? "general",
      label: def?.label ?? meta?.label ?? key,
    },
  });

  // Invalidate cache for this key so next read picks up the new value
  invalidateSettingsCache(key);

  // Publish change to Redis so worker picks it up immediately
  let publisher: ReturnType<typeof createRedisConnection> | null = null;
  try {
    publisher = createRedisConnection();
    await publisher.publish(
      "settings:changed",
      // Secrets are not published; listeners re-read them from the DB.
      JSON.stringify(isSecretSetting(key) ? { key } : { key, value })
    );
    log.info({ key }, "Setting updated and published");
  } catch (err) {
    log.error({ key, err }, "Failed to publish setting change to Redis");
  } finally {
    if (publisher) {
      publisher.disconnect();
    }
  }
}

/**
 * Initialize default settings in the database.
 * Only inserts settings that do not already exist (preserves user overrides).
 * Should be called at application startup.
 */
/**
 * Start values from the environment for the very first start. setup.sh asks
 * for the AI provider and key and writes them to .env; without this bridge
 * that choice was silently ignored (the code only reads SystemSetting).
 * Only used when the setting does not exist yet: afterwards the UI wins.
 */
export function bootstrapValueFromEnv(key: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const provider = (env.AI_PROVIDER || "").trim().toLowerCase();
  switch (key) {
    case "ai.provider":
      return ["ollama", "openai", "anthropic"].includes(provider) ? provider : undefined;
    case "ai.provider.model":
      return env.AI_MODEL?.trim() || undefined;
    case "ai.provider.apiKey":
      if (provider === "openai") return env.OPENAI_API_KEY?.trim() || undefined;
      if (provider === "anthropic") return env.ANTHROPIC_API_KEY?.trim() || undefined;
      return undefined;
    default:
      return undefined;
  }
}

export async function initializeDefaults(): Promise<void> {
  let created = 0;
  for (const def of DEFAULT_SETTINGS) {
    const existing = await prisma.systemSetting.findUnique({
      where: { key: def.key },
    });
    if (!existing) {
      await prisma.systemSetting.create({
        data: {
          key: def.key,
          value: sealSettingValue(def.key, bootstrapValueFromEnv(def.key) ?? def.value),
          type: def.type,
          category: def.category,
          label: def.label,
        },
      });
      created++;
    }
  }

  if (created > 0) {
    log.info({ count: created }, "Default settings initialized");
  }
}
