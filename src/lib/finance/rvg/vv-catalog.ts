// VV Verguetungsverzeichnis - RVG VV Position Catalog
// Complete catalog of all major VV fee positions with metadata

import type { VVPosition } from './types';

/**
 * Complete VV (Verguetungsverzeichnis) position catalog.
 * Contains all major fee positions needed for RVG calculation.
 *
 * Organized by VV Part:
 * - Part 1: Allgemeine Gebuehren (1000-1008)
 * - Part 2: Aussergerichtliche Taetigkeit (2300)
 * - Part 3: Buergerliche Rechtsstreitigkeiten (3100-3307)
 * - Part 7: Auslagen (7002-7008)
 */
export const VV_CATALOG: VVPosition[] = [
  // ============================================
  // Part 1 - Allgemeine Gebuehren
  // ============================================
  {
    nr: '1000',
    name: 'Einigungsgebuehr (aussergerichtlich)',
    feeType: 'wertgebuehr',
    defaultRate: 1.5,
    minRate: 0.2,
    maxRate: 1.5,
    part: 1,
    category: 'einigung',
    triggersAnrechnung: false,
    anrechnungTarget: null,
    isAutoAddable: false,
    description: 'Einigungsgebuehr fuer aussergerichtliche Einigung (VV 1000 RVG)',
  },
  {
    nr: '1003',
    name: 'Einigungsgebuehr (gerichtlich)',
    feeType: 'wertgebuehr',
    defaultRate: 1.0,
    minRate: 0.2,
    maxRate: 1.0,
    part: 1,
    category: 'einigung',
    triggersAnrechnung: false,
    anrechnungTarget: null,
    isAutoAddable: false,
    description: 'Einigungsgebuehr fuer gerichtliche Einigung/Vergleich (VV 1003 RVG)',
  },
  {
    nr: '1008',
    name: 'Erhoehungsgebuehr (Streitgenossen)',
    feeType: 'wertgebuehr',
    defaultRate: 0.3,
    minRate: 0.3,
    maxRate: 2.0,
    part: 1,
    category: 'zuschlag',
    triggersAnrechnung: false,
    anrechnungTarget: null,
    isAutoAddable: false,
    description: 'Erhoehung fuer mehrere Auftraggeber: 0.3 je weiterem Auftraggeber, max. Gesamterhoehung 2.0 (VV 1008 RVG)',
  },

  // ============================================
  // Part 2 - Aussergerichtliche Taetigkeit
  // ============================================
  {
    nr: '2300',
    name: 'Geschaeftsgebuehr',
    feeType: 'wertgebuehr',
    defaultRate: 1.3,
    minRate: 0.5,
    maxRate: 2.5,
    part: 2,
    category: 'geschaeft',
    triggersAnrechnung: true,
    anrechnungTarget: '3100',
    isAutoAddable: false,
    description: 'Geschaeftsgebuehr fuer aussergerichtliche Vertretung. Anrechnung auf VV 3100 nach Vorbem. 3 Abs. 4 VV RVG.',
  },

  // ============================================
  // Part 3 - Buergerliche Rechtsstreitigkeiten
  // ============================================
  {
    nr: '3100',
    name: 'Verfahrensgebuehr',
    feeType: 'wertgebuehr',
    defaultRate: 1.3,
    minRate: 0.5,
    maxRate: 1.3,
    part: 3,
    category: 'verfahren',
    triggersAnrechnung: false,
    anrechnungTarget: null,
    isAutoAddable: false,
    description: 'Verfahrensgebuehr 1. Instanz (VV 3100 RVG)',
  },
  {
    nr: '3104',
    name: 'Terminsgebuehr',
    feeType: 'wertgebuehr',
    defaultRate: 1.2,
    minRate: 0.5,
    maxRate: 1.2,
    part: 3,
    category: 'termin',
    triggersAnrechnung: false,
    anrechnungTarget: null,
    isAutoAddable: false,
    description: 'Terminsgebuehr 1. Instanz (VV 3104 RVG)',
  },
  {
    nr: '3200',
    name: 'Verfahrensgebuehr Berufung',
    feeType: 'wertgebuehr',
    defaultRate: 1.6,
    minRate: 0.5,
    maxRate: 1.6,
    part: 3,
    category: 'verfahren',
    triggersAnrechnung: false,
    anrechnungTarget: null,
    isAutoAddable: false,
    description: 'Verfahrensgebuehr in der Berufungsinstanz (VV 3200 RVG)',
  },
  {
    nr: '3202',
    name: 'Terminsgebuehr Berufung',
    feeType: 'wertgebuehr',
    defaultRate: 1.2,
    minRate: 0.5,
    maxRate: 1.2,
    part: 3,
    category: 'termin',
    triggersAnrechnung: false,
    anrechnungTarget: null,
    isAutoAddable: false,
    description: 'Terminsgebuehr in der Berufungsinstanz (VV 3202 RVG)',
  },
  {
    nr: '3305',
    name: 'Verfahrensgebuehr Mahnverfahren',
    feeType: 'wertgebuehr',
    defaultRate: 0.5,
    minRate: null,
    maxRate: null,
    part: 3,
    category: 'mahnverfahren',
    triggersAnrechnung: false,
    anrechnungTarget: null,
    isAutoAddable: false,
    description: 'Verfahrensgebuehr im Mahnverfahren (VV 3305 RVG). Halbe Gebuehr.',
  },
  {
    nr: '3307',
    name: 'Verfahrensgebuehr Mahnverfahren (Widerspruch)',
    feeType: 'wertgebuehr',
    defaultRate: 0.5,
    minRate: null,
    maxRate: null,
    part: 3,
    category: 'mahnverfahren',
    triggersAnrechnung: false,
    anrechnungTarget: null,
    isAutoAddable: false,
    description: 'Verfahrensgebuehr bei Widerspruch/Einspruch im Mahnverfahren (VV 3307 RVG)',
  },

  // ============================================
  // Part 7 - Auslagen
  // ============================================
  {
    nr: '7002',
    name: 'Auslagenpauschale',
    feeType: 'auslagen',
    defaultRate: 0.20,
    minRate: null,
    maxRate: null,
    part: 7,
    category: 'auslagen',
    triggersAnrechnung: false,
    anrechnungTarget: null,
    isAutoAddable: true,
    description: 'Pauschale fuer Entgelte fuer Post- und Telekommunikationsdienstleistungen: 20% der Gebuehren, max. 20.00 EUR (VV 7002 RVG)',
  },
  {
    nr: '7003',
    name: 'Fahrtkosten',
    feeType: 'auslagen',
    defaultRate: 0.42,
    minRate: null,
    maxRate: null,
    part: 7,
    category: 'reisekosten',
    triggersAnrechnung: false,
    anrechnungTarget: null,
    isAutoAddable: false,
    description: 'Fahrtkosten: 0.42 EUR je gefahrenen km (VV 7003 RVG)',
  },
  {
    nr: '7005',
    name: 'Abwesenheitsgeld',
    feeType: 'auslagen',
    defaultRate: 0,
    minRate: null,
    maxRate: null,
    part: 7,
    category: 'reisekosten',
    triggersAnrechnung: false,
    anrechnungTarget: null,
    isAutoAddable: false,
    description: 'Tage-/Abwesenheitsgeld: bis 4h = 30 EUR, 4-8h = 50 EUR, ueber 8h = 80 EUR (VV 7005 RVG)',
  },
  {
    nr: '7008',
    name: 'Umsatzsteuer (19%)',
    feeType: 'auslagen',
    defaultRate: 0.19,
    minRate: null,
    maxRate: null,
    part: 7,
    category: 'steuer',
    triggersAnrechnung: false,
    anrechnungTarget: null,
    isAutoAddable: true,
    description: 'Umsatzsteuer auf die Verguetung: 19% (VV 7008 RVG)',
  },
];

/**
 * Look up a VV position by its exact number.
 *
 * @param nr - VV number (e.g., "3100")
 * @returns The VV position or undefined if not found
 */
export function getVvPosition(nr: string): VVPosition | undefined {
  return VV_CATALOG.find((pos) => pos.nr === nr);
}

/**
 * Search VV positions by number or keyword.
 * Searches in nr, name, description, and category fields.
 *
 * @param query - Search query string
 * @returns Matching VV positions
 */
export function searchVvPositions(query: string): VVPosition[] {
  if (!query || query.trim() === '') return [];

  const lowerQuery = query.toLowerCase().trim();

  const matches = VV_CATALOG.filter((pos) => {
    return (
      pos.nr.includes(lowerQuery) ||
      pos.name.toLowerCase().includes(lowerQuery) ||
      (pos.description?.toLowerCase().includes(lowerQuery) ?? false) ||
      pos.category.toLowerCase().includes(lowerQuery)
    );
  });

  // Sort: exact nr matches first, then nr-partial matches, then other matches
  return matches.sort((a, b) => {
    const aExact = a.nr === lowerQuery ? 0 : a.nr.includes(lowerQuery) ? 1 : 2;
    const bExact = b.nr === lowerQuery ? 0 : b.nr.includes(lowerQuery) ? 1 : 2;
    return aExact - bExact;
  });
}
