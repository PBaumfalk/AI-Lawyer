import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb, createUser, createAkte, createKontakt } from './helpers'
import { anonymizeJsonValue, buildNameRegex, anonymizeKontakt } from '@/lib/dsgvo/anonymize'

describe('DSGVO-Anonymisierung von Audit-Einträgen', () => {
  beforeEach(resetDb)

  it('ersetzt Namen in allen Einträgen, auch mit Sonderzeichen im Namen', async () => {
    const admin = await createUser('ADMIN')
    const akte = await createAkte({ status: 'ARCHIVIERT' })
    const kontakt = await createKontakt({ vorname: 'Max', nachname: 'O"Brien\\Muster' })
    await prisma.beteiligter.create({ data: { akteId: akte.id, kontaktId: kontakt.id, rolle: 'MANDANT' } })
    const texts = ['Max O"Brien\\Muster', 'O"Brien\\Muster', 'Max', 'Max O"Brien\\Muster hat angerufen']
    for (const t of texts) {
      await prisma.auditLog.create({ data: { akteId: akte.id, userId: admin.id, aktion: 'AKTE_BEARBEITET', details: { kontakt: t, liste: [t] } } as any })
    }

    await anonymizeKontakt(kontakt.id, admin.id, 'Test', { forceOverrideRetention: true })

    const logs = await prisma.auditLog.findMany({ where: { akteId: akte.id, aktion: 'AKTE_BEARBEITET' } })
    expect(logs).toHaveLength(texts.length)
    for (const l of logs) {
      const s = JSON.stringify(l.details)
      expect(s).not.toContain('Max')
      expect(s).not.toContain('Brien')
    }
  })

  it('Hilfsfunktion: wiederverwendbar über mehrere Einträge, ganzer Name zuerst', () => {
    const re = buildNameRegex({ vorname: 'Max', nachname: 'Muster', firma: null })!
    const a = anonymizeJsonValue({ k: 'Max Muster' }, re)
    const b = anonymizeJsonValue({ k: 'Muster' }, re)
    const c = anonymizeJsonValue({ k: 'nichts', n: 5, x: null }, re)
    expect(a).toEqual({ value: { k: 'Anonymisiert' }, changed: true })
    expect(b).toEqual({ value: { k: 'Anonymisiert' }, changed: true })
    expect(c).toEqual({ value: { k: 'nichts', n: 5, x: null }, changed: false })
  })
})
