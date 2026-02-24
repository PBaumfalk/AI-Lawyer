import { prisma } from "@/lib/db";

export type AuditAktion =
  | "AKTE_ERSTELLT"
  | "AKTE_BEARBEITET"
  | "STATUS_GEAENDERT"
  | "BETEILIGTER_HINZUGEFUEGT"
  | "BETEILIGTER_ENTFERNT"
  | "DOKUMENT_HOCHGELADEN"
  | "DOKUMENT_GELOESCHT"
  | "DOKUMENT_STATUS_GEAENDERT"
  | "FRIST_ERSTELLT"
  | "FRIST_ERLEDIGT"
  | "TERMIN_ERSTELLT"
  | "WIEDERVORLAGE_ERSTELLT"
  | "KALENDER_BEARBEITET"
  | "KALENDER_GELOESCHT"
  | "NOTIZ_GEAENDERT"
  | "AI_TASK_AKTUALISIERT"
  | "AI_ENTWURF_ERSTELLT"
  | "AI_NOTIZ_ERSTELLT"
  | "VERTRETUNG_GESETZT"
  | "VERTRETUNG_AKTIVIERT"
  | "VERTRETUNG_DEAKTIVIERT"
  | "URLAUB_ERSTELLT"
  | "URLAUB_GELOESCHT"
  | "EINSTELLUNGEN_IMPORTIERT"
  | "EINSTELLUNGEN_EXPORTIERT"
  | "EINSTELLUNG_GEAENDERT"
  | "EINSTELLUNG_ZURUECKGESETZT"
  | "EMAIL_VERAKTET"
  | "EMAIL_VERAKTUNG_AUFGEHOBEN"
  | "EMAIL_VERANTWORTLICHER_GESETZT"
  | "EMAIL_TICKET_ERSTELLT"
  | "RECHNUNG_ERSTELLT"
  | "RECHNUNG_BEARBEITET"
  | "RECHNUNG_STATUS_GEAENDERT"
  | "RECHNUNG_GELOESCHT"
  | "RVG_BERECHNUNG_GESPEICHERT";

// German labels for field names used in change diffs
const feldLabels: Record<string, string> = {
  kurzrubrum: "Kurzrubrum",
  wegen: "Wegen",
  sachgebiet: "Sachgebiet",
  status: "Status",
  gegenstandswert: "Gegenstandswert",
  anwaltId: "Anwalt",
  sachbearbeiterId: "Sachbearbeiter/in",
  notizen: "Notizen",
};

// German labels for enum values
const sachgebietLabels: Record<string, string> = {
  ARBEITSRECHT: "Arbeitsrecht",
  FAMILIENRECHT: "Familienrecht",
  VERKEHRSRECHT: "Verkehrsrecht",
  MIETRECHT: "Mietrecht",
  STRAFRECHT: "Strafrecht",
  ERBRECHT: "Erbrecht",
  SOZIALRECHT: "Sozialrecht",
  INKASSO: "Inkasso",
  HANDELSRECHT: "Handelsrecht",
  VERWALTUNGSRECHT: "Verwaltungsrecht",
  SONSTIGES: "Sonstiges",
};

const statusLabels: Record<string, string> = {
  OFFEN: "Offen",
  RUHEND: "Ruhend",
  ARCHIVIERT: "Archiviert",
  GESCHLOSSEN: "Geschlossen",
};

// Humanize a value for display in audit details
function humanizeValue(key: string, value: any): string {
  if (value === null || value === undefined) return "—";
  if (key === "sachgebiet") return sachgebietLabels[value] ?? value;
  if (key === "status") return statusLabels[value] ?? value;
  if (key === "gegenstandswert") {
    return `${parseFloat(value).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;
  }
  if (key === "notizen") {
    const str = String(value);
    return str.length > 80 ? str.substring(0, 80) + "…" : str;
  }
  return String(value);
}

/**
 * Compute a before/after diff between old and new values.
 * Returns only changed fields with German labels.
 */
export function computeChanges(
  oldData: Record<string, any>,
  newData: Record<string, any>
): { feld: string; feldKey: string; alt: string; neu: string }[] {
  const changes: { feld: string; feldKey: string; alt: string; neu: string }[] = [];

  for (const key of Object.keys(newData)) {
    if (newData[key] === undefined) continue;

    const oldVal = oldData[key] ?? null;
    const newVal = newData[key] ?? null;

    // Normalize for comparison (Decimal → number string)
    const normalizedOld = oldVal !== null ? String(oldVal) : null;
    const normalizedNew = newVal !== null ? String(newVal) : null;

    if (normalizedOld === normalizedNew) continue;

    changes.push({
      feld: feldLabels[key] ?? key,
      feldKey: key,
      alt: humanizeValue(key, oldVal),
      neu: humanizeValue(key, newVal),
    });
  }

  return changes;
}

interface LogAuditParams {
  userId?: string | null;
  akteId?: string | null;
  aktion: AuditAktion;
  details?: Record<string, any>;
}

/**
 * Create a standardized audit log entry.
 */
export async function logAuditEvent({
  userId,
  akteId,
  aktion,
  details,
}: LogAuditParams) {
  return prisma.auditLog.create({
    data: {
      userId: userId ?? null,
      akteId,
      aktion,
      details: details ?? undefined,
    },
  });
}
