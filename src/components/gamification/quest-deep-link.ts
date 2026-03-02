/**
 * Quest Deep-Link Builder
 *
 * Maps QuestCondition model + where-clause to a navigable route with
 * query params. Used by QuestWidget to make each quest row clickable.
 *
 * Convention-based mapping:
 *   KalenderEintrag -> /kalender
 *   Ticket          -> /tickets
 *   Rechnung        -> /finanzen/rechnungen
 *   AktenActivity   -> /akten
 */

import type { QuestCondition, QuestModel } from "@/lib/gamification/types";

const MODEL_TO_PATH: Record<QuestModel, string> = {
  KalenderEintrag: "/kalender",
  Ticket: "/tickets",
  Rechnung: "/finanzen/rechnungen",
  AktenActivity: "/akten",
};

/**
 * Build a navigable deep-link URL from a quest condition.
 *
 * Extracts the base path from the model, adds relevant query params
 * from condition.where fields (typ, status, erledigt), and adds
 * datum=heute for today-period quests.
 *
 * @returns Route path with query string, e.g. "/kalender?typ=FRIST&datum=heute"
 */
export function buildQuestDeepLink(condition: QuestCondition): string {
  const basePath = MODEL_TO_PATH[condition.model] ?? "/dashboard";

  const params = new URLSearchParams();

  // Map condition.where fields to query params
  for (const [key, value] of Object.entries(condition.where)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }

  // Add date filter for today-period quests
  if (condition.period === "today") {
    params.set("datum", "heute");
  }

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
