/**
 * Holiday Wrapper for feiertagejs
 *
 * Thin wrapper around the feiertagejs library providing type-safe access
 * to German federal state holidays. No side effects, no DB access.
 */

import * as feiertagejs from 'feiertagejs'
import type { BundeslandCode } from './types'

/**
 * Normalize a date to noon (12:00) to avoid timezone issues with feiertagejs.
 *
 * feiertagejs compares UTC dates internally, but local midnight in CET/CEST
 * maps to the previous day in UTC. Using noon ensures the UTC date matches
 * the local calendar date regardless of timezone.
 */
function toNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
}

/**
 * Check if a given date is a public holiday in the specified Bundesland.
 *
 * @param date - The date to check
 * @param bundesland - Two-letter Bundesland code
 * @returns true if the date is a public holiday
 */
export function istFeiertag(date: Date, bundesland: BundeslandCode): boolean {
  return feiertagejs.isHoliday(toNoon(date), bundesland)
}

/**
 * Get all public holidays for a given year and Bundesland.
 *
 * @param year - The year
 * @param bundesland - Two-letter Bundesland code
 * @returns Array of holiday objects with name and date
 */
export function getFeiertage(
  year: number,
  bundesland: BundeslandCode,
): Array<{ name: string; date: Date; dateString: string }> {
  const holidays = feiertagejs.getHolidays(year, bundesland)
  return holidays.map((h) => ({
    name: h.translate('de') ?? h.name,
    date: h.date,
    dateString: h.dateString,
  }))
}

/**
 * Get the name of the holiday on a specific date, or null if not a holiday.
 *
 * @param date - The date to check
 * @param bundesland - Two-letter Bundesland code
 * @returns Holiday name in German, or null
 */
export function getFeiertagName(
  date: Date,
  bundesland: BundeslandCode,
): string | null {
  const holiday = feiertagejs.getHolidayByDate(toNoon(date), bundesland)
  if (!holiday) return null
  return holiday.translate('de') ?? holiday.name
}
