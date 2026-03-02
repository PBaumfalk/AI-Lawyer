import { prisma } from "@/lib/db";
import { getSetting, updateSetting } from "@/lib/settings/service";
import { createLogger } from "@/lib/logger";
import type { QuestCondition } from "./types";

const log = createLogger("gamification-seed");
const SEED_VERSION = "v0.4";
const SEED_SETTING_KEY = "gamification.quests_seed_version";

interface QuestSeedData {
  name: string;
  beschreibung: string;
  typ: "DAILY";
  bedingung: QuestCondition;
  xpBelohnung: number;
  runenBelohnung: number;
  sortierung: number;
}

const DAILY_QUESTS: QuestSeedData[] = [
  {
    name: "Die Siegel des Tages",
    beschreibung: "Erledige 3 Fristen",
    typ: "DAILY",
    bedingung: {
      model: "KalenderEintrag",
      where: { erledigt: true, typ: "FRIST" },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      count: 3,
      period: "today",
    },
    xpBelohnung: 80,
    runenBelohnung: 8,
    sortierung: 1,
  },
  {
    name: "Die Chroniken entwirren",
    beschreibung: "Erledige 3 Wiedervorlagen",
    typ: "DAILY",
    bedingung: {
      model: "Ticket",
      where: { status: "ERLEDIGT" },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      count: 3,
      period: "today",
    },
    xpBelohnung: 60,
    runenBelohnung: 12,
    sortierung: 2,
  },
  {
    name: "Praegung der Muenzen",
    beschreibung: "Erstelle 2 Rechnungen",
    typ: "DAILY",
    bedingung: {
      model: "Rechnung",
      where: {},
      dateField: "createdAt",
      userField: null,
      count: 2,
      period: "today",
    },
    xpBelohnung: 60,
    runenBelohnung: 10,
    sortierung: 3,
  },
  {
    name: "Ordnung im Skriptorium",
    beschreibung: "Aktualisiere 3 Akten",
    typ: "DAILY",
    bedingung: {
      model: "AktenActivity",
      where: {},
      dateField: "createdAt",
      userField: "userId",
      count: 3,
      period: "today",
    },
    xpBelohnung: 40,
    runenBelohnung: 5,
    sortierung: 4,
  },
  {
    name: "Bote der Klarheit",
    beschreibung: "Beantworte 2 Tickets",
    typ: "DAILY",
    bedingung: {
      model: "Ticket",
      where: { status: "ERLEDIGT" },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      count: 2,
      period: "today",
    },
    xpBelohnung: 30,
    runenBelohnung: 4,
    sortierung: 5,
  },
];

/**
 * Seed 5 daily quests. Idempotent via SystemSetting version guard.
 * Follows the exact pattern from seedFalldatenTemplates.
 */
export async function seedDailyQuests(): Promise<void> {
  const currentVersion = await getSetting(SEED_SETTING_KEY);
  if (currentVersion === SEED_VERSION) {
    return;
  }

  log.info("Seeding daily quests...");

  for (const quest of DAILY_QUESTS) {
    await prisma.quest.upsert({
      where: { name_typ: { name: quest.name, typ: quest.typ } },
      create: {
        name: quest.name,
        beschreibung: quest.beschreibung,
        typ: quest.typ,
        bedingung: quest.bedingung as unknown as Record<string, unknown>,
        xpBelohnung: quest.xpBelohnung,
        runenBelohnung: quest.runenBelohnung,
        sortierung: quest.sortierung,
        aktiv: true,
      },
      update: {
        beschreibung: quest.beschreibung,
        bedingung: quest.bedingung as unknown as Record<string, unknown>,
        xpBelohnung: quest.xpBelohnung,
        runenBelohnung: quest.runenBelohnung,
        sortierung: quest.sortierung,
      },
    });
  }

  await updateSetting(SEED_SETTING_KEY, SEED_VERSION);
  log.info(`Daily quests seeded successfully (version ${SEED_VERSION})`);
}
