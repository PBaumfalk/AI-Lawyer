// Time Tracking Types
// Types for timer state management, manual time entries, and billing

/** Active timer state returned to the client */
export interface TimerState {
  /** Zeiterfassung record ID */
  zeiterfassungId: string;
  /** Case ID the timer is running for */
  akteId: string;
  /** Case reference number */
  aktenzeichen: string;
  /** Timer start time */
  startzeit: Date;
  /** User ID */
  userId: string;
}

/** Input for creating a manual time entry */
export interface TimeEntryInput {
  /** Case ID */
  akteId: string;
  /** Entry date */
  datum: Date;
  /** Duration in minutes */
  dauer: number;
  /** Description of the activity */
  beschreibung: string;
  /** Hourly rate (optional, uses default if not provided) */
  stundensatz?: number;
  /** Activity category (Taetigkeitskategorie name) */
  kategorie?: string;
  /** Whether this time is billable */
  abrechenbar?: boolean;
}

/** Summary of time entries for display */
export interface TimeEntrySummary {
  /** Total minutes across all entries */
  totalMinuten: number;
  /** Total billable minutes */
  abrechenbarMinuten: number;
  /** Effective hourly rate (totalBillableAmount / billableHours) */
  effektiverStundensatz: number;
}
