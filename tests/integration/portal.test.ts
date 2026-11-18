import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb, createUser, createAkte, createKontakt, asUser, req, params } from './helpers'

const mail = vi.hoisted(() => ({ sendEmail: vi.fn(async () => ({ success: true })), isEmailConfigured: vi.fn(() => true) }))
vi.mock('@/lib/email/send', () => mail)

const enqueued = vi.hoisted(() => [] as any[])
vi.mock('@/lib/portal/portal-notification', async (orig) => ({
  ...(await orig<typeof import('@/lib/portal/portal-notification')>()),
  enqueuePortalNotification: vi.fn(async (d: any) => {
    enqueued.push(d)
  }),
}))

describe('Mandantenportal', () => {
  beforeEach(async () => {
    await resetDb()
    enqueued.length = 0
    vi.clearAllMocks()
  })

  it('Hinweis-E-Mails nur an Mandanten mit aktivem Portalkonto', async () => {
    const akte = await createAkte()
    const mitKonto = await createKontakt({ email: 'a@x.de', einwilligungEmail: true })
    const ohneKonto = await createKontakt({ email: 'b@x.de', einwilligungEmail: true })
    const deaktiviert = await createKontakt({ email: 'c@x.de', einwilligungEmail: true })
    await createUser('MANDANT', { kontaktId: mitKonto.id })
    await createUser('MANDANT', { kontaktId: deaktiviert.id, aktiv: false })
    for (const k of [mitKonto, ohneKonto, deaktiviert]) {
      await prisma.beteiligter.create({ data: { akteId: akte.id, kontaktId: k.id, rolle: 'MANDANT' } })
    }
    const { triggerPortalNotificationForAkte } = await import('@/lib/portal/trigger-portal-notification')
    await triggerPortalNotificationForAkte(akte.id, 'neue-nachricht' as any, `/akten/${akte.id}`)
    expect(enqueued.map((e) => e.mandantKontaktId)).toEqual([mitKonto.id])
  })

  it('Versand prüft beim Abarbeiten erneut das Portalkonto', async () => {
    const akte = await createAkte()
    const k = await createKontakt({ email: 'a@x.de', einwilligungEmail: true })
    const { processPortalNotification } = await import('@/lib/portal/portal-notification')
    await processPortalNotification({ type: 'neue-nachricht' as any, mandantKontaktId: k.id, akteId: akte.id, deepLinkPath: '/' })
    expect(mail.sendEmail).not.toHaveBeenCalled()
  })

  it('Einladung beachtet die E-Mail-Einwilligung', async () => {
    const anwalt = await createUser('ANWALT')
    const akte = await createAkte({ anwaltId: anwalt.id })
    const k = await createKontakt({ email: 'm@x.de', einwilligungEmail: false })
    const b = await prisma.beteiligter.create({ data: { akteId: akte.id, kontaktId: k.id, rolle: 'MANDANT' } })
    asUser(anwalt)
    const { POST } = await import('@/app/api/portal/invite/route')
    const res = await POST(req('/api/portal/invite', { method: 'POST', json: { beteiligteId: b.id } }))
    expect(res.status).toBe(400)
    expect(mail.sendEmail).not.toHaveBeenCalled()
    expect(await prisma.portalInvite.count()).toBe(0)

    await prisma.kontakt.update({ where: { id: k.id }, data: { einwilligungEmail: true } })
    const ok = await POST(req('/api/portal/invite', { method: 'POST', json: { beteiligteId: b.id } }))
    expect(ok.status).toBeLessThan(300)
    expect(mail.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('Sachbearbeiter der Akte kann den Portal-Kanal lesen, Fremde nicht, Mandant nur als Mitglied', async () => {
    const anwalt = await createUser('ANWALT')
    const sb = await createUser('SACHBEARBEITER')
    const fremd = await createUser('SACHBEARBEITER')
    const akte = await createAkte({ anwaltId: anwalt.id, sachbearbeiterId: sb.id })
    const k = await createKontakt()
    const mandant = await createUser('MANDANT', { kontaktId: k.id })
    const andererMandant = await createUser('MANDANT')
    const { createPortalChannel } = await import('@/lib/messaging/channel-service')
    const { channel } = await createPortalChannel({ akteId: akte.id, mandantUserId: mandant.id, mandantName: 'M', anwaltUserId: anwalt.id })

    const { GET } = await import('@/app/api/channels/[id]/messages/route')
    const get = async (u: any) => {
      asUser(u)
      return (await GET(req(`/api/channels/${channel!.id}/messages`), params({ id: channel!.id }))).status
    }
    expect(await get(sb)).toBe(200)
    expect(await get(anwalt)).toBe(200)
    expect(await get(mandant)).toBe(200)
    expect(await get(fremd)).not.toBe(200)
    expect(await get(andererMandant)).not.toBe(200)
  })
})
