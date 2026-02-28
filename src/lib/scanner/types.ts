import type { HelenaAlertTyp } from "@prisma/client";

/** Result of a single check function */
export interface CheckResult {
  akteId: string;
  userId: string; // Target user for alert (Akte Verantwortlicher)
  typ: HelenaAlertTyp;
  titel: string;
  inhalt?: string;
  severity: number; // 1-10
  meta?: Record<string, unknown>;
}

/** Aggregated result of a full scanner run */
export interface ScanResult {
  aktenScanned: number;
  alertsCreated: number;
  alertsResolved: number;
  alertsEscalated: number;
  durationMs: number;
  errors: string[];
}

/** Configurable scanner thresholds loaded from SystemSetting */
export interface ScannerConfig {
  enabled: boolean;
  fristThresholdHours: number; // default: 48
  inaktivThresholdDays: number; // default: 14
  escalation3dEnabled: boolean; // default: true
  escalation7dEnabled: boolean; // default: true
  requiredDocuments: Record<string, string[]>; // Sachgebiet -> document names
}
