export interface JLawyerCredentials {
  baseUrl: string; // e.g. https://jlawyer.kanzlei.de
  username: string;
  password: string;
}

export interface JLawyerCase {
  id: string;
  fileNumber: string; // Aktenzeichen
  name: string; // Kurzrubrum / case name
  reason: string; // Wegen / subject
  subject: string; // Sachgebiet label
  status: string; // OPEN | ARCHIVED | etc.
  lawyerId?: string; // Assigned lawyer ID
  assistantId?: string; // Assigned assistant ID
  dateCreated: string; // ISO date
  dateChanged: string;
  customFields?: Record<string, unknown>;
}

export interface JLawyerContact {
  id: string;
  type: "PERSON" | "ORGANIZATION";
  firstName?: string;
  lastName?: string;
  company?: string;
  street?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  email?: string;
  dateOfBirth?: string;
  note?: string;
}

export interface JLawyerParticipant {
  contactId: string;
  role: string; // CLIENT | OPPONENT | OPPONENT_ATTORNEY | COURT | etc.
  note?: string;
}

export interface JLawyerDocument {
  id: string;
  caseId: string;
  name: string;
  folder?: string;
  mimeType: string;
  size: number;
  dateCreated: string;
  dateChanged: string;
  version?: number;
}

export interface JLawyerCalendarEntry {
  id: string;
  caseId?: string;
  type: "APPOINTMENT" | "DEADLINE" | "FOLLOW_UP";
  title: string;
  description?: string;
  startDate: string; // ISO datetime
  endDate?: string;
  allDay?: boolean;
  done?: boolean;
  responsibleId?: string;
}

export interface JLawyerMigrationStats {
  akten: number;
  kontakte: number;
  beteiligte: number;
  dokumente: number;
  kalender: number;
  errors: Array<{ entity: string; id: string; message: string }>;
}
