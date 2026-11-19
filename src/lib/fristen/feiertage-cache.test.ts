import { describe, it, expect, vi } from 'vitest'

// Count how often the expensive library computation runs.
const calls = vi.hoisted(() => ({ getHolidays: 0 }))
vi.mock('feiertagejs', async (orig) => {
  const lib = await orig<typeof import('feiertagejs')>()
  return {
    ...lib,
    getHolidays: (...args: Parameters<typeof lib.getHolidays>) => {
      calls.getHolidays++
      return lib.getHolidays(...args)
    },
  }
})

import * as feiertagejs from 'feiertagejs'
import { istFeiertag, getFeiertagName } from './feiertage'

const LAENDER = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'] as const

describe('Feiertage mit Cache', () => {
  // The reference library itself is slow (that is why the cache exists).
  it('liefert für jeden Tag 2025–2027 in allen Ländern dasselbe wie feiertagejs', () => {
    const abweichungen: string[] = []
    for (const bl of LAENDER) {
      for (let d = new Date(2025, 0, 1, 12); d.getFullYear() <= 2027; d.setDate(d.getDate() + 1)) {
        if (istFeiertag(d, bl) !== feiertagejs.isHoliday(d, bl)) abweichungen.push(`${bl} ${d.toDateString()}`)
        const h = feiertagejs.getHolidayByDate(d, bl)
        if (getFeiertagName(d, bl) !== (h ? (h.translate('de') ?? h.name) : null)) abweichungen.push(`Name ${bl} ${d.toDateString()}`)
      }
    }
    expect(abweichungen).toEqual([])
  }, 120_000)

  it('erkennt Feiertage unabhängig von der Uhrzeit (Mitternacht, spät abends)', () => {
    expect(istFeiertag(new Date(2026, 9, 3, 0, 0), 'NW')).toBe(true)
    expect(istFeiertag(new Date(2026, 9, 3, 23, 59), 'NW')).toBe(true)
    expect(istFeiertag(new Date(2026, 9, 4, 0, 1), 'NW')).toBe(false)
  })

  it('berechnet die Feiertage je Jahr und Land nur einmal', () => {
    const vorher = calls.getHolidays
    for (let i = 0; i < 365 * 3; i++) istFeiertag(new Date(2040, 0, 1 + i, 12), 'SN')
    // 2040, 2041, 2042 → three computations, not ~1000
    expect(calls.getHolidays - vorher).toBe(3)
  })
})
