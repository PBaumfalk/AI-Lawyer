import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";

/**
 * Fields that are anonymized per Kontakt record.
 */
const ANONYMIZE_FIELDS = {
  vorname: "Geloeschter",
  nachname: "Mandant",
  firma: "Anonymisiert",
  email: null,
  email2: null,
  telefon: null,
  telefon2: null,
  mobil: null,
  fax: null,
  geburtsdatum: null,
  geburtsname: null,
  geburtsort: null,
  geburtsland: null,
  beruf: null,
  branche: null,
  steuernr: null,
  beaSafeId: null,
  website: null,
  notizen: null,
  strasse: null,
  plz: null,
  ort: null,
  land: null,
  anrede: null,
  titel: null,
  kurzname: null,
  registernummer: null,
  registergericht: null,
  geschaeftszweck: null,
  finanzamt: null,
  ustIdNr: null,
  iban: null,
  bic: null,
  kontoinhaber: null,
  zahlungsmodalitaeten: null,
  bonitaetseinschaetzung: null,
  aktenzeichen: null,
  mandantennummer: null,
  kontaktzeiten: null,
} as const;

/**
 * 10-year retention period in milliseconds.
 * Based on BRAO/GoBD requirements for legal records.
 */
const RETENTION_YEARS = 10;

interface AnonymizeOptions {
  dryRun?: boolean;
  forceOverrideRetention?: boolean;
}

interface AnonymizeResult {
  success: boolean;
  dryRun: boolean;
  kontaktId: string;
  fieldsAnonymized: string[];
  adressenAnonymized: number;
  auditLogsAnonymized: number;
  retentionCheck: {
    passed: boolean;
    aufbewahrungBis: string;
    overridden: boolean;
  };
  error?: string;
}

/**
 * Check the retention period for a Kontakt.
 * Returns the date after which anonymization is allowed.
 */
function getRetentionEndDate(createdAt: Date): Date {
  const end = new Date(createdAt);
  end.setFullYear(end.getFullYear() + RETENTION_YEARS);
  return end;
}

/**
 * Anonymize personal data for a Kontakt record.
 * Runs in a Prisma transaction. NEVER deletes records - only replaces PII.
 *
 * Supports dry-run mode to preview what would be anonymized.
 * Enforces 10-year retention period (can be overridden by admin).
 */
export async function anonymizeKontakt(
  kontaktId: string,
  adminUserId: string,
  grund: string,
  options: AnonymizeOptions = {}
): Promise<AnonymizeResult> {
  const { dryRun = false, forceOverrideRetention = false } = options;

  // Load Kontakt
  const kontakt = await prisma.kontakt.findUnique({
    where: { id: kontaktId },
    include: {
      adressen: true,
      beteiligte: { select: { akteId: true } },
    },
  });

  if (!kontakt) {
    return {
      success: false,
      dryRun,
      kontaktId,
      fieldsAnonymized: [],
      adressenAnonymized: 0,
      auditLogsAnonymized: 0,
      retentionCheck: { passed: false, aufbewahrungBis: "", overridden: false },
      error: "Kontakt nicht gefunden",
    };
  }

  // Check retention period
  const retentionEnd = getRetentionEndDate(kontakt.createdAt);
  const now = new Date();
  const retentionPassed = now >= retentionEnd;

  if (!retentionPassed && !forceOverrideRetention) {
    const formattedDate = retentionEnd.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return {
      success: false,
      dryRun,
      kontaktId,
      fieldsAnonymized: [],
      adressenAnonymized: 0,
      auditLogsAnonymized: 0,
      retentionCheck: {
        passed: false,
        aufbewahrungBis: formattedDate,
        overridden: false,
      },
      error: `Aufbewahrungspflicht: Anonymisierung erst ab ${formattedDate} moeglich`,
    };
  }

  // Determine which fields would be anonymized (have data currently)
  const fieldsToAnonymize: string[] = [];
  for (const [key, anonValue] of Object.entries(ANONYMIZE_FIELDS)) {
    const currentValue = (kontakt as any)[key];
    if (currentValue !== null && currentValue !== undefined) {
      fieldsToAnonymize.push(key);
    }
  }

  const adressenCount = kontakt.adressen.length;

  // Count audit logs that reference this kontakt's name in details
  const akteIds = kontakt.beteiligte.map((b) => b.akteId);
  let auditLogCount = 0;
  if (akteIds.length > 0) {
    auditLogCount = await prisma.auditLog.count({
      where: {
        akteId: { in: akteIds },
        details: { not: Prisma.AnyNull },
      },
    });
  }

  const result: AnonymizeResult = {
    success: true,
    dryRun,
    kontaktId,
    fieldsAnonymized: fieldsToAnonymize,
    adressenAnonymized: adressenCount,
    auditLogsAnonymized: auditLogCount,
    retentionCheck: {
      passed: retentionPassed,
      aufbewahrungBis: retentionEnd.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      overridden: !retentionPassed && forceOverrideRetention,
    },
  };

  if (dryRun) {
    return result;
  }

  // Execute anonymization in transaction
  await prisma.$transaction(async (tx) => {
    // 1. Anonymize Kontakt fields
    const updateData: Record<string, any> = {};
    for (const [key, anonValue] of Object.entries(ANONYMIZE_FIELDS)) {
      updateData[key] = anonValue;
    }

    // For juristisch (legal entity) kontakt, adjust name
    if (kontakt.typ === "JURISTISCH") {
      updateData.vorname = null;
      updateData.nachname = null;
      updateData.firma = "Anonymisierte Organisation";
    }

    // Clear arrays and JSON fields
    updateData.tags = [];
    updateData.customFields = null;
    updateData.staatsangehoerigkeiten = [];
    updateData.korrespondenzSprachen = [];
    updateData.wirtschaftlichBerechtigte = null;

    await tx.kontakt.update({
      where: { id: kontaktId },
      data: updateData,
    });

    // 2. Anonymize Adressen
    if (adressenCount > 0) {
      await tx.adresse.updateMany({
        where: { kontaktId },
        data: {
          strasse: null,
          hausnummer: null,
          plz: null,
          ort: null,
          land: null,
          bezeichnung: "Anonymisiert",
        },
      });
    }

    // 3. Anonymize AuditLog details that may contain personal data
    if (akteIds.length > 0) {
      const auditLogs = await tx.auditLog.findMany({
        where: {
          akteId: { in: akteIds },
          details: { not: Prisma.AnyNull },
        },
        select: { id: true, details: true },
      });

      const namePattern = buildNameRegex(kontakt);
      for (const log of auditLogs) {
        if (!log.details) continue;
        const detailsStr = JSON.stringify(log.details);
        if (namePattern && namePattern.test(detailsStr)) {
          const anonymized = detailsStr.replace(namePattern, "Anonymisiert");
          try {
            await tx.auditLog.update({
              where: { id: log.id },
              data: { details: JSON.parse(anonymized) },
            });
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  });

  // Log the anonymization event
  await logAuditEvent({
    userId: adminUserId,
    aktion: "DSGVO_ANONYMISIERT",
    details: {
      kontaktId,
      grund,
      felder: fieldsToAnonymize.length,
      adressen: adressenCount,
      retentionOverridden: !retentionPassed && forceOverrideRetention,
    },
  });

  return result;
}

/**
 * Build a regex that matches the Kontakt's name variants in audit log details.
 */
function buildNameRegex(kontakt: {
  vorname: string | null;
  nachname: string | null;
  firma: string | null;
}): RegExp | null {
  const patterns: string[] = [];

  if (kontakt.vorname) patterns.push(escapeRegex(kontakt.vorname));
  if (kontakt.nachname) patterns.push(escapeRegex(kontakt.nachname));
  if (kontakt.firma) patterns.push(escapeRegex(kontakt.firma));

  // Full name variants
  if (kontakt.vorname && kontakt.nachname) {
    patterns.push(escapeRegex(`${kontakt.vorname} ${kontakt.nachname}`));
    patterns.push(escapeRegex(`${kontakt.nachname}, ${kontakt.vorname}`));
  }

  if (patterns.length === 0) return null;

  return new RegExp(patterns.join("|"), "gi");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
