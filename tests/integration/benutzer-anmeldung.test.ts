import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import Redis from 'ioredis'
import { prisma } from '@/lib/db'
import { resetDb, createUser, asUser, req, params } from './helpers'
import { seedBasis, DEMO_PASSWORT } from '../../prisma/seed-basis'
import { pruefePasswort } from '@/lib/auth-credentials'
import { LOGIN_SPERRE } from '@/lib/login-throttle'
import { refreshTokenFromDb, invalidateUserSessionCache } from '@/lib/auth-session'

const redis = new Redis(process.env.REDIS_URL!)
afterAll(() => redis.quit())

const PW = 'richtig-langes-passwort'

async function kontoMitPasswort(role: any = 'ANWALT', extra: Record<string, unknown> = {}) {
  return createUser(role, { passwordHash: await bcrypt.hash(PW, 4), ...extra })
}

beforeEach(async () => {
  await resetDb()
  const keys = await redis.keys('login:*')
  if (keys.length) await redis.del(...keys)
  invalidateUserSessionCache()
})

describe('Erstinstallation (seedBasis)', () => {
  const prod = { NODE_ENV: 'production' }

  it('legt in Produktion kein Konto mit bekanntem Passwort an', async () => {
    await seedBasis(prisma as any, { ...prod, INITIAL_ADMIN_PASSWORD: 'ein-sehr-geheimes-pw' })
    const users = await prisma.user.findMany({ where: { isSystem: false } })
    expect(users.map((u) => u.email)).toEqual(['admin@kanzlei.de'])
    for (const u of users) expect(await bcrypt.compare(DEMO_PASSWORT, u.passwordHash)).toBe(false)
    expect(await bcrypt.compare('ein-sehr-geheimes-pw', users[0]!.passwordHash)).toBe(true)
  })

  it('erzeugt ohne INITIAL_ADMIN_PASSWORD ein Zufallspasswort', async () => {
    const r = await seedBasis(prisma as any, prod)
    expect(r.erzeugtesPasswort).toMatch(/^[\w-]{20,}$/)
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: r.adminId } })
    expect(await bcrypt.compare(r.erzeugtesPasswort!, admin.passwordHash)).toBe(true)
  })

  it('lehnt ein zu kurzes Startpasswort ab (z. B. Platzhalter aus .env.example)', async () => {
    await expect(seedBasis(prisma as any, { ...prod, INITIAL_ADMIN_PASSWORD: 'ÄNDERN' })).rejects.toThrow(/zu kurz/)
  })

  it('Demo-Modus nur ausdrücklich: SEED_DEMO=true', async () => {
    const r = await seedBasis(prisma as any, { ...prod, SEED_DEMO: 'true' })
    expect(r.erzeugtesPasswort).toBeUndefined()
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: r.adminId } })
    expect(await bcrypt.compare(DEMO_PASSWORT, admin.passwordHash)).toBe(true)
  })
})

describe('Anmeldung: Passwortprüfung', () => {
  it('meldet ein Konto mit richtigem Passwort an, E-Mail ohne Rücksicht auf Groß-/Kleinschreibung', async () => {
    const u = await kontoMitPasswort()
    const r = await pruefePasswort({ email: u.email.toUpperCase(), password: PW })
    expect(r.ok && r.user.id).toBe(u.id)
  })

  it('lässt Konten mit Zwei-Faktor-Anmeldung nicht allein mit dem Passwort herein', async () => {
    const u = await kontoMitPasswort('ANWALT', { totpEnabled: true, totpSecret: 'x' })
    expect(await pruefePasswort({ email: u.email, password: PW })).toEqual({ ok: false, grund: 'totp_erforderlich' })
    // Die Vorstufe des 2FA-Logins darf das Passwort prüfen
    const vor = await pruefePasswort({ email: u.email, password: PW }, null, { fuerTotpVorstufe: true })
    expect(vor.ok).toBe(true)
  })

  it('weist deaktivierte Konten und den Systembenutzer ab', async () => {
    const a = await kontoMitPasswort('ANWALT', { aktiv: false })
    const s = await kontoMitPasswort('SACHBEARBEITER', { isSystem: true })
    expect((await pruefePasswort({ email: a.email, password: PW })).ok).toBe(false)
    expect((await pruefePasswort({ email: s.email, password: PW })).ok).toBe(false)
  })

  it(`sperrt nach ${LOGIN_SPERRE.proKonto} Versuchen je Konto – auch das richtige Passwort`, async () => {
    const u = await kontoMitPasswort()
    for (let i = 0; i < LOGIN_SPERRE.proKonto; i++) {
      expect((await pruefePasswort({ email: u.email, password: 'falsch' })).ok).toBe(false)
    }
    expect(await pruefePasswort({ email: u.email, password: PW })).toEqual({ ok: false, grund: 'gesperrt' })
  })

  it('zählt parallele Versuche atomar', async () => {
    const u = await kontoMitPasswort()
    const res = await Promise.all(
      Array.from({ length: 30 }, () => pruefePasswort({ email: u.email, password: 'falsch' })),
    )
    expect(res.filter((r) => !r.ok && r.grund === 'gesperrt')).toHaveLength(30 - LOGIN_SPERRE.proKonto)
  })

  it('setzt den Zähler nach erfolgreicher Anmeldung zurück', async () => {
    const u = await kontoMitPasswort()
    for (let i = 0; i < LOGIN_SPERRE.proKonto - 1; i++) await pruefePasswort({ email: u.email, password: 'falsch' })
    expect((await pruefePasswort({ email: u.email, password: PW })).ok).toBe(true)
    for (let i = 0; i < LOGIN_SPERRE.proKonto - 1; i++) await pruefePasswort({ email: u.email, password: 'falsch' })
    expect((await pruefePasswort({ email: u.email, password: PW })).ok).toBe(true)
  })

  it('begrenzt auch /api/auth/totp/init (früher unbegrenztes Passwort-Orakel)', async () => {
    const { POST } = await import('@/app/api/auth/totp/init/route')
    const u = await kontoMitPasswort()
    for (let i = 0; i < LOGIN_SPERRE.proKonto; i++) {
      const r = await POST(req('/api/auth/totp/init', { method: 'POST', json: { email: u.email, password: 'falsch' } }))
      expect(r.status).toBe(401)
    }
    const r = await POST(req('/api/auth/totp/init', { method: 'POST', json: { email: u.email, password: PW } }))
    expect(r.status).toBe(429)
  })
})

describe('Sitzungen folgen dem Kontostand', () => {
  it('beendet die Sitzung eines deaktivierten Kontos', async () => {
    const u = await kontoMitPasswort()
    const token = { sub: u.id, role: 'ANWALT', iat: Math.floor(Date.now() / 1000) }
    expect(await refreshTokenFromDb({ ...token })).not.toBeNull()
    await prisma.user.update({ where: { id: u.id }, data: { aktiv: false } })
    invalidateUserSessionCache(u.id)
    expect(await refreshTokenFromDb({ ...token })).toBeNull()
  })

  it('übernimmt eine geänderte Rolle ohne neue Anmeldung', async () => {
    const u = await kontoMitPasswort('ADMIN')
    await prisma.user.update({ where: { id: u.id }, data: { role: 'SEKRETARIAT' } })
    invalidateUserSessionCache(u.id)
    const t = await refreshTokenFromDb({ sub: u.id, role: 'ADMIN', iat: Math.floor(Date.now() / 1000) })
    expect(t?.role).toBe('SEKRETARIAT')
  })

  it('verwirft Tokens, die vor einem Passwortwechsel ausgestellt wurden', async () => {
    const u = await kontoMitPasswort()
    const alt = Math.floor(Date.now() / 1000) - 60
    await prisma.user.update({ where: { id: u.id }, data: { sessionsGueltigAb: new Date() } })
    invalidateUserSessionCache(u.id)
    expect(await refreshTokenFromDb({ sub: u.id, iat: alt })).toBeNull()
    expect(await refreshTokenFromDb({ sub: u.id, iat: Math.floor(Date.now() / 1000) + 1 })).not.toBeNull()
  })
})

describe('Benutzerverwaltung (Admin)', () => {
  const liste = () => import('@/app/api/admin/benutzer/route')
  const einzel = () => import('@/app/api/admin/benutzer/[id]/route')
  const reset = () => import('@/app/api/admin/benutzer/[id]/passwort/route')

  it('nur Administratoren', async () => {
    asUser(await createUser('ANWALT'))
    expect((await (await liste()).GET()).status).toBe(403)
    const r = await (await liste()).POST(
      req('/api/admin/benutzer', { method: 'POST', json: { email: 'x@y.de', name: 'X Y', role: 'ADMIN' } }),
    )
    expect(r.status).toBe(403)
  })

  it('legt ein Konto an; das Startpasswort funktioniert genau einmal ausgeliefert', async () => {
    asUser(await createUser('ADMIN'))
    const r = await (await liste()).POST(
      req('/api/admin/benutzer', {
        method: 'POST',
        json: { email: ' Neu.Kollegin@Kanzlei.de ', name: 'Neue Kollegin', role: 'SACHBEARBEITER' },
      }),
    )
    expect(r.status).toBe(201)
    const body = await r.json()
    expect(body.benutzer.email).toBe('neu.kollegin@kanzlei.de')
    expect(body.startpasswort).toMatch(/^\w{4}-\w{4}-\w{4}-\w{4}$/)
    const login = await pruefePasswort({ email: 'neu.kollegin@kanzlei.de', password: body.startpasswort })
    expect(login.ok).toBe(true)

    const listeAntwort = await (await (await liste()).GET()).json()
    expect(JSON.stringify(listeAntwort)).not.toContain(body.startpasswort)
    expect(JSON.stringify(listeAntwort)).not.toContain('passwordHash')
  })

  it('weist doppelte E-Mail, Mandanten-Rolle und zu kurze Passwörter ab', async () => {
    const admin = await createUser('ADMIN')
    asUser(admin)
    const post = async (json: unknown) => (await liste()).POST(req('/api/admin/benutzer', { method: 'POST', json }))
    expect((await post({ email: admin.email, name: 'Doppelt', role: 'ANWALT' })).status).toBe(409)
    expect((await post({ email: 'm@x.de', name: 'Mandant', role: 'MANDANT' })).status).toBe(400)
    expect((await post({ email: 'k@x.de', name: 'Kurz', role: 'ANWALT', passwort: 'kurz' })).status).toBe(400)
  })

  it('schützt das letzte aktive Administratorkonto und das eigene Konto', async () => {
    const admin = await createUser('ADMIN')
    asUser(admin)
    const patch = async (id: string, json: unknown) =>
      (await einzel()).PATCH(req(`/api/admin/benutzer/${id}`, { method: 'PATCH', json }), params({ id }))
    expect((await patch(admin.id, { role: 'ANWALT' })).status).toBe(409)
    expect((await patch(admin.id, { aktiv: false })).status).toBe(409)
    const zweiter = await createUser('ADMIN')
    expect((await patch(admin.id, { aktiv: false })).status).toBe(409) // eigenes Konto
    expect((await patch(zweiter.id, { aktiv: false })).status).toBe(200)
    expect((await patch(admin.id, { role: 'ANWALT' })).status).toBe(409) // wieder der letzte
  })

  it('Deaktivieren wirkt sofort auf laufende Sitzungen', async () => {
    const admin = await createUser('ADMIN')
    const u = await kontoMitPasswort()
    const token = { sub: u.id, iat: Math.floor(Date.now() / 1000) }
    expect(await refreshTokenFromDb({ ...token })).not.toBeNull() // jetzt im Cache
    asUser(admin)
    const r = await (await einzel()).PATCH(
      req(`/api/admin/benutzer/${u.id}`, { method: 'PATCH', json: { aktiv: false } }),
      params({ id: u.id }),
    )
    expect(r.status).toBe(200)
    expect(await refreshTokenFromDb({ ...token })).toBeNull()
  })

  it('Passwort zurücksetzen: altes Passwort ungültig, Sitzungen beendet, Sperre aufgehoben, 2FA optional zurück', async () => {
    const admin = await createUser('ADMIN')
    const u = await kontoMitPasswort('ANWALT', { totpEnabled: true, totpSecret: 'x', backupCodes: ['a'] })
    for (let i = 0; i <= LOGIN_SPERRE.proKonto; i++) await pruefePasswort({ email: u.email, password: 'falsch' })
    asUser(admin)
    const altToken = { sub: u.id, iat: Math.floor(Date.now() / 1000) - 5 }
    const r = await (await reset()).POST(
      req(`/api/admin/benutzer/${u.id}/passwort`, { method: 'POST', json: { totpZuruecksetzen: true } }),
      params({ id: u.id }),
    )
    expect(r.status).toBe(200)
    const { startpasswort } = await r.json()
    expect((await pruefePasswort({ email: u.email, password: PW })).ok).toBe(false)
    expect((await pruefePasswort({ email: u.email, password: startpasswort })).ok).toBe(true)
    expect(await refreshTokenFromDb(altToken)).toBeNull()
    const nachher = await prisma.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(nachher.totpEnabled).toBe(false)
    expect(nachher.backupCodes).toEqual([])
    const audit = await prisma.auditLog.findFirst({ where: { aktion: 'BENUTZER_PASSWORT_ZURUECKGESETZT' } })
    expect(audit?.userId).toBe(admin.id)
  })

  it('Mandantenkonten und Systembenutzer sind hier nicht verwaltbar', async () => {
    asUser(await createUser('ADMIN'))
    const m = await createUser('MANDANT')
    const r = await (await reset()).POST(req(`/api/admin/benutzer/${m.id}/passwort`, { method: 'POST' }), params({ id: m.id }))
    expect(r.status).toBe(404)
  })
})

describe('Eigenes Passwort ändern', () => {
  const route = () => import('@/app/api/user/passwort/route')

  it('prüft das aktuelle Passwort und die Mindestlänge', async () => {
    const u = await kontoMitPasswort()
    asUser(u)
    const post = async (json: unknown) => (await route()).POST(req('/api/user/passwort', { method: 'POST', json }))
    expect((await post({ aktuell: 'falsch', neu: 'ein-neues-langes-pw' })).status).toBe(400)
    expect((await post({ aktuell: PW, neu: 'kurz' })).status).toBe(400)
    expect((await post({ aktuell: PW, neu: 'ein-neues-langes-pw' })).status).toBe(200)
    expect((await pruefePasswort({ email: u.email, password: 'ein-neues-langes-pw' })).ok).toBe(true)
    expect((await pruefePasswort({ email: u.email, password: PW })).ok).toBe(false)
  })
})
