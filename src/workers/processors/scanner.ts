import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getSettingTyped } from "@/lib/settings/service";
import { runFristCheck } from "@/lib/scanner/checks/frist-check";
import { runInaktivCheck } from "@/lib/scanner/checks/inaktiv-check";
import { runAnomalieCheck } from "@/lib/scanner/checks/anomalie-check";
import { resolveStaleAlerts, escalateUnresolved } from "@/lib/scanner/service";
import type { ScanResult, ScannerConfig } from "@/lib/scanner/types";

const log = createLogger("scanner");

/**
 * Main scanner processor. Called by BullMQ worker on nightly cron.
 * Runs 3 deterministic checks on all open Akten, then auto-resolves
 * stale alerts and escalates long-unresolved ones.
 *
 * NO LLM calls -- purely rule-based Prisma queries.
 */
export async function processScanner(): Promise<ScanResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let alertsCreated = 0;
  let alertsResolved = 0;
  let alertsEscalated = 0;

  // Load config from SystemSetting
  const config: ScannerConfig = {
    enabled: await getSettingTyped<boolean>("scanner.enabled", true),
    fristThresholdHours: await getSettingTyped<number>(
      "scanner.frist_threshold_hours",
      48
    ),
    inaktivThresholdDays: await getSettingTyped<number>(
      "scanner.inaktiv_threshold_days",
      14
    ),
    escalation3dEnabled: await getSettingTyped<boolean>(
      "scanner.escalation_3d_enabled",
      true
    ),
    escalation7dEnabled: await getSettingTyped<boolean>(
      "scanner.escalation_7d_enabled",
      true
    ),
    requiredDocuments: await getSettingTyped<Record<string, string[]>>(
      "scanner.required_documents",
      { default: ["Vollmacht"] }
    ),
    neuesUrteilEnabled: await getSettingTyped<boolean>(
      "scanner.neues_urteil_enabled",
      true
    ),
    neuesUrteilThreshold: await getSettingTyped<number>(
      "scanner.neues_urteil_threshold",
      0.72
    ),
  };

  if (!config.enabled) {
    log.info("Scanner is disabled via settings");
    return {
      aktenScanned: 0,
      alertsCreated: 0,
      alertsResolved: 0,
      alertsEscalated: 0,
      durationMs: Date.now() - startTime,
      errors: [],
    };
  }

  log.info(
    {
      config: {
        fristThresholdHours: config.fristThresholdHours,
        inaktivThresholdDays: config.inaktivThresholdDays,
      },
    },
    "Starting scanner run"
  );

  // Count open Akten for metrics
  const aktenCount = await prisma.akte.count({ where: { status: "OFFEN" } });

  // Run checks -- each function handles its own batch queries
  try {
    alertsCreated += await runFristCheck(config.fristThresholdHours);
  } catch (err) {
    const msg = `Frist check failed: ${err instanceof Error ? err.message : String(err)}`;
    log.error({ err }, msg);
    errors.push(msg);
  }

  try {
    alertsCreated += await runInaktivCheck(config.inaktivThresholdDays);
  } catch (err) {
    const msg = `Inaktiv check failed: ${err instanceof Error ? err.message : String(err)}`;
    log.error({ err }, msg);
    errors.push(msg);
  }

  try {
    alertsCreated += await runAnomalieCheck();
  } catch (err) {
    const msg = `Anomalie check failed: ${err instanceof Error ? err.message : String(err)}`;
    log.error({ err }, msg);
    errors.push(msg);
  }

  // Auto-resolve alerts where condition is now fixed
  try {
    alertsResolved = await resolveStaleAlerts();
  } catch (err) {
    const msg = `Auto-resolve failed: ${err instanceof Error ? err.message : String(err)}`;
    log.error({ err }, msg);
    errors.push(msg);
  }

  // Progressive escalation
  try {
    if (config.escalation3dEnabled) {
      alertsEscalated += await escalateUnresolved(3, 2); // +2 severity after 3 days
    }
    if (config.escalation7dEnabled) {
      alertsEscalated += await escalateUnresolved(7, 0); // admin notify after 7 days
    }
  } catch (err) {
    const msg = `Escalation failed: ${err instanceof Error ? err.message : String(err)}`;
    log.error({ err }, msg);
    errors.push(msg);
  }

  const result: ScanResult = {
    aktenScanned: aktenCount,
    alertsCreated,
    alertsResolved,
    alertsEscalated,
    durationMs: Date.now() - startTime,
    errors,
  };

  log.info(result, "Scanner run complete");
  return result;
}
