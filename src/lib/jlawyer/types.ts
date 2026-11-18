/**
 * Types for the j-lawyer.org REST API (j-lawyer-io) and the migration report.
 *
 * Response shapes follow the endpoint catalogue of a live j-lawyer instance
 * (API level 8). Field names are taken verbatim from the catalogue; date
 * fields are declared as "object" there, so they are typed as `JLawyerDate`
 * and parsed defensively (see parseJLawyerDate in client.ts).
 */

export interface JLawyerCredentials {
  /** Server URL, e.g. https://jlawyer.kanzlei.de:8080 (optionally incl. REST root) */
  baseUrl: string;
  username: string;
  password: string;
}

/** Date value as delivered by j-lawyer: ISO string (optionally "…Z[UTC]") or epoch millis. */
export type JLawyerDate = string | number | null | undefined;

/** GET /v1/cases/list → RestfulCaseOverviewV1[] */
export interface JLawyerCaseOverview {
  id: string;
  fileNumber?: string | null;
  name?: string | null;
  reason?: string | null;
  externalId?: string | null;
  dateChanged?: JLawyerDate;
}

/** GET /v2/cases/{id} → RestfulCaseV2 */
export interface JLawyerCase {
  id: string;
  fileNumber?: string | null;
  name?: string | null;
  reason?: string | null;
  subjectField?: string | null;
  /** 0 = active, 1 = archived */
  archived?: number | null;
  /** j-lawyer user (principal) responsible as lawyer */
  lawyer?: string | null;
  /** j-lawyer user (principal) responsible as assistant */
  assistant?: string | null;
  claimNumber?: string | null;
  claimValue?: number | null;
  notice?: string | null;
  group?: string | null;
  externalId?: string | null;
  dateCreated?: JLawyerDate;
  dateUpdated?: JLawyerDate;
  custom1?: string | null;
  custom2?: string | null;
  custom3?: string | null;
}

/** GET /v1/contacts/list → RestfulContactOverviewV1[] */
export interface JLawyerContactOverview {
  id: string;
  firstName?: string | null;
  name?: string | null;
  company?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  zipCode?: string | null;
  city?: string | null;
}

/** GET /v2/contacts/{id} → RestfulContactV2 (subset used by the migration) */
export interface JLawyerContact {
  id: string;
  salutation?: string | null;
  title?: string | null;
  firstName?: string | null;
  /** last name */
  name?: string | null;
  company?: string | null;
  legalForm?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  zipCode?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  mobile?: string | null;
  fax?: string | null;
  email?: string | null;
  website?: string | null;
  /** free-text field in j-lawyer, e.g. "01.02.1980" */
  birthDate?: string | null;
  birthName?: string | null;
  placeOfBirth?: string | null;
  profession?: string | null;
  beaSafeId?: string | null;
  vatId?: string | null;
  notice?: string | null;
}

/** GET /v1/cases/{id}/parties → RestfulPartyV1[] */
export interface JLawyerParty {
  id: string;
  caseId?: string | null;
  /** contact (address) id */
  contact: string;
  addressId?: string | null;
  /** party type name as configured in j-lawyer, e.g. "Mandant", "Gegner" */
  involvementType?: string | null;
  /** the party's own reference / file number */
  reference?: string | null;
}

/** GET /v3/cases/{id}/folders → RestfulCaseFolderV3 (tree) */
export interface JLawyerCaseFolder {
  id: string;
  name?: string | null;
  parentId?: string | null;
  children?: JLawyerCaseFolder[] | null;
}

/** GET /v1/cases/{id}/documents → RestfulDocumentV1[] */
export interface JLawyerDocument {
  id: string;
  caseId?: string | null;
  name: string;
  folderId?: string | null;
  size?: number | null;
  version?: number | null;
  creationDate?: JLawyerDate;
  changeDate?: JLawyerDate;
}

/** GET /v1/cases/document/{id}/content → RestfulDocumentContentV1 */
export interface JLawyerDocumentContent {
  id: string;
  base64content: string;
  fileName?: string | null;
  caseId?: string | null;
}

/** GET /v4/cases/{id}/duedates → RestfulDueDateV6[] */
export interface JLawyerDueDate {
  id: string;
  caseId?: string | null;
  /** Wiedervorlage / Frist / Termin (string; see mapKalenderTyp) */
  type?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  beginDate?: JLawyerDate;
  endDate?: JLawyerDate;
  done?: boolean | null;
  /** j-lawyer user (principal) responsible */
  assignee?: string | null;
  calendar?: string | null;
}

/** GET /v6/security/users/list → RestfulUserV6[] (subset) */
export interface JLawyerUser {
  principalId: string;
  displayName?: string | null;
  firstName?: string | null;
  name?: string | null;
  email?: string | null;
  abbreviation?: string | null;
  lawyer?: boolean | null;
}

export interface JLawyerMigrationIssue {
  entity: string;
  id: string;
  message: string;
}

export interface JLawyerMigrationStats {
  akten: number;
  kontakte: number;
  beteiligte: number;
  dokumente: number;
  kalender: number;
  /** Records that could not be migrated */
  errors: JLawyerMigrationIssue[];
  /**
   * Migrated, but with a fallback the admin should check
   * (e.g. unknown j-lawyer user → Standard-Verantwortlicher).
   */
  hinweise: JLawyerMigrationIssue[];
}
