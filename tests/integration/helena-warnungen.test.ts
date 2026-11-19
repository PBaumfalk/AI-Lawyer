import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb, createUser, createAkte } from './helpers'
import { readResolution } from '@/lib/helena/alert-meta'

describe('Helena-Warnungen: Grund der automatischen Erledigung', () => {
  beforeEach(resetDb)

  it('die Oberfläche liest den Grund, den der Scanner schreibt', async () => {
    const user = await createUser('ANWALT')
    const akte = await createAkte({ anwaltId: user.id })
    const frist = await prisma.kalenderEintrag.create({
      data: { akteId: akte.id, typ: 'FRIST', titel: 'Berufung', datum: new Date(), verantwortlichId: user.id, erledigt: true, erledigtAm: new Date() },
    })
    const alert = await prisma.helenaAlert.create({
      data: { akteId: akte.id, userId: user.id, typ: 'FRIST_KRITISCH', titel: 'Frist kritisch', meta: { fristId: frist.id } } as any,
    })

    const { resolveStaleAlerts } = await import('@/lib/scanner/service')
    expect(await resolveStaleAlerts()).toBeGreaterThanOrEqual(1)

    const stored = await prisma.helenaAlert.findUniqueOrThrow({ where: { id: alert.id } })
    const resolution = readResolution(stored.meta)
    expect(resolution?.reason).toBe('Frist erledigt')
    // Other meta keys survive the resolution.
    expect((stored.meta as any).fristId).toBe(frist.id)
  })

  it('robust bei fehlenden oder kaputten Meta-Daten', () => {
    expect(readResolution(null)).toBeNull()
    expect(readResolution([])).toBeNull()
    expect(readResolution({ resolvedAt: 5 })).toBeNull()
    expect(readResolution({ resolvedAt: '2026-01-01T00:00:00Z' })).toEqual({ resolvedAt: '2026-01-01T00:00:00Z', reason: null })
  })
})
