import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb, createUser, createAkte, asUser, req } from './helpers'
import { BI_ANWALT_OPTIONS_URL } from '@/lib/bi/types'

const kpis = async (query = '') => (await import('@/app/api/bi/kpis/route')).GET(req(`/api/bi/kpis${query}`))
const trends = async (query = '') => (await import('@/app/api/bi/trends/route')).GET(req(`/api/bi/trends${query}`))

function tile(body: any, id: string) {
  return body.tiles.find((t: any) => t.id === id)
}

/** A FRIST in the current month, optionally done on time / late / open. */
async function frist(akteId: string, state: 'puenktlich' | 'verspaetet' | 'offen') {
  const now = new Date()
  const datum = new Date(now.getFullYear(), now.getMonth(), 10, 12)
  return prisma.kalenderEintrag.create({
    data: {
      akteId,
      typ: 'FRIST',
      titel: 'Frist',
      datum,
      verantwortlichId: (await prisma.user.findFirstOrThrow()).id,
      erledigt: state !== 'offen',
      erledigtAm:
        state === 'puenktlich' ? new Date(datum.getTime() - 86400_000) : state === 'verspaetet' ? new Date(datum.getTime() + 86400_000) : null,
    } as any,
  })
}

describe('BI-Dashboard', () => {
  beforeEach(resetDb)

  it('liefert Fristen-KPIs (Raw-SQL auf echte Tabelle) und rechnet nur über eigene Akten', async () => {
    const anwalt = await createUser('ANWALT')
    const fremd = await createUser('ANWALT')
    const eigene = await createAkte({ anwaltId: anwalt.id })
    const fremde = await createAkte({ anwaltId: fremd.id })
    await frist(eigene.id, 'puenktlich')
    await frist(eigene.id, 'verspaetet')
    // Three on-time Fristen in an Akte the user may not see must not count.
    await frist(fremde.id, 'puenktlich')
    await frist(fremde.id, 'puenktlich')
    await frist(fremde.id, 'puenktlich')

    asUser(anwalt)
    const res = await kpis()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(tile(body, 'fristen-compliance').value).toBe(50)
  })

  it('wendet Anwalt- und Sachgebiet-Filter auf alle Bereiche an', async () => {
    const admin = await createUser('ADMIN')
    const a1 = await createUser('ANWALT')
    const a2 = await createUser('ANWALT')
    const akte1 = await createAkte({ anwaltId: a1.id, sachgebiet: 'ARBEITSRECHT' })
    const akte2 = await createAkte({ anwaltId: a2.id, sachgebiet: 'MIETRECHT' })
    await frist(akte1.id, 'offen')
    await frist(akte2.id, 'puenktlich')
    await prisma.kalenderEintrag.updateMany({ data: { datum: new Date(Date.now() - 3600_000) }, where: { akteId: akte1.id } })

    asUser(admin)
    const alle = await (await kpis()).json()
    expect(tile(alle, 'akten-offen').value).toBe(2)
    expect(tile(alle, 'fristen-ueberfaellig').value).toBe(1)

    const nurA2 = await (await kpis(`?anwaltId=${a2.id}`)).json()
    expect(tile(nurA2, 'akten-offen').value).toBe(1)
    expect(tile(nurA2, 'fristen-ueberfaellig').value).toBe(0)
    expect(tile(nurA2, 'fristen-compliance').value).toBe(100)

    const arbeitsrecht = await (await kpis('?sachgebiet=ARBEITSRECHT')).json()
    expect(tile(arbeitsrecht, 'fristen-ueberfaellig').value).toBe(1)

    const t = await (await trends(`?anwaltId=${a2.id}`)).json()
    const neuzugang = t.series.find((s: any) => s.id === 'akten-neuzugang')
    expect(neuzugang.data.at(-1).value).toBe(1)
  })

  it('weist ungültige Filterwerte mit 400 statt 500 ab', async () => {
    asUser(await createUser('ADMIN'))
    expect((await kpis('?sachgebiet=GIBTESNICHT')).status).toBe(400)
    expect((await kpis('?zeitraum=woche')).status).toBe(400)
    expect((await kpis('?zeitraum=custom&von=kaputt')).status).toBe(400)
  })

  it('zeigt Token-Verbrauch Nicht-Admins nur für eigene Nutzung', async () => {
    const anwalt = await createUser('ANWALT')
    const anderer = await createUser('ANWALT')
    const base = { funktion: 'CHAT', provider: 'ollama', model: 'm', tokensIn: 10, tokensOut: 5 }
    await prisma.tokenUsage.create({ data: { ...base, userId: anwalt.id } })
    await prisma.tokenUsage.create({ data: { ...base, userId: anderer.id, tokensIn: 1000 } })
    asUser(anwalt)
    const body = await (await kpis()).json()
    expect(tile(body, 'helena-token').value).toBe(15)
  })

  it('verweigert Mandanten den Zugriff', async () => {
    asUser(await createUser('MANDANT'))
    expect((await kpis()).status).toBe(403)
  })

  it('Anwalt-Auswahl: die von der Oberfläche aufgerufene Route liefert die Anwälte', async () => {
    const anwalt = await createUser('ANWALT')
    await createUser('SEKRETARIAT')
    asUser(anwalt)
    const { GET } = await import('@/app/api/users/route')
    const res = await GET(req(BI_ANWALT_OPTIONS_URL))
    expect(res.status).toBe(200)
    const users = await res.json()
    expect(users.map((u: any) => u.id)).toEqual([anwalt.id])
  })
})
