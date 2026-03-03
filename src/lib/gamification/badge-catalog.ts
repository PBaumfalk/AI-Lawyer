/**
 * Badge Catalog
 *
 * Defines 8 curated achievement badges with threshold conditions.
 * Each badge has a stable `slug` for persistent tracking in the
 * UserGameProfile badges JSON array.
 *
 * Badge types:
 *   - "count"   : Count rows in a Prisma model (with optional aggregation)
 *   - "streak"  : Check streakTage on UserGameProfile
 *   - "trophy"  : Check trophies JSON array on UserGameProfile
 *
 * Special where markers (interpreted by badge-service, not passed to Prisma):
 *   - _aggregate : Field name for aggregate sum query
 *   - _sum       : Boolean flag for sum aggregation
 *   - _distinct  : Field name for distinct count query
 */

export interface BadgeDefinition {
  slug: string;
  name: string;
  beschreibung: string;
  icon: string; // Lucide icon name
  type: "count" | "streak" | "trophy";
  /** For "count" type: Prisma model name */
  model?: string;
  /** For "count" type: Prisma where clause (may contain special markers) */
  where?: Record<string, unknown>;
  /** Threshold to earn badge */
  threshold: number;
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  {
    slug: "fristenwaechter",
    name: "Fristenwaechter",
    beschreibung: "50 Fristen fristgerecht erledigt",
    icon: "Clock",
    type: "count",
    model: "KalenderEintrag",
    where: { typ: "FRIST", erledigt: true },
    threshold: 50,
  },
  {
    slug: "aktenkoenig",
    name: "Aktenkoenig",
    beschreibung: "100 Akten-Aktivitaeten erstellt",
    icon: "FolderOpen",
    type: "count",
    model: "AktenActivity",
    where: {},
    threshold: 100,
  },
  {
    slug: "streak-meister",
    name: "Streak-Meister",
    beschreibung: "30-Tage Streak erreicht",
    icon: "Flame",
    type: "streak",
    threshold: 30,
  },
  {
    slug: "bannbrecher",
    name: "Bannbrecher",
    beschreibung: "Einen Boss besiegt",
    icon: "Swords",
    type: "trophy",
    threshold: 1,
  },
  {
    slug: "quester",
    name: "Quester",
    beschreibung: "100 Quests abgeschlossen",
    icon: "ScrollText",
    type: "count",
    model: "QuestCompletion",
    where: {},
    threshold: 100,
  },
  {
    slug: "dauerbrenner",
    name: "Dauerbrenner",
    beschreibung: "7-Tage Streak erreicht",
    icon: "Zap",
    type: "streak",
    threshold: 7,
  },
  {
    slug: "runensammler",
    name: "Runensammler",
    beschreibung: "500 Runen insgesamt verdient",
    icon: "Gem",
    type: "count",
    model: "QuestCompletion",
    where: { _aggregate: "runenVerdient", _sum: true },
    threshold: 500,
  },
  {
    slug: "teamkaempfer",
    name: "Teamkaempfer",
    beschreibung: "An 3 Bossfights teilgenommen",
    icon: "Shield",
    type: "count",
    model: "BossfightDamage",
    where: { _distinct: "bossfightId" },
    threshold: 3,
  },
];
