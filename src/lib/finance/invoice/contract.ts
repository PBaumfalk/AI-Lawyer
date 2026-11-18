// Invoice API contract shared by the route handlers and the client components.
// Client-safe: only zod and types, no Prisma runtime imports.
//
// Every request a component sends is built by a function in this file and
// every route parses it with a schema from this file, so a renamed field or
// action breaks the TypeScript build instead of failing silently at runtime.
// Amounts are plain numbers in EURO (not cents) on both sides.

import { z } from 'zod';
import type { InvoicePosition, UstSummary } from './types';

// ─── Shared literals ─────────────────────────────────────────────────────────

export const RECHNUNG_STATUS = ['ENTWURF', 'GESTELLT', 'BEZAHLT', 'MAHNUNG', 'STORNIERT'] as const;
export type RechnungStatusDto = (typeof RECHNUNG_STATUS)[number];

export const MAHN_STUFEN = ['ERINNERUNG', 'ERSTE_MAHNUNG', 'ZWEITE_MAHNUNG', 'DRITTE_MAHNUNG'] as const;
export type MahnStufeDto = (typeof MAHN_STUFEN)[number];

export const MAHN_STUFE_LABEL: Record<MahnStufeDto, string> = {
  ERINNERUNG: 'Zahlungserinnerung',
  ERSTE_MAHNUNG: '1. Mahnung',
  ZWEITE_MAHNUNG: '2. Mahnung',
  DRITTE_MAHNUNG: '3. Mahnung',
};

// ─── Status actions (PATCH /api/finanzen/rechnungen/[id]) ────────────────────

export const INVOICE_ACTIONS = ['stellen', 'bezahlen', 'stornieren', 'mahnen'] as const;
export type InvoiceAction = (typeof INVOICE_ACTIONS)[number];

export const invoiceActionSchema = z.object({ action: z.enum(INVOICE_ACTIONS) }).strict();
export type InvoiceActionBody = z.infer<typeof invoiceActionSchema>;

export function buildInvoiceActionBody(action: InvoiceAction): InvoiceActionBody {
  return { action };
}

// ─── Create / edit (POST /api/finanzen/rechnungen, PATCH edit mode) ──────────

export const invoicePositionSchema = z.object({
  vvNr: z.string().optional(),
  beschreibung: z.string().min(1, 'Beschreibung ist erforderlich'),
  menge: z.number().positive('Menge muss positiv sein'),
  einzelpreis: z.number().min(0, 'Einzelpreis darf nicht negativ sein'),
  ustSatz: z.number().min(0).max(100),
  betrag: z.number(),
});

export const createInvoiceSchema = z.object({
  akteId: z.string().min(1, 'Akten-ID ist erforderlich'),
  empfaengerId: z.string().optional(),
  positionen: z.array(invoicePositionSchema).min(1, 'Mindestens eine Position erforderlich'),
  zahlungszielTage: z.number().int().positive().optional(),
  notizen: z.string().optional(),
  isPkh: z.boolean().optional(),
  rvgBerechnungId: z.string().optional(),
  typ: z.enum(['RVG', 'STUNDENHONORAR', 'PAUSCHALE']).optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

/** Edit mode accepts only these keys; anything else (e.g. a misspelled action) is rejected. */
export const editInvoiceSchema = z
  .object({
    positionen: z.array(invoicePositionSchema).optional(),
    notizen: z.string().optional(),
    zahlungszielTage: z.number().int().positive().optional(),
    empfaengerId: z.string().optional(),
  })
  .strict();

export interface CreateInvoiceResponse {
  rechnung: { id: string; rechnungsnummer: string };
}

// ─── List (GET /api/finanzen/rechnungen) ─────────────────────────────────────

/** Columns the list can be sorted by (all are real DB columns). */
export const INVOICE_SORT_FIELDS = [
  'rechnungsnummer',
  'rechnungsdatum',
  'betragBrutto',
  'status',
  'faelligAm',
] as const;
export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number];

export const INVOICE_LIST_MAX_LIMIT = 100;

export const invoiceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(INVOICE_LIST_MAX_LIMIT).default(20),
  sortBy: z.enum(INVOICE_SORT_FIELDS).default('rechnungsdatum'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(RECHNUNG_STATUS).optional(),
  search: z.string().trim().max(200).optional(),
  ueberfaellig: z.enum(['true', 'false']).optional(),
  akteId: z.string().optional(),
  mandantId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;
export type InvoiceListQueryInput = z.input<typeof invoiceListQuerySchema>;

export function buildInvoiceListQuery(q: InvoiceListQueryInput): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '') continue;
    p.set(k, String(v));
  }
  return p;
}

export interface InvoiceListItemDto {
  id: string;
  akteId: string;
  rechnungsnummer: string;
  rechnungsdatum: string;
  faelligAm: string | null;
  status: RechnungStatusDto;
  mahnStufe: MahnStufeDto | null;
  betragNetto: number;
  betragBrutto: number;
  restBetrag: number;
  stornoVon: string | null;
  mandantName: string | null;
  aktenzeichen: string;
  kurzrubrum: string | null;
}

export interface InvoiceStatsDto {
  /** Netto-Summe bezahlter Rechnungen */
  gesamtUmsatz: number;
  /** Offener Restbetrag (brutto) gestellter/gemahnter Rechnungen */
  offeneForderungen: number;
  /** Anzahl gestellter/gemahnter Rechnungen mit überschrittener Fälligkeit */
  ueberfaellig: number;
  /** Prozent stornierter Rechnungen an allen nicht-Entwurf-Rechnungen (ohne Stornobelege) */
  stornoquote: number;
}

export interface InvoiceListResponse {
  rechnungen: InvoiceListItemDto[];
  total: number;
  page: number;
  limit: number;
  stats: InvoiceStatsDto;
}

// ─── Detail (GET /api/finanzen/rechnungen/[id]) ──────────────────────────────

export interface InvoiceDetailDto extends InvoiceListItemDto {
  notizen: string | null;
  empfaenger: { name: string; strasse: string | null; plz: string | null; ort: string | null } | null;
  positionen: InvoicePosition[];
  ustSummary: UstSummary[];
  teilzahlungen: { id: string; betrag: number; zahlungsdatum: string; verwendungszweck: string | null }[];
  mahnungen: { id: string; stufe: MahnStufeDto; datum: string; gesendetAm: string | null }[];
  /** Status actions the state machine currently permits for this invoice. */
  erlaubteAktionen: InvoiceAction[];
  /** Whether PDF / XRechnung downloads are available in the current status. */
  downloads: { pdf: boolean; xrechnung: boolean };
}

/** XRechnung requires an issued invoice (also while it is being dunned). */
export function xrechnungErlaubt(status: RechnungStatusDto): boolean {
  return status === 'GESTELLT' || status === 'BEZAHLT' || status === 'MAHNUNG';
}

export interface InvoiceActionResponse {
  rechnung: InvoiceDetailDto;
  sideEffects?: { stornoRechnungId?: string; mahnungId?: string };
}

// ─── Batch actions (list view) ───────────────────────────────────────────────

export interface BatchResult {
  id: string;
  ok: boolean;
  error?: string;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Apply one status action to several invoices, one request per invoice, in order.
 * Never throws: each invoice reports its own success or the API's error text,
 * so a partial failure is visible to the user instead of silently ignored.
 */
export async function runInvoiceBatchAction(
  ids: string[],
  action: InvoiceAction,
  fetcher: Fetcher = fetch,
): Promise<BatchResult[]> {
  const results: BatchResult[] = [];
  for (const id of ids) {
    try {
      const res = await fetcher(`/api/finanzen/rechnungen/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildInvoiceActionBody(action)),
      });
      if (res.ok) {
        results.push({ id, ok: true });
      } else {
        const data = await res.json().catch(() => ({}));
        results.push({ id, ok: false, error: data?.error ?? `HTTP ${res.status}` });
      }
    } catch (err) {
      results.push({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
