import { prisma } from "@/lib/db";

export type AuditAktion =
  | "AKTE_ERSTELLT"
  | "AKTE_BEARBEITET"
  | "AKTE_GEOEFFNET"
  | "STATUS_GEAENDERT"
  | "BETEILIGTER_HINZUGEFUEGT"
  | "BETEILIGTER_ENTFERNT"
  | "DOKUMENT_HOCHGELADEN"
  | "DOKUMENT_GELOESCHT"
  | "DOKUMENT_STATUS_GEAENDERT"
  | "DOKUMENT_ANGESEHEN"
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
  | "RVG_BERECHNUNG_GESPEICHERT"
  | "AKTENKONTO_BUCHUNG_ERSTELLT"
  | "AKTENKONTO_STORNO"
  | "BUCHUNGSPERIODE_GESPERRT"
  | "BUCHUNGSPERIODE_ENTSPERRT"
  | "KOSTENSTELLE_ERSTELLT"
  | "KOSTENSTELLE_GEAENDERT"
  | "KOSTENSTELLE_DEAKTIVIERT"
  | "LOGIN_FEHLGESCHLAGEN"
  | "ZUGRIFF_VERWEIGERT"
  | "ADMIN_OVERRIDE_ERSTELLT"
  | "ADMIN_OVERRIDE_ENTFERNT"
  | "DSGVO_ANONYMISIERT"
  | "DSGVO_AUSKUNFT_EXPORTIERT"
  | "BEA_NACHRICHT_GESENDET"
  | "BEA_NACHRICHT_EMPFANGEN"
  | "BEA_EEB_BESTAETIGT"
  | "BEA_NACHRICHT_GELESEN"
  | "BEA_ZUORDNUNG_GEAENDERT"
  | "BEA_ANHANG_HERUNTERGELADEN"
  | "BEA_SAFEID_GEAENDERT"
  | "BEA_POSTFACH_GEWECHSELT"; // BEA_POSTFACH_GEWECHSELT: reserved for future multi-postbox UI

/**
 * German human-readable labels for all audit actions.
 * Used in the audit timeline UI for activity stream rendering.
 */
export const AKTION_LABELS: Record<string, string> = {
  AKTE_ERSTELLT: "hat Akte erstellt",
  AKTE_BEARBEITET: "hat Akte aktualisiert",
  AKTE_GEOEFFNET: "hat Akte aufgerufen",
  STATUS_GEAENDERT: "hat Status geaendert",
  BETEILIGTER_HINZUGEFUEGT: "hat Beteiligten hinzugefuegt",
  BETEILIGTER_ENTFERNT: "hat Beteiligten entfernt",
  DOKUMENT_HOCHGELADEN: "hat Dokument hochgeladen",
  DOKUMENT_GELOESCHT: "hat Dokument geloescht",
  DOKUMENT_STATUS_GEAENDERT: "hat Dokument-Status geaendert",
  DOKUMENT_ANGESEHEN: "hat Dokument angesehen",
  FRIST_ERSTELLT: "hat Frist erstellt",
  FRIST_ERLEDIGT: "hat Frist erledigt",
  TERMIN_ERSTELLT: "hat Termin erstellt",
  WIEDERVORLAGE_ERSTELLT: "hat Wiedervorlage erstellt",
  KALENDER_BEARBEITET: "hat Kalender-Eintrag bearbeitet",
  KALENDER_GELOESCHT: "hat Kalender-Eintrag geloescht",
  NOTIZ_GEAENDERT: "hat Notizen bearbeitet",
  AI_TASK_AKTUALISIERT: "hat KI-Aufgabe aktualisiert",
  AI_ENTWURF_ERSTELLT: "hat KI-Entwurf erstellt",
  AI_NOTIZ_ERSTELLT: "hat KI-Notiz erstellt",
  VERTRETUNG_GESETZT: "hat Vertretung gesetzt",
  VERTRETUNG_AKTIVIERT: "hat Vertretung aktiviert",
  VERTRETUNG_DEAKTIVIERT: "hat Vertretung deaktiviert",
  URLAUB_ERSTELLT: "hat Urlaub eingetragen",
  URLAUB_GELOESCHT: "hat Urlaub geloescht",
  EINSTELLUNGEN_IMPORTIERT: "hat Einstellungen importiert",
  EINSTELLUNGEN_EXPORTIERT: "hat Einstellungen exportiert",
  EINSTELLUNG_GEAENDERT: "hat Einstellung geaendert",
  EINSTELLUNG_ZURUECKGESETZT: "hat Einstellung zurueckgesetzt",
  EMAIL_VERAKTET: "hat E-Mail veraktet",
  EMAIL_VERAKTUNG_AUFGEHOBEN: "hat E-Mail-Veraktung aufgehoben",
  EMAIL_VERANTWORTLICHER_GESETZT: "hat E-Mail-Verantwortlichen gesetzt",
  EMAIL_TICKET_ERSTELLT: "hat E-Mail-Ticket erstellt",
  RECHNUNG_ERSTELLT: "hat Rechnung erstellt",
  RECHNUNG_BEARBEITET: "hat Rechnung bearbeitet",
  RECHNUNG_STATUS_GEAENDERT: "hat Rechnungs-Status geaendert",
  RECHNUNG_GELOESCHT: "hat Rechnung geloescht",
  RVG_BERECHNUNG_GESPEICHERT: "hat RVG-Berechnung gespeichert",
  AKTENKONTO_BUCHUNG_ERSTELLT: "hat Aktenkonto-Buchung erstellt",
  AKTENKONTO_STORNO: "hat Aktenkonto-Buchung storniert",
  BUCHUNGSPERIODE_GESPERRT: "hat Buchungsperiode gesperrt",
  BUCHUNGSPERIODE_ENTSPERRT: "hat Buchungsperiode entsperrt",
  KOSTENSTELLE_ERSTELLT: "hat Kostenstelle erstellt",
  KOSTENSTELLE_GEAENDERT: "hat Kostenstelle geaendert",
  KOSTENSTELLE_DEAKTIVIERT: "hat Kostenstelle deaktiviert",
  LOGIN_FEHLGESCHLAGEN: "Fehlgeschlagener Login-Versuch",
  ZUGRIFF_VERWEIGERT: "Zugriff verweigert",
  ADMIN_OVERRIDE_ERSTELLT: "hat Admin-Zugriff uebernommen",
  ADMIN_OVERRIDE_ENTFERNT: "hat Admin-Zugriff zurueckgegeben",
  DSGVO_ANONYMISIERT: "hat personenbezogene Daten anonymisiert",
  DSGVO_AUSKUNFT_EXPORTIERT: "hat Datenauskunft exportiert",
  BEA_NACHRICHT_GESENDET: "beA Nachricht gesendet",
  BEA_NACHRICHT_EMPFANGEN: "beA Nachricht empfangen",
  BEA_EEB_BESTAETIGT: "eEB bestaetigt",
  BEA_NACHRICHT_GELESEN: "beA Nachricht gelesen",
  BEA_ZUORDNUNG_GEAENDERT: "beA Zuordnung geaendert",
  BEA_ANHANG_HERUNTERGELADEN: "beA Anhang heruntergeladen",
  BEA_SAFEID_GEAENDERT: "Safe-ID geaendert",
  BEA_POSTFACH_GEWECHSELT: "beA Postfach gewechselt",
};

/**
 * Actions that indicate security-relevant events.
 * These are highlighted with red markers in the audit timeline.
 */
export const SECURITY_ACTIONS: Set<string> = new Set([
  "LOGIN_FEHLGESCHLAGEN",
  "ZUGRIFF_VERWEIGERT",
  "ADMIN_OVERRIDE_ERSTELLT",
]);

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

    // Normalize for comparison (Decimal -> number string)
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
  ipAdresse?: string | null;
}

/**
 * Create a standardized audit log entry.
 */
export async function logAuditEvent({
  userId,
  akteId,
  aktion,
  details,
  ipAdresse,
}: LogAuditParams) {
  return prisma.auditLog.create({
    data: {
      userId: userId ?? null,
      akteId,
      aktion,
      details: details ?? undefined,
      ipAdresse: ipAdresse ?? undefined,
    },
  });
}
