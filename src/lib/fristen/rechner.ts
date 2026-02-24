/**
 * FristenRechner - German Legal Deadline Calculator
 *
 * Pure function implementation of BGB Sections 187-193 deadline calculation.
 * No side effects, no DB access, no process.env reads.
 *
 * Uses date-fns for ALL date arithmetic (never native Date methods).
 * Uses feiertagejs (via feiertage.ts wrapper) for holiday lookup.
 */

import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  isSaturday,
  isSunday,
  startOfDay,
} from 'date-fns'
import { istFeiertag, getFeiertagName } from './feiertage'
import type {
  BundeslandCode,
  FristInput,
  FristErgebnis,
  FristRueckwaertsInput,
  FristRueckwaertsErgebnis,
  FristDauer,
  VerschiebungsGrund,
} from './types'

/**
 * Check if a date is a Geschaeftstag (business day) in the given Bundesland.
 * A Geschaeftstag is neither Saturday, Sunday, nor a public holiday.
 */
export function isGeschaeftstag(date: Date, bundesland: BundeslandCode): boolean {
  const d = startOfDay(date)
  if (isSaturday(d)) return false
  if (isSunday(d)) return false
  if (istFeiertag(d, bundesland)) return false
  return true
}

/**
 * Get the next Geschaeftstag (business day) after the given date.
 * If the given date is already a business day, returns the NEXT one (not the same day).
 */
export function naechsterGeschaeftstag(date: Date, bundesland: BundeslandCode): Date {
  let current = addDays(startOfDay(date), 1)
  while (!isGeschaeftstag(current, bundesland)) {
    current = addDays(current, 1)
  }
  return current
}

/**
 * Get the previous Geschaeftstag (business day) before the given date.
 * If the given date is already a business day, returns the PREVIOUS one (not the same day).
 */
export function vorherigerGeschaeftstag(date: Date, bundesland: BundeslandCode): Date {
  let current = subDays(startOfDay(date), 1)
  while (!isGeschaeftstag(current, bundesland)) {
    current = subDays(current, 1)
  }
  return current
}

/**
 * Apply duration to a date using date-fns.
 * Handles month-end overflow correctly per BGB Section 188 Abs. 3:
 * If the target day doesn't exist in the target month, use the last day of that month.
 *
 * BGB 188(2): For month/year periods, the end date corresponds to the day number
 * of the event date. If that day doesn't exist, use last day of month.
 */
function addDuration(date: Date, dauer: FristDauer): Date {
  let result = startOfDay(date)

  // Apply years first, then months, then weeks, then days
  // This order matters for correct BGB calculation
  if (dauer.jahre) {
    result = addYearsWithOverflow(result, dauer.jahre)
  }
  if (dauer.monate) {
    result = addMonthsWithOverflow(result, dauer.monate)
  }
  if (dauer.wochen) {
    result = addWeeks(result, dauer.wochen)
  }
  if (dauer.tage) {
    result = addDays(result, dauer.tage)
  }

  return result
}

/**
 * Add months with correct BGB overflow handling.
 * date-fns addMonths already handles overflow by clamping to end of month,
 * which matches BGB 188(3) behavior.
 */
function addMonthsWithOverflow(date: Date, months: number): Date {
  return addMonths(date, months)
}

/**
 * Add years with correct BGB overflow handling.
 * date-fns addYears handles Feb 29 -> Feb 28 correctly.
 */
function addYearsWithOverflow(date: Date, years: number): Date {
  return addYears(date, years)
}

/**
 * Subtract duration from a date (for backward calculation).
 */
function subtractDuration(date: Date, dauer: FristDauer): Date {
  let result = startOfDay(date)

  if (dauer.tage) {
    result = subDays(result, dauer.tage)
  }
  if (dauer.wochen) {
    result = subWeeks(result, dauer.wochen)
  }
  if (dauer.monate) {
    result = subMonths(result, dauer.monate)
  }
  if (dauer.jahre) {
    result = subYears(result, dauer.jahre)
  }

  return result
}

/**
 * Get the reason why a date is not a business day.
 */
function getShiftReason(date: Date, bundesland: BundeslandCode): string {
  if (istFeiertag(date, bundesland)) {
    const name = getFeiertagName(date, bundesland)
    return name ?? 'Feiertag'
  }
  if (isSaturday(date)) return 'Samstag'
  if (isSunday(date)) return 'Sonntag'
  return 'Unbekannt'
}

/**
 * Calculate the end date of a Frist (Ereignisfrist).
 *
 * BGB 187(1) + 188(2): Event day NOT counted. Period of months/years ends on the day
 * of the last month/year whose number corresponds to the event day.
 *
 * For day/week periods: Simply count calendar days/weeks from the day AFTER the event.
 *
 * The key insight: For Ereignisfrist with months/years, the end date corresponds to
 * the event date's day number in the target month. For days/weeks, it's straightforward
 * counting from the next day.
 */
function calculateEreignisfristEnd(zustellungsdatum: Date, dauer: FristDauer): Date {
  const eventDay = startOfDay(zustellungsdatum)

  // For Ereignisfrist, the frist starts the day after the event
  // BGB 188(2): For month/year periods, the frist ends on the day corresponding
  // to the event date in the target month.
  // This means: event on March 15 + 1 month -> end April 15
  // (NOT: start March 16, then +1 month = April 16)

  // Split dauer into month/year components and day/week components
  const hasMonthYear = (dauer.monate ?? 0) > 0 || (dauer.jahre ?? 0) > 0
  const hasDayWeek = (dauer.tage ?? 0) > 0 || (dauer.wochen ?? 0) > 0

  if (hasMonthYear) {
    // For month/year parts: apply to event date directly (BGB 188(2))
    let result = eventDay
    if (dauer.jahre) {
      result = addYearsWithOverflow(result, dauer.jahre)
    }
    if (dauer.monate) {
      result = addMonthsWithOverflow(result, dauer.monate)
    }
    // Then add any day/week parts on top
    if (dauer.wochen) {
      result = addWeeks(result, dauer.wochen)
    }
    if (dauer.tage) {
      result = addDays(result, dauer.tage)
    }
    return result
  } else {
    // For pure day/week periods: count from the day AFTER the event
    const fristStart = addDays(eventDay, 1)
    let result = fristStart
    if (dauer.wochen) {
      result = addWeeks(result, dauer.wochen)
    }
    if (dauer.tage) {
      result = addDays(result, dauer.tage)
    }
    // Subtract 1 because the start day counts as day 1
    result = subDays(result, 1)
    return result
  }
}

/**
 * Calculate the end date of a Frist (Beginnfrist).
 *
 * BGB 187(2): Start day IS counted (begins at 00:00).
 * BGB 188(1): For month/year periods, ends the day BEFORE the corresponding day.
 * For day periods: start day counts, so end is start + days - 1.
 */
function calculateBeginnfristEnd(zustellungsdatum: Date, dauer: FristDauer): Date {
  const startDay = startOfDay(zustellungsdatum)

  // Beginnfrist: the start day is counted.
  // BGB 188(1): A month/year period ends at the end of the day BEFORE the day
  // that corresponds in number to the start day.
  // E.g., March 15 + 1 month: corresponds to April 15, day before = April 14

  const hasMonthYear = (dauer.monate ?? 0) > 0 || (dauer.jahre ?? 0) > 0
  const hasDayWeek = (dauer.tage ?? 0) > 0 || (dauer.wochen ?? 0) > 0

  if (hasMonthYear) {
    // Apply month/year to start date
    let result = startDay
    if (dauer.jahre) {
      result = addYearsWithOverflow(result, dauer.jahre)
    }
    if (dauer.monate) {
      result = addMonthsWithOverflow(result, dauer.monate)
    }
    // Add day/week parts
    if (dauer.wochen) {
      result = addWeeks(result, dauer.wochen)
    }
    if (dauer.tage) {
      result = addDays(result, dauer.tage)
    }
    // Day before the corresponding day
    result = subDays(result, 1)
    return result
  } else {
    // Pure day/week: start day counts as day 1
    let result = startDay
    if (dauer.wochen) {
      result = addWeeks(result, dauer.wochen)
    }
    if (dauer.tage) {
      result = addDays(result, dauer.tage)
    }
    result = subDays(result, 1)
    return result
  }
}

/**
 * Calculate a German legal deadline (Frist) per BGB Sections 187-193.
 *
 * Pure function. No side effects. Thread-safe. Reentrant.
 *
 * @param input - Deadline calculation parameters
 * @returns Complete deadline result including raw and shifted end dates
 */
export function berechneFrist(input: FristInput): FristErgebnis {
  const zustellungsdatum = startOfDay(input.zustellungsdatum)
  const applySection193 = input.section193 !== false // default true

  // Determine start date
  const startDatum =
    input.fristArt === 'EREIGNISFRIST'
      ? addDays(zustellungsdatum, 1) // event day not counted
      : startOfDay(zustellungsdatum) // start day counted

  // Calculate raw end date (before Section 193)
  const rohEndDatum =
    input.fristArt === 'EREIGNISFRIST'
      ? calculateEreignisfristEnd(zustellungsdatum, input.dauer)
      : calculateBeginnfristEnd(zustellungsdatum, input.dauer)

  // Apply Section 193 if requested
  let endDatum = rohEndDatum
  let section193Angewendet = false
  let verschiebungsGruende: VerschiebungsGrund[] = []

  if (applySection193) {
    const { shifted, reasons } = applySection193Shift(rohEndDatum, input.bundesland)
    endDatum = shifted
    section193Angewendet = reasons.length > 0
    verschiebungsGruende = reasons
  }

  return {
    eingabe: input,
    startDatum,
    rohEndDatum,
    endDatum,
    section193Angewendet,
    verschiebungsGruende,
  }
}

/**
 * Section 193 shift extracted to avoid name collision.
 */
function applySection193Shift(
  date: Date,
  bundesland: BundeslandCode,
): { shifted: Date; reasons: VerschiebungsGrund[] } {
  const reasons: VerschiebungsGrund[] = []
  let current = startOfDay(date)

  while (!isGeschaeftstag(current, bundesland)) {
    const grund = getShiftReason(current, bundesland)
    reasons.push({
      datum: current,
      grund,
    })
    current = addDays(current, 1)
  }

  return { shifted: current, reasons }
}

/**
 * Calculate backward from a known deadline end date to find the latest
 * possible Zustellungstermin (service date).
 *
 * This is the inverse of berechneFrist().
 *
 * @param input - Backward calculation parameters
 * @returns The latest possible service date to meet the deadline
 */
export function berechneFristRueckwaerts(
  input: FristRueckwaertsInput,
): FristRueckwaertsErgebnis {
  const fristende = startOfDay(input.fristende)

  let spaetesterZustellungstermin: Date

  if (input.fristArt === 'EREIGNISFRIST') {
    // For Ereignisfrist: event date + period = fristende
    // So event date = fristende - period
    spaetesterZustellungstermin = subtractDuration(fristende, input.dauer)
  } else {
    // For Beginnfrist: start date + period - 1 day = fristende
    // So start date = fristende - period + 1 day
    spaetesterZustellungstermin = addDays(subtractDuration(fristende, input.dauer), 1)
  }

  return {
    eingabe: input,
    spaetesterZustellungstermin,
    fristende,
  }
}
