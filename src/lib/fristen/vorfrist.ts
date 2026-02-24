/**
 * Vorfrist (Pre-Deadline Reminder) and Halbfrist (Half-Period) Calculation
 *
 * Vorfristen are shifted to the PREVIOUS business day if they fall on
 * a weekend or holiday (NOT the next business day -- this is the opposite
 * of Section 193 deadline extension).
 *
 * Pure functions. No side effects.
 */

import { subDays, addDays, differenceInDays, startOfDay } from 'date-fns'
import { vorherigerGeschaeftstag, isGeschaeftstag } from './rechner'
import type { BundeslandCode, VorfristDatum } from './types'

/**
 * Calculate Vorfristen (pre-deadline reminders) for a given deadline.
 *
 * Each Vorfrist is calculated as Kalendertage (calendar days) before the deadline.
 * If a Vorfrist falls on a weekend or holiday, it is shifted to the PREVIOUS
 * business day (Arbeitstag), never forward.
 *
 * @param endDatum - The deadline end date
 * @param tageVorherList - Array of calendar day offsets (e.g., [7, 3, 1])
 * @param bundesland - Federal state for holiday lookup
 * @returns Array of VorfristDatum, one per entry in tageVorherList
 */
export function berechneVorfristen(
  endDatum: Date,
  tageVorherList: number[],
  bundesland: BundeslandCode,
): VorfristDatum[] {
  const end = startOfDay(endDatum)

  return tageVorherList.map((tageVorher) => {
    const originalDatum = subDays(end, tageVorher)

    // If not a business day, shift to PREVIOUS business day
    let datum = originalDatum
    let verschoben = false

    if (!isGeschaeftstag(originalDatum, bundesland)) {
      // vorherigerGeschaeftstag finds the business day BEFORE the given date,
      // but we want the business day AT or BEFORE. If the date itself is not
      // a business day, we go backwards. Since we already know it's not a
      // business day, we need to find the previous one.
      // vorherigerGeschaeftstag always goes at least 1 day back, which is what we want.
      datum = findPreviousOrCurrentGeschaeftstag(originalDatum, bundesland)
      verschoben = true
    }

    return {
      tageVorher,
      datum,
      verschoben,
      originalDatum,
    }
  })
}

/**
 * Find the previous business day at or before the given date.
 * If the date is already a business day, returns it unchanged.
 * Otherwise goes backward until finding a business day.
 */
function findPreviousOrCurrentGeschaeftstag(
  date: Date,
  bundesland: BundeslandCode,
): Date {
  let current = startOfDay(date)
  while (!isGeschaeftstag(current, bundesland)) {
    current = subDays(current, 1)
  }
  return current
}

/**
 * Calculate the Halbfrist (half-period reminder) for a deadline.
 *
 * Only computed for deadlines longer than 2 weeks (14 days).
 * The Halbfrist is the midpoint between start and end date.
 * If it falls on a weekend or holiday, it is shifted to the PREVIOUS business day.
 *
 * @param startDatum - The start date of the Frist
 * @param endDatum - The end date of the Frist
 * @param bundesland - Federal state for holiday lookup
 * @returns The Halbfrist date, or null if deadline is <= 2 weeks
 */
export function berechneHalbfrist(
  startDatum: Date,
  endDatum: Date,
  bundesland: BundeslandCode,
): Date | null {
  const start = startOfDay(startDatum)
  const end = startOfDay(endDatum)

  const totalDays = differenceInDays(end, start)

  // Only for deadlines > 2 weeks (strictly greater than 14 days)
  if (totalDays <= 14) {
    return null
  }

  // Calculate midpoint
  const halfDays = Math.floor(totalDays / 2)
  const midpoint = addDays(start, halfDays)

  // Shift to previous business day if needed
  return findPreviousOrCurrentGeschaeftstag(midpoint, bundesland)
}
