import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb, createUser, createAkte, createKontakt, asUser, req, params } from './helpers'
import { kontakteListUrl, type KontakteListResponse } from '@/lib/kontakte/liste'
import { beteiligteUrl, conflictCheckUrl, type AddBeteiligterBody } from '@/lib/kontakte/beteiligte'

const list = async (url: string) => (await import('@/app/api/kontakte/route')).GET(req(url))

describe('Kontakte-Liste: gemeinsamer Vertrag', () => {
  beforeEach(resetDb)

  it('Suche (wie DSGVO-Seite/Beteiligten-Dialog) filtert und liefert {kontakte,total}', async () => {
    asUser(await createUser('ADMIN'))
    for (let i = 0; i < 12; i++) await createKontakt({ nachname: `Anders${i}` })
    const ziel = await createKontakt({ nachname: 'Zielperson' })

    const body = (await (await list(kontakteListUrl({ q: 'zielp', take: 10 }))).json()) as KontakteListResponse
    expect(Array.isArray(body)).toBe(false)
    expect(body.total).toBe(1)
    expect(body.kontakte.map((k) => k.id)).toEqual([ziel.id])
  })

  it('findet und zeigt die Anschrift aus der Adressen-Relation (Formular) und aus Altfeldern (Import)', async () => {
    asUser(await createUser('ADMIN'))
    const formular = await createKontakt({
      nachname: 'Formular',
      adressen: {
        create: [
          { typ: 'ZUSTELLANSCHRIFT', strasse: 'Nebenweg', plz: '50667', ort: 'Köln' },
          { typ: 'HAUPTANSCHRIFT', strasse: 'Hauptstr.', hausnummer: '1', plz: '44787', ort: 'Bochum', istHaupt: true },
        ],
      },
    })
    const importiert = await createKontakt({ nachname: 'Import', strasse: 'Altweg 2', plz: '10115', ort: 'Berlin' })

    const bochum = (await (await list(kontakteListUrl({ q: 'Bochum' }))).json()) as KontakteListResponse
    expect(bochum.kontakte.map((k) => k.id)).toEqual([formular.id])
    expect(bochum.kontakte[0].anschrift).toMatchObject({ strasse: 'Hauptstr.', hausnummer: '1', plz: '44787', ort: 'Bochum' })

    const berlin = (await (await list(kontakteListUrl({ q: 'Berlin' }))).json()) as KontakteListResponse
    expect(berlin.kontakte.map((k) => k.id)).toEqual([importiert.id])
    expect(berlin.kontakte[0].anschrift).toMatchObject({ strasse: 'Altweg 2', ort: 'Berlin' })

    const { GET } = await import('@/app/api/kontakte/export/route')
    const csv = await (await GET(req('/api/kontakte/export?format=csv&q=Formular'))).text()
    expect(csv).toContain('Hauptstr. 1')
    expect(csv).toContain('44787')
    expect(csv).toContain('Bochum')
  })

  it('ungültige take/skip-Werte führen nicht zu einem Fehler', async () => {
    asUser(await createUser('ADMIN'))
    await createKontakt()
    const res = await list('/api/kontakte?take=abc&skip=-5')
    expect(res.status).toBe(200)
    expect(((await res.json()) as KontakteListResponse).total).toBe(1)
  })
})

describe('Beteiligten-Dialog: Kollisionsprüfung und Hinzufügen', () => {
  beforeEach(resetDb)

  it('meldet Interessenkonflikt und fügt mit der Dialog-Nutzlast hinzu', async () => {
    const anwalt = await createUser('ANWALT')
    const akte = await createAkte({ anwaltId: anwalt.id })
    const andere = await createAkte({ anwaltId: anwalt.id })
    const kontakt = await createKontakt()
    await prisma.beteiligter.create({ data: { akteId: andere.id, kontaktId: kontakt.id, rolle: 'GEGNER' } })
    asUser(anwalt)

    const cc = await import('@/app/api/akten/[id]/conflict-check/route')
    const check = await cc.GET(req(conflictCheckUrl(akte.id, kontakt.id, 'MANDANT')), params({ id: akte.id }))
    expect(check.status).toBe(200)
    const result = await check.json()
    expect(result.hasConflict).toBe(true)
    expect(result.conflicts[0]).toMatchObject({ aktenzeichen: andere.aktenzeichen, existingRolle: 'GEGNER' })

    const bad = await cc.GET(req(`/api/akten/${akte.id}/conflict-check?kontaktId=${kontakt.id}&rolle=CHEF`), params({ id: akte.id }))
    expect(bad.status).toBe(400)

    const body: AddBeteiligterBody = { kontaktId: kontakt.id, rolle: 'MANDANT' }
    const { POST } = await import('@/app/api/akten/[id]/beteiligte/route')
    const res = await POST(req(beteiligteUrl(akte.id), { method: 'POST', json: body }), params({ id: akte.id }))
    expect(res.status).toBe(201)
    expect(await prisma.beteiligter.count({ where: { akteId: akte.id, kontaktId: kontakt.id, rolle: 'MANDANT' } })).toBe(1)
  })
})
