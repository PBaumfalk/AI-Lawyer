import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb, createUser, createAkte, asUser, req, params } from './helpers'
import { vorlageFreigabeRequest } from '@/lib/vorlagen-freigabe'
import { vorlageGenerierenUrl, type VorlageGenerierenBody } from '@/lib/vorlagen-generieren'

const storage = vi.hoisted(() => ({
  getFileStream: vi.fn(async () => (async function* () { yield new Uint8Array([1, 2, 3]) })()),
  uploadFile: vi.fn(async () => undefined),
}))
vi.mock('@/lib/storage', () => storage)

const vorlagenLib = vi.hoisted(() => ({ fill: vi.fn((_t: Buffer, _d: unknown, _c?: Record<string, string>) => Buffer.from('docx')) }))
vi.mock('@/lib/vorlagen', async (orig) => ({
  ...(await orig<typeof import('@/lib/vorlagen')>()),
  fillDocxTemplate: vorlagenLib.fill,
}))

const briefkopfLib = vi.hoisted(() => ({ apply: vi.fn((doc: Buffer) => doc) }))
vi.mock('@/lib/briefkopf', async (orig) => ({
  ...(await orig<typeof import('@/lib/briefkopf')>()),
  applyBriefkopfToDocx: briefkopfLib.apply,
}))

async function vorlage(createdById: string, extra: Record<string, unknown> = {}) {
  return prisma.dokumentVorlage.create({
    data: { name: 'V', dateipfad: 'vorlagen/v.docx', dateiname: 'v.docx', groesse: 3, platzhalter: [], tags: [], favoritenVon: [], createdById, ...extra } as any,
  })
}

describe('Vorlagen', () => {
  beforeEach(async () => {
    await resetDb()
    vi.clearAllMocks()
  })

  it('„Zurückziehen“ hebt die Freigabe auf, „Freigeben“ setzt sie', async () => {
    const anwalt = await createUser('ANWALT')
    asUser(anwalt)
    const v = await vorlage(anwalt.id, { freigegeben: true, freigegebenVonId: anwalt.id, freigegebenAm: new Date() })
    const route = await import('@/app/api/vorlagen/[id]/freigabe/route')
    const call = async (freigeben: boolean) => {
      const { url, init } = vorlageFreigabeRequest(v.id, freigeben)
      return (route as any)[init.method](req(url, init), params({ id: v.id })) as Promise<Response>
    }
    expect((await call(false)).status).toBe(200)
    expect((await prisma.dokumentVorlage.findUniqueOrThrow({ where: { id: v.id } })).freigegeben).toBe(false)
    expect((await call(true)).status).toBe(200)
    expect((await prisma.dokumentVorlage.findUniqueOrThrow({ where: { id: v.id } })).freigegeben).toBe(true)
  })

  async function generieren(body: VorlageGenerierenBody, vorlageId: string) {
    const { POST } = await import('@/app/api/vorlagen/[id]/generieren/route')
    return POST(req(vorlageGenerierenUrl(vorlageId), { method: 'POST', json: body }), params({ id: vorlageId }))
  }

  it('übergibt die Feldwerte des Assistenten und beachtet „Kein Briefkopf“', async () => {
    const anwalt = await createUser('ANWALT')
    asUser(anwalt)
    const akte = await createAkte({ anwaltId: anwalt.id })
    const v = await vorlage(anwalt.id, { freigegeben: true })
    await prisma.briefkopf.create({ data: { name: 'Standard', dateipfad: 'bk/std.docx', istStandard: true, anwaelte: [] } as any })

    const ohne = await generieren({ akteId: akte.id, customFelderValues: { frist: '14 Tage' }, briefkopfId: null }, v.id)
    expect(ohne.status).toBeLessThan(300)
    expect(vorlagenLib.fill.mock.calls[0][2]).toEqual({ frist: '14 Tage' })
    expect(briefkopfLib.apply).not.toHaveBeenCalled()

    const mitStandard = await generieren({ akteId: akte.id }, v.id)
    expect(mitStandard.status).toBeLessThan(300)
    expect(briefkopfLib.apply).toHaveBeenCalledTimes(1)
  })

  it('lehnt ungültige Feldwerte mit 400 ab', async () => {
    const anwalt = await createUser('ANWALT')
    asUser(anwalt)
    const akte = await createAkte({ anwaltId: anwalt.id })
    const v = await vorlage(anwalt.id, { freigegeben: true })
    const res = await generieren({ akteId: akte.id, customFelderValues: { x: 5 as any } }, v.id)
    expect(res.status).toBe(400)
  })
})
