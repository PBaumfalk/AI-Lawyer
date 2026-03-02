import type { UserRole } from "@prisma/client";
import { SpielKlasse } from "@prisma/client";

// ─── Quest Condition DSL ───────────────────────────────────────────────────

/** Models that quests can count against */
export type QuestModel = "KalenderEintrag" | "Ticket" | "Rechnung" | "AktenActivity";

/** Time period for quest evaluation */
export type QuestPeriod = "today" | "thisWeek" | "thisMonth";

/**
 * JSON DSL stored in Quest.bedingung (Prisma Json column).
 * Evaluator runs: prisma[model].count({ where: { ...where, [userField]: userId, [dateField]: dateRange } })
 */
export interface QuestCondition {
  model: QuestModel;
  where: Record<string, string | boolean>;
  dateField: string;
  userField: string | null; // null = scoped via relation (e.g., Rechnung -> Akte)
  count: number;
  period: QuestPeriod;
}

// ─── Role-to-Class Mapping ─────────────────────────────────────────────────

/** Map RBAC role to gamification class. Used at GameProfile creation. */
export function roleToKlasse(role: UserRole): SpielKlasse {
  switch (role) {
    case "ANWALT":         return SpielKlasse.JURIST;
    case "SACHBEARBEITER": return SpielKlasse.SCHREIBER;
    case "SEKRETARIAT":    return SpielKlasse.WAECHTER;
    case "ADMIN":          return SpielKlasse.QUARTIERMEISTER;
    default:               return SpielKlasse.SCHREIBER; // safe fallback
  }
}

// ─── XP/Level Constants ────────────────────────────────────────────────────

export const LEVEL_TIERS = [
  { maxLevel: 10, xpPerLevel: 300 },
  { maxLevel: 20, xpPerLevel: 500 },
  { maxLevel: Infinity, xpPerLevel: 800 },
] as const;

export const LEVEL_TITLES: { maxLevel: number; title: string }[] = [
  { maxLevel: 10, title: "Junior Workflow" },
  { maxLevel: 20, title: "Workflow Stabil" },
  { maxLevel: 30, title: "Backlog Controller" },
  { maxLevel: 40, title: "Billing Driver" },
  { maxLevel: Infinity, title: "Kanzlei-Operator" },
];

export const STREAK_BONUSES = [
  { minDays: 7, multiplier: 1.25 },   // +25% Runen
  { minDays: 3, multiplier: 1.10 },   // +10% Runen
] as const;
