import type { UserRole } from "@prisma/client";
import { SpielKlasse } from "@prisma/client";

// ─── Quest Condition DSL ───────────────────────────────────────────────────

/** Models that quests can count against */
export type QuestModel = "KalenderEintrag" | "Ticket" | "Rechnung" | "AktenActivity";

/** Time period for quest evaluation */
export type QuestPeriod = "today" | "thisWeek" | "thisMonth" | "campaign";

/** Base quest condition fields shared by all condition types */
interface BaseQuestCondition {
  model: QuestModel;
  where: Record<string, string | boolean>;
  dateField: string;
  userField: string | null; // null = scoped via relation (e.g., Rechnung -> Akte)
  period: QuestPeriod;
}

/** Standard count-based condition (original and default) */
export interface CountCondition extends BaseQuestCondition {
  type?: "count"; // Optional for backward compat with existing quests
  count: number;
}

/** Delta/ratio condition for weekly aggregate goals */
export interface DeltaCondition extends BaseQuestCondition {
  type: "delta";
  direction: "decrease" | "increase";
  percent: number; // e.g. 20 for "reduce by 20%"
}

/**
 * Union of all condition types.
 * JSON DSL stored in Quest.bedingung (Prisma Json column).
 * The evaluator branches on `type` ("count" | "delta"), treating undefined as "count".
 */
export type QuestCondition = CountCondition | DeltaCondition;

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

// ─── Audit / Anti-Missbrauch ─────────────────────────────────────────────────

/** Mirrors Prisma AuditStatus enum for use outside of @prisma/client imports */
export type AuditStatusType = "NONE" | "PENDING" | "CONFIRMED" | "DECLINED";

/** Bonus Runen awarded when a follow-up WV is created on the same day */
export const FOLLOW_UP_WV_BONUS_RUNEN = 5;

// ─── Boss Trophy ────────────────────────────────────────────────────────────

export interface BossTrophy {
  type: "BOSS_VICTORY";
  bossName: string;
  date: string;       // ISO date string
  bossfightId: string;
}

// ─── Shop Types ─────────────────────────────────────────────────────────
export type ShopItemRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
export type ShopItemTyp = "AVATAR_RAHMEN" | "BANNER" | "PROFIL_TITEL" | "ABSCHLUSS_ANIMATION" | "PERK";

export const RARITY_LABELS: Record<ShopItemRarity, string> = {
  COMMON: "Gewoehnlich",
  RARE: "Selten",
  EPIC: "Episch",
  LEGENDARY: "Legendaer",
};

export const RARITY_COLORS: Record<ShopItemRarity, string> = {
  COMMON: "text-zinc-400",
  RARE: "text-blue-400",
  EPIC: "text-purple-400",
  LEGENDARY: "text-amber-400",
};

export const ITEM_TYP_LABELS: Record<ShopItemTyp, string> = {
  AVATAR_RAHMEN: "Avatar-Rahmen",
  BANNER: "Banner",
  PROFIL_TITEL: "Profil-Titel",
  ABSCHLUSS_ANIMATION: "Abschluss-Animation",
  PERK: "Perk",
};

export const LEGENDARY_LEVEL_GATE = 25;
