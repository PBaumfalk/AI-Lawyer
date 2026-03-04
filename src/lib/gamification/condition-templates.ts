/**
 * Condition templates for Special Quest creation.
 * Extracted from route.ts to avoid non-route exports in Next.js API route files.
 */

export interface ConditionTemplate {
  id: string;
  label: string;
  description: string;
  condition: {
    model: string;
    where: Record<string, string | boolean>;
    dateField: string;
    userField: string | null;
    period: "campaign";
  };
}

export const CONDITION_TEMPLATES: ConditionTemplate[] = [
  {
    id: "fristen-erledigen",
    label: "Fristen erledigen",
    description: "Anzahl erledigter Fristen im Kampagnenzeitraum",
    condition: {
      model: "KalenderEintrag",
      where: { erledigt: true, typ: "FRIST" },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      period: "campaign",
    },
  },
  {
    id: "tickets-bearbeiten",
    label: "Tickets bearbeiten",
    description: "Anzahl erledigter Wiedervorlagen im Kampagnenzeitraum",
    condition: {
      model: "Ticket",
      where: { status: "ERLEDIGT" },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      period: "campaign",
    },
  },
  {
    id: "rechnungen-erstellen",
    label: "Rechnungen erstellen",
    description: "Anzahl erstellter Rechnungen im Kampagnenzeitraum",
    condition: {
      model: "Rechnung",
      where: {},
      dateField: "createdAt",
      userField: null,
      period: "campaign",
    },
  },
  {
    id: "akten-aktualisieren",
    label: "Akten aktualisieren",
    description: "Anzahl Aktenaktivitaeten im Kampagnenzeitraum",
    condition: {
      model: "AktenActivity",
      where: {},
      dateField: "createdAt",
      userField: "userId",
      period: "campaign",
    },
  },
];
