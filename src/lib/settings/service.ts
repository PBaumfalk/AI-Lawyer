import { prisma } from "@/lib/db";
import { createRedisConnection } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { SystemSetting } from "@prisma/client";

const log = createLogger("settings");

/**
 * Get a single setting value by key.
 * Returns null if the setting does not exist.
 */
export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  return setting?.value ?? null;
}

/**
 * Get a typed setting value with a default fallback.
 * Parses the stored string value based on the setting's type field.
 */
export async function getSettingTyped<T>(
  key: string,
  defaultValue: T
): Promise<T> {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  if (!setting) return defaultValue;

  try {
    switch (setting.type) {
      case "number":
        return parseInt(setting.value, 10) as T;
      case "boolean":
        return (setting.value === "true") as T;
      case "json":
        return JSON.parse(setting.value) as T;
      default:
        return setting.value as T;
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
  value: string
): Promise<void> {
  // Find the default to get type and category
  const def = DEFAULT_SETTINGS.find((d) => d.key === key);

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: {
      key,
      value,
      type: def?.type ?? "string",
      category: def?.category ?? "general",
      label: def?.label ?? key,
    },
  });

  // Publish change to Redis so worker picks it up immediately
  let publisher: ReturnType<typeof createRedisConnection> | null = null;
  try {
    publisher = createRedisConnection();
    await publisher.publish(
      "settings:changed",
      JSON.stringify({ key, value })
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
          value: def.value,
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
