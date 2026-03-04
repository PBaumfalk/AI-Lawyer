export interface SettingDefinition {
  key: string;
  value: string;
  type: "string" | "number" | "boolean" | "json";
  category: string;
  label: string;
  /** For string type settings with a fixed set of options */
  options?: string[];
  /** Minimum value for number type settings */
  min?: number;
  /** Maximum value for number type settings */
  max?: number;
}

/**
 * Default runtime settings used to seed the SystemSetting table.
 * User overrides are preserved; only missing keys are inserted.
 */
export const DEFAULT_SETTINGS: SettingDefinition[] = [
  // Worker category
  {
    key: "worker.concurrency",
    value: "5",
    type: "number",
    category: "worker",
    label: "Worker-Parallelitaet",
    min: 1,
    max: 50,
  },
  {
    key: "worker.retryLimit",
    value: "3",
    type: "number",
    category: "worker",
    label: "Maximale Wiederholungen",
    min: 0,
    max: 10,
  },

  // Logging category
  {
    key: "log.level",
    value: "info",
    type: "string",
    category: "logging",
    label: "Log-Level",
    options: ["trace", "debug", "info", "warn", "error", "fatal"],
  },

  // Notifications category
  {
    key: "notifications.sound.default",
    value: "false",
    type: "boolean",
    category: "notifications",
    label: "Standard-Benachrichtigungston",
  },
  {
    key: "notifications.retention.days",
    value: "30",
    type: "number",
    category: "notifications",
    label: "Aufbewahrung Benachrichtigungen (Tage)",
    min: 1,
    max: 365,
  },

  // Fristen category
  {
    key: "fristen.scan_zeit",
    value: "06:00",
    type: "string",
    category: "fristen",
    label: "Fristen-Scan Uhrzeit (HH:MM)",
  },
  {
    key: "fristen.email_enabled",
    value: "true",
    type: "boolean",
    category: "fristen",
    label: "E-Mail-Erinnerungen aktiviert",
  },
  {
    key: "fristen.max_retry_age_days",
    value: "3",
    type: "number",
    category: "fristen",
    label: "Max. E-Mail-Nachversand (Tage)",
    min: 1,
    max: 14,
  },

  // System category
  {
    key: "system.maintenance",
    value: "false",
    type: "boolean",
    category: "system",
    label: "Wartungsmodus",
  },

  // AI / Helena category
  {
    key: "ai.provider",
    value: "ollama",
    type: "string",
    category: "ai",
    label: "KI-Provider",
    options: ["ollama", "openai", "anthropic"],
  },
  {
    key: "ai.provider.apiKey",
    value: "",
    type: "string",
    category: "ai",
    label: "API-Schluessel",
  },
  {
    key: "ai.provider.model",
    value: "qwen3.5:35b",
    type: "string",
    category: "ai",
    label: "KI-Modell",
  },
  {
    key: "ai.ollama.url",
    value: process.env.OLLAMA_URL || "http://localhost:11434",
    type: "string",
    category: "ai",
    label: "Ollama-URL",
  },
  {
    key: "ai.monthly_budget",
    value: "0",
    type: "number",
    category: "ai",
    label: "Monatliches Token-Budget (0 = unbegrenzt)",
    min: 0,
  },
  {
    key: "ai.scan_enabled",
    value: "true",
    type: "boolean",
    category: "ai",
    label: "Proaktive Aktenanalyse",
  },
  {
    key: "ai.scan_interval",
    value: "0 */4 * * *",
    type: "string",
    category: "ai",
    label: "Scan-Intervall (Cron)",
  },
  {
    key: "ai.briefing_enabled",
    value: "false",
    type: "boolean",
    category: "ai",
    label: "Tagesbriefing aktiviert",
  },
  {
    key: "ai.briefing_time",
    value: "07:00",
    type: "string",
    category: "ai",
    label: "Briefing-Uhrzeit (HH:MM)",
  },

  // Scanner category
  {
    key: "scanner.enabled",
    value: "true",
    type: "boolean",
    category: "scanner",
    label: "Naechtlicher Akten-Scanner aktiviert",
  },
  {
    key: "scanner.cron_schedule",
    value: "0 1 * * *",
    type: "string",
    category: "scanner",
    label: "Scanner Cron-Zeitplan",
  },
  {
    key: "scanner.frist_threshold_hours",
    value: "48",
    type: "number",
    category: "scanner",
    label: "Frist-Warnung Schwellenwert (Stunden)",
    min: 12,
    max: 168,
  },
  {
    key: "scanner.inaktiv_threshold_days",
    value: "14",
    type: "number",
    category: "scanner",
    label: "Inaktivitaets-Schwellenwert (Tage)",
    min: 7,
    max: 90,
  },
  {
    key: "scanner.escalation_3d_enabled",
    value: "true",
    type: "boolean",
    category: "scanner",
    label: "Eskalation nach 3 Tagen (+2 Severity)",
  },
  {
    key: "scanner.escalation_7d_enabled",
    value: "true",
    type: "boolean",
    category: "scanner",
    label: "Eskalation nach 7 Tagen (Admin-Benachrichtigung)",
  },
  {
    key: "scanner.required_documents",
    value: JSON.stringify({
      ARBEITSRECHT: ["Vollmacht", "Kuendigungsschreiben"],
      VERKEHRSRECHT: ["Vollmacht", "Unfallbericht"],
      FAMILIENRECHT: ["Vollmacht"],
      default: ["Vollmacht"],
    }),
    type: "json",
    category: "scanner",
    label: "Erwartete Dokumente pro Sachgebiet (JSON)",
  },
  {
    key: "scanner.neues_urteil_enabled",
    value: "true",
    type: "boolean",
    category: "scanner",
    label: "Neu-Urteil-Check aktiviert",
  },
  {
    key: "scanner.neues_urteil_threshold",
    value: "0.72",
    type: "number",
    category: "scanner",
    label: "Relevanz-Schwellenwert (Cosine Similarity)",
    min: 0.50,
    max: 0.95,
  },

  // beA category
  {
    key: "bea.api_url",
    value: "https://api.bea.expert",
    type: "string",
    category: "bea",
    label: "beA-API-URL",
  },
  {
    key: "bea.enabled",
    value: "false",
    type: "boolean",
    category: "bea",
    label: "beA-Integration aktiviert",
  },

  // Gamification category
  {
    key: "gamification.boss.threshold",
    value: "30",
    type: "number",
    category: "gamification",
    label: "Boss-Schwellenwert (offene Wiedervorlagen)",
    min: 5,
    max: 200,
  },
  {
    key: "gamification.boss.cooldownHours",
    value: "24",
    type: "number",
    category: "gamification",
    label: "Boss-Abklingzeit (Stunden nach Sieg)",
    min: 1,
    max: 168,
  },
  {
    key: "gamification.daily_runen_cap",
    value: "40",
    type: "number",
    category: "gamification",
    label: "Taegliches Runen-Limit (Wiedervorlage-Quests)",
    min: 10,
    max: 200,
  },
];

/** Category display labels (German) */
export const CATEGORY_LABELS: Record<string, string> = {
  worker: "Worker",
  logging: "Logging",
  notifications: "Benachrichtigungen",
  fristen: "Fristen",
  system: "System",
  ai: "KI / Helena",
  scanner: "Scanner",
  bea: "beA",
  gamification: "Gamification",
};
