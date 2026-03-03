/**
 * Shop Item Catalog
 *
 * Defines 18 purchasable items across 4 rarity tiers + 3 perks.
 * Each item has a stable `slug` for idempotent upsert seeding.
 * German legal/office fantasy theming consistent with quest naming.
 */

import { prisma } from "@/lib/db";
import { getSetting, updateSetting } from "@/lib/settings/service";
import { createLogger } from "@/lib/logger";

const log = createLogger("gamification-seed-shop");
const SEED_VERSION = "v0.4.2";
const SEED_SETTING_KEY = "gamification.shop_seed_version";

export interface ShopItemSeed {
  slug: string;
  name: string;
  beschreibung: string;
  typ: "AVATAR_RAHMEN" | "BANNER" | "PROFIL_TITEL" | "ABSCHLUSS_ANIMATION" | "PERK";
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  preis: number;
  sortierung: number;
  metadata: Record<string, unknown>;
}

// ─── Item Catalog ────────────────────────────────────────────────────────────

export const SHOP_ITEM_CATALOG: ShopItemSeed[] = [
  // ── COMMON (20 Runen) ─────────────────────────────────────────────────────
  {
    slug: "silber-rahmen",
    name: "Silber-Rahmen",
    beschreibung: "Ein schlichter silberner Ring um dein Profilbild",
    typ: "AVATAR_RAHMEN",
    rarity: "COMMON",
    preis: 20,
    sortierung: 1,
    metadata: { ringClass: "ring-2 ring-[oklch(75%_0.05_250)]" },
  },
  {
    slug: "pergament-banner",
    name: "Pergament-Banner",
    beschreibung: "Ein klassisches Pergament als Heldenkarten-Hintergrund",
    typ: "BANNER",
    rarity: "COMMON",
    preis: 20,
    sortierung: 2,
    metadata: { gradient: "from-amber-900/20 to-stone-800/10" },
  },
  {
    slug: "referendar-titel",
    name: "Referendar",
    beschreibung: "Zeige deinen Einstieg in die Kanzlei-Abenteuer",
    typ: "PROFIL_TITEL",
    rarity: "COMMON",
    preis: 20,
    sortierung: 3,
    metadata: { title: "Referendar" },
  },
  {
    slug: "funken-animation",
    name: "Funkenregen",
    beschreibung: "Kleine Funken bei Quest-Abschluss",
    typ: "ABSCHLUSS_ANIMATION",
    rarity: "COMMON",
    preis: 20,
    sortierung: 4,
    metadata: { animation: "sparkle" },
  },
  {
    slug: "fokus-siegel",
    name: "Fokus-Siegel",
    beschreibung: "Aktiviert 30 Minuten Fokuszeit im Kalender. Einmalverbrauch.",
    typ: "PERK",
    rarity: "COMMON",
    preis: 20,
    sortierung: 5,
    metadata: { perkType: "fokus-siegel", durationMinutes: 30 },
  },

  // ── RARE (50 Runen) ───────────────────────────────────────────────────────
  {
    slug: "azur-rahmen",
    name: "Azur-Rahmen",
    beschreibung: "Ein leuchtend blauer Ring fuer erfahrene Kanzlei-Helden",
    typ: "AVATAR_RAHMEN",
    rarity: "RARE",
    preis: 50,
    sortierung: 6,
    metadata: { ringClass: "ring-2 ring-[oklch(60%_0.15_250)]" },
  },
  {
    slug: "aktenwald-banner",
    name: "Aktenwald-Banner",
    beschreibung: "Ein mystischer Wald aus Aktenordnern",
    typ: "BANNER",
    rarity: "RARE",
    preis: 50,
    sortierung: 7,
    metadata: { gradient: "from-emerald-900/20 via-teal-800/15 to-cyan-900/10" },
  },
  {
    slug: "assessor-titel",
    name: "Assessor",
    beschreibung: "Fuer Helden die sich bewiesen haben",
    typ: "PROFIL_TITEL",
    rarity: "RARE",
    preis: 50,
    sortierung: 8,
    metadata: { title: "Assessor" },
  },
  {
    slug: "konfetti-animation",
    name: "Konfetti-Salut",
    beschreibung: "Buntes Konfetti bei Quest-Abschluss",
    typ: "ABSCHLUSS_ANIMATION",
    rarity: "RARE",
    preis: 50,
    sortierung: 9,
    metadata: { animation: "confetti" },
  },
  {
    slug: "streak-schutz",
    name: "Streak-Schutz",
    beschreibung: "Schuetzt deinen Streak vor dem naechsten verpassten Arbeitstag. Einmalverbrauch.",
    typ: "PERK",
    rarity: "RARE",
    preis: 50,
    sortierung: 10,
    metadata: { perkType: "streak-schutz" },
  },

  // ── EPIC (120 Runen) ──────────────────────────────────────────────────────
  {
    slug: "amethyst-rahmen",
    name: "Amethyst-Rahmen",
    beschreibung: "Ein violett schimmernder Ring fuer wahre Meister",
    typ: "AVATAR_RAHMEN",
    rarity: "EPIC",
    preis: 120,
    sortierung: 11,
    metadata: { ringClass: "ring-2 ring-[oklch(55%_0.2_300)]" },
  },
  {
    slug: "justiz-palast-banner",
    name: "Justizpalast-Banner",
    beschreibung: "Die Saeulen der Gerechtigkeit als Hintergrund",
    typ: "BANNER",
    rarity: "EPIC",
    preis: 120,
    sortierung: 12,
    metadata: { gradient: "from-purple-900/25 via-indigo-800/20 to-violet-900/15" },
  },
  {
    slug: "syndikus-titel",
    name: "Syndikus",
    beschreibung: "Titel fuer die Elite der Kanzlei",
    typ: "PROFIL_TITEL",
    rarity: "EPIC",
    preis: 120,
    sortierung: 13,
    metadata: { title: "Syndikus" },
  },
  {
    slug: "feuerwerk-animation",
    name: "Feuerwerk",
    beschreibung: "Praechtiges Feuerwerk bei Quest-Abschluss",
    typ: "ABSCHLUSS_ANIMATION",
    rarity: "EPIC",
    preis: 120,
    sortierung: 14,
    metadata: { animation: "fireworks" },
  },
  {
    slug: "doppel-runen",
    name: "Doppel-Runen",
    beschreibung: "2 Stunden lang doppelte Runen-Belohnung. Einmalverbrauch.",
    typ: "PERK",
    rarity: "EPIC",
    preis: 120,
    sortierung: 15,
    metadata: { perkType: "doppel-runen", durationHours: 2 },
  },

  // ── LEGENDARY (300 Runen) ─────────────────────────────────────────────────
  {
    slug: "gold-rahmen",
    name: "Goldener Rahmen",
    beschreibung: "Der legendaere goldene Ring -- nur fuer die Wuerdigsten",
    typ: "AVATAR_RAHMEN",
    rarity: "LEGENDARY",
    preis: 300,
    sortierung: 16,
    metadata: { ringClass: "ring-2 ring-[oklch(75%_0.18_85)] shadow-lg shadow-amber-500/20" },
  },
  {
    slug: "paragraphen-banner",
    name: "Paragraphen-Sanctum",
    beschreibung: "Ein goldenes Heiligtum der Paragraphen",
    typ: "BANNER",
    rarity: "LEGENDARY",
    preis: 300,
    sortierung: 17,
    metadata: { gradient: "from-amber-600/30 via-yellow-500/20 to-orange-700/15" },
  },
  {
    slug: "kanzleipartner-titel",
    name: "Kanzleipartner",
    beschreibung: "Der hoechste Titel in der Kanzlei -- Legende",
    typ: "PROFIL_TITEL",
    rarity: "LEGENDARY",
    preis: 300,
    sortierung: 18,
    metadata: { title: "Kanzleipartner" },
  },
];

// ─── Seed Function ───────────────────────────────────────────────────────────

/**
 * Seed all shop items. Idempotent via SystemSetting version guard.
 * Follows the same pattern as seedQuests() in seed-quests.ts.
 */
export async function seedShopItems(): Promise<void> {
  const currentVersion = await getSetting(SEED_SETTING_KEY);
  if (currentVersion === SEED_VERSION) {
    return;
  }

  log.info("Seeding shop items...");

  for (const item of SHOP_ITEM_CATALOG) {
    await prisma.shopItem.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        beschreibung: item.beschreibung,
        typ: item.typ,
        rarity: item.rarity,
        preis: item.preis,
        sortierung: item.sortierung,
        metadata: item.metadata,
      },
      create: {
        slug: item.slug,
        name: item.name,
        beschreibung: item.beschreibung,
        typ: item.typ,
        rarity: item.rarity,
        preis: item.preis,
        sortierung: item.sortierung,
        metadata: item.metadata,
      },
    });
  }

  await updateSetting(SEED_SETTING_KEY, SEED_VERSION);
  log.info(`Shop items seeded successfully (version ${SEED_VERSION})`);
}
