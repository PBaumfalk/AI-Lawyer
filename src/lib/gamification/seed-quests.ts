import { prisma } from "@/lib/db";
import { getSetting, updateSetting } from "@/lib/settings/service";
import { createLogger } from "@/lib/logger";
import type { QuestCondition } from "./types";

const log = createLogger("gamification-seed");
const SEED_VERSION = "v0.4.1";
const SEED_SETTING_KEY = "gamification.quests_seed_version";

interface QuestSeedData {
  name: string;
  beschreibung: string;
  typ: "DAILY" | "WEEKLY";
  klasse?: "JURIST" | "SCHREIBER" | "WAECHTER" | "QUARTIERMEISTER" | null;
  bedingung: QuestCondition;
  xpBelohnung: number;
  runenBelohnung: number;
  sortierung: number;
}

// ─── Daily Quests ─────────────────────────────────────────────────────────

const DAILY_QUESTS: QuestSeedData[] = [
  // Universal quests (all classes)
  {
    name: "Die Chroniken entwirren",
    beschreibung: "Erledige 3 Wiedervorlagen",
    typ: "DAILY",
    klasse: null,
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
    sortierung: 1,
  },
  {
    name: "Ordnung im Skriptorium",
    beschreibung: "Aktualisiere 3 Akten",
    typ: "DAILY",
    klasse: null,
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
    sortierung: 2,
  },

  // JURIST (ANWALT) quests -- Fristen and legal work focused
  {
    name: "Die Siegel des Tages",
    beschreibung: "Erledige 3 Fristen",
    typ: "DAILY",
    klasse: "JURIST",
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
    sortierung: 3,
  },
  {
    name: "Richterspruch studieren",
    beschreibung: "Bearbeite 2 Wiedervorlagen mit Vermerk",
    typ: "DAILY",
    klasse: "JURIST",
    bedingung: {
      model: "Ticket",
      where: { status: "ERLEDIGT" },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      count: 2,
      period: "today",
    },
    xpBelohnung: 50,
    runenBelohnung: 6,
    sortierung: 4,
  },
  {
    name: "Akte des Tages",
    beschreibung: "Aktualisiere 2 Akten",
    typ: "DAILY",
    klasse: "JURIST",
    bedingung: {
      model: "AktenActivity",
      where: {},
      dateField: "createdAt",
      userField: "userId",
      count: 2,
      period: "today",
    },
    xpBelohnung: 30,
    runenBelohnung: 4,
    sortierung: 5,
  },

  // SCHREIBER (SACHBEARBEITER) quests -- billing and document focused
  {
    name: "Praegung der Muenzen",
    beschreibung: "Erstelle 2 Rechnungen",
    typ: "DAILY",
    klasse: "SCHREIBER",
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
    sortierung: 6,
  },
  {
    name: "Schriftrolle verfassen",
    beschreibung: "Aktualisiere 3 Akten",
    typ: "DAILY",
    klasse: "SCHREIBER",
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
    sortierung: 7,
  },
  {
    name: "Buchhalters Pflicht",
    beschreibung: "Erledige 2 Wiedervorlagen",
    typ: "DAILY",
    klasse: "SCHREIBER",
    bedingung: {
      model: "Ticket",
      where: { status: "ERLEDIGT" },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      count: 2,
      period: "today",
    },
    xpBelohnung: 40,
    runenBelohnung: 5,
    sortierung: 8,
  },

  // WAECHTER (SEKRETARIAT) quests -- calendar and organization focused
  {
    name: "Bote der Klarheit",
    beschreibung: "Beantworte 2 Tickets",
    typ: "DAILY",
    klasse: "WAECHTER",
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
    sortierung: 9,
  },
  {
    name: "Wacht am Kalender",
    beschreibung: "Erledige 2 Kalendereintraege",
    typ: "DAILY",
    klasse: "WAECHTER",
    bedingung: {
      model: "KalenderEintrag",
      where: { erledigt: true },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      count: 2,
      period: "today",
    },
    xpBelohnung: 40,
    runenBelohnung: 5,
    sortierung: 10,
  },
  {
    name: "Inventar der Archive",
    beschreibung: "Aktualisiere 2 Akten",
    typ: "DAILY",
    klasse: "WAECHTER",
    bedingung: {
      model: "AktenActivity",
      where: {},
      dateField: "createdAt",
      userField: "userId",
      count: 2,
      period: "today",
    },
    xpBelohnung: 30,
    runenBelohnung: 4,
    sortierung: 11,
  },

  // QUARTIERMEISTER (ADMIN) quests -- oversight and management focused
  {
    name: "Inspektion der Festung",
    beschreibung: "Aktualisiere 3 Akten",
    typ: "DAILY",
    klasse: "QUARTIERMEISTER",
    bedingung: {
      model: "AktenActivity",
      where: {},
      dateField: "createdAt",
      userField: "userId",
      count: 3,
      period: "today",
    },
    xpBelohnung: 50,
    runenBelohnung: 6,
    sortierung: 12,
  },
  {
    name: "Versiegelung der Buendnisse",
    beschreibung: "Erledige 2 Wiedervorlagen",
    typ: "DAILY",
    klasse: "QUARTIERMEISTER",
    bedingung: {
      model: "Ticket",
      where: { status: "ERLEDIGT" },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      count: 2,
      period: "today",
    },
    xpBelohnung: 40,
    runenBelohnung: 5,
    sortierung: 13,
  },
  {
    name: "Tributeinzug",
    beschreibung: "Erstelle 1 Rechnung",
    typ: "DAILY",
    klasse: "QUARTIERMEISTER",
    bedingung: {
      model: "Rechnung",
      where: {},
      dateField: "createdAt",
      userField: null,
      count: 1,
      period: "today",
    },
    xpBelohnung: 40,
    runenBelohnung: 5,
    sortierung: 14,
  },
];

// ─── Weekly Quests ────────────────────────────────────────────────────────

const WEEKLY_QUESTS: QuestSeedData[] = [
  {
    name: "Backlog-Bezwinger",
    beschreibung: "Reduziere offene Tickets um 20%",
    typ: "WEEKLY",
    klasse: null,
    bedingung: {
      type: "delta",
      model: "Ticket",
      where: { status: "OFFEN" },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      period: "thisWeek",
      direction: "decrease",
      percent: 20,
    } as unknown as QuestCondition,
    xpBelohnung: 200,
    runenBelohnung: 25,
    sortierung: 1,
  },
  {
    name: "Fristenwaechter",
    beschreibung: "Reduziere offene Fristen um 15%",
    typ: "WEEKLY",
    klasse: "JURIST",
    bedingung: {
      type: "delta",
      model: "KalenderEintrag",
      where: { erledigt: false, typ: "FRIST" },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      period: "thisWeek",
      direction: "decrease",
      percent: 15,
    } as unknown as QuestCondition,
    xpBelohnung: 250,
    runenBelohnung: 30,
    sortierung: 2,
  },
  {
    name: "Wochenabrechnung",
    beschreibung: "Erstelle 5 Rechnungen diese Woche",
    typ: "WEEKLY",
    klasse: "SCHREIBER",
    bedingung: {
      model: "Rechnung",
      where: {},
      dateField: "createdAt",
      userField: null,
      count: 5,
      period: "thisWeek",
    },
    xpBelohnung: 200,
    runenBelohnung: 25,
    sortierung: 3,
  },
];

// ─── All Quest Seeds ──────────────────────────────────────────────────────

const ALL_QUESTS: QuestSeedData[] = [...DAILY_QUESTS, ...WEEKLY_QUESTS];

/**
 * Seed all quests (daily + weekly). Idempotent via SystemSetting version guard.
 * Follows the exact pattern from seedFalldatenTemplates.
 */
export async function seedQuests(): Promise<void> {
  const currentVersion = await getSetting(SEED_SETTING_KEY);
  if (currentVersion === SEED_VERSION) {
    return;
  }

  log.info("Seeding quests...");

  for (const quest of ALL_QUESTS) {
    await prisma.quest.upsert({
      where: { name_typ: { name: quest.name, typ: quest.typ } },
      create: {
        name: quest.name,
        beschreibung: quest.beschreibung,
        typ: quest.typ,
        klasse: quest.klasse ?? null,
        bedingung: quest.bedingung as unknown as Record<string, unknown>,
        xpBelohnung: quest.xpBelohnung,
        runenBelohnung: quest.runenBelohnung,
        sortierung: quest.sortierung,
        aktiv: true,
      },
      update: {
        beschreibung: quest.beschreibung,
        klasse: quest.klasse ?? null,
        bedingung: quest.bedingung as unknown as Record<string, unknown>,
        xpBelohnung: quest.xpBelohnung,
        runenBelohnung: quest.runenBelohnung,
        sortierung: quest.sortierung,
      },
    });
  }

  await updateSetting(SEED_SETTING_KEY, SEED_VERSION);
  log.info(`Quests seeded successfully (version ${SEED_VERSION})`);
}

/** Backward compat alias */
export const seedDailyQuests = seedQuests;
