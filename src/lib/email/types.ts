/**
 * Shared TypeScript types for the email domain.
 */

import type {
  EmailRichtung,
  EmailPrioritaet,
  EmailSendeStatus,
  EmailSyncStatus,
  EmailAuthTyp,
  EmailInitialSync,
  EmailSpezialTyp,
} from "@prisma/client";

// ─── IMAP Connection ────────────────────────────────────────────────────────

export interface EmailKontoConfig {
  id: string;
  emailAdresse: string;
  benutzername: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  authTyp: EmailAuthTyp;
  /** Decrypted password (only available at runtime) */
  password?: string;
  /** OAuth2 access token */
  accessToken?: string;
}

export type ImapConnectionState =
  | "connecting"
  | "connected"
  | "idle"
  | "syncing"
  | "disconnected"
  | "error";

export interface ManagedConnection {
  kontoId: string;
  client: import("imapflow").ImapFlow;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  failCount: number;
  state: ImapConnectionState;
}

// ─── Email Parsing ──────────────────────────────────────────────────────────

export interface ParsedEmailAddress {
  address: string;
  name?: string;
}

export interface ParsedAttachment {
  filename: string;
  mimeType: string;
  size: number;
  contentId?: string;
  content?: Buffer;
}

export interface ParsedEmail {
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  subject: string;
  from: ParsedEmailAddress;
  to: ParsedEmailAddress[];
  cc: ParsedEmailAddress[];
  bcc: ParsedEmailAddress[];
  html?: string;
  text?: string;
  date?: Date;
  priority?: EmailPrioritaet;
  size?: number;
  attachments: ParsedAttachment[];
  headers: Map<string, string>;
}

// ─── Sync ───────────────────────────────────────────────────────────────────

export interface SyncResult {
  kontoId: string;
  folder: string;
  newMessages: number;
  updatedMessages: number;
  errors: string[];
  duration: number;
}

// ─── Email Send ─────────────────────────────────────────────────────────────

export interface EmailSendJob {
  emailNachrichtId: string;
  kontoId: string;
  userId: string;
  dmsDocumentIds?: string[]; // DMS document IDs for VERSENDET marking after successful send
}

export interface EmailSyncJob {
  kontoId: string;
  folder?: string;
  strategy?: EmailInitialSync;
}

// ─── Email Filters (API) ────────────────────────────────────────────────────

export interface EmailFilters {
  kontoId?: string;
  ordnerId?: string;
  gelesen?: boolean;
  veraktet?: boolean;
  akteId?: string;
  verantwortlichId?: string;
  geloescht?: boolean;
  search?: string;
  richtung?: EmailRichtung;
  sortBy?: "empfangenAm" | "absender" | "betreff";
  sortOrder?: "asc" | "desc";
  cursor?: string;
  limit?: number;
}

// ─── Re-exports for convenience ─────────────────────────────────────────────

export type {
  EmailRichtung,
  EmailPrioritaet,
  EmailSendeStatus,
  EmailSyncStatus,
  EmailAuthTyp,
  EmailInitialSync,
  EmailSpezialTyp,
};
