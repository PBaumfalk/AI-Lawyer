/** Boss name pool (German legal/office themed) */
export const BOSS_NAMES = [
  "Der Aktenberg",
  "Fristenfresser",
  "Backlog-Krake",
  "Papierdrache",
  "Der Paragraphenwurm",
  "Terminmonster",
  "Aktenstaub-Golem",
] as const;

/** Lucide icon name per boss phase */
export const PHASE_ICONS = {
  1: "Bug",
  2: "Flame",
  3: "Skull",
  4: "Swords",
} as const;

/** Phase transition thresholds (checked from highest to lowest) */
export const PHASE_THRESHOLDS = [
  { phase: 4, hpFraction: 0.25 },
  { phase: 3, hpFraction: 0.50 },
  { phase: 2, hpFraction: 0.75 },
] as const;

/** Per-hit Runen multiplier per boss phase */
export const PHASE_RUNEN_MULTIPLIER: Record<number, number> = {
  1: 1.0,
  2: 1.5,
  3: 2.0,
  4: 3.0,
};

/** Base Runen earned per WV clear during an active bossfight */
export const BASE_HIT_RUNEN = 5;

/** Team-wide bonus Runen at each phase transition */
export const PHASE_TRANSITION_BONUS: Record<number, number> = {
  2: 20,
  3: 40,
  4: 80,
};

/** Victory rewards */
export const VICTORY_XP_BONUS = 500;
export const VICTORY_RUNEN_BONUS = 100;

/** Default boss config */
export const DEFAULT_BOSS_THRESHOLD = 30;
export const DEFAULT_BOSS_COOLDOWN_HOURS = 24;

/**
 * Calculate the boss phase based on current HP fraction.
 * Phase 4 at <=25%, Phase 3 at <=50%, Phase 2 at <=75%, Phase 1 otherwise.
 */
export function calculatePhase(currentHp: number, spawnHp: number): number {
  if (spawnHp <= 0) return 1;
  const fraction = currentHp / spawnHp;
  for (const threshold of PHASE_THRESHOLDS) {
    if (fraction <= threshold.hpFraction) return threshold.phase;
  }
  return 1;
}
