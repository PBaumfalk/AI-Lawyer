/**
 * Type definitions for CalDAV sync.
 */

export type CalDavProvider = "GOOGLE" | "APPLE";

export interface CalDavKontoInput {
  provider: CalDavProvider;
  name: string;
  serverUrl: string;
  benutzername: string;
  passwort?: string;
  oauthTokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  };
  selectedCalendarUrl?: string;
}

export interface CalDavSyncState {
  ctag: string | null;
  lastSync: Date | null;
  errorCount: number;
}

export interface CalDavEvent {
  uid: string;
  summary: string;
  description?: string;
  dtstart: Date;
  dtend?: Date;
  allDay: boolean;
  etag?: string;
  url?: string;
}

export type SyncDirection = "PUSH" | "PULL" | "BIDI";

export interface CalDavCalendarInfo {
  url: string;
  displayName: string;
  ctag?: string;
  color?: string;
}
