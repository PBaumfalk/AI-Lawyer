import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from 'vitest'
import net from 'node:net'
import bcrypt from 'bcryptjs'
import Redis from 'ioredis'
import { prisma } from '@/lib/db'
import { resetDb, createUser, asUser, req, params } from './helpers'
import { seedBasis, DEMO_PASSWORT } from '../../prisma/seed-basis'
import { pruefePasswort } from '@/lib/auth-credentials'
import { LOGIN_SPERRE, ANMELDESCHUTZ_FEHLT, LimiterNichtVerfuegbar, __setLoginThrottleRedis, totpGesperrt } from '@/lib/login-throttle'
import { CLIENT_IP_HEADER } from '@/lib/client-ip'
import { GERAET_COOKIE, geraetTokenErzeugen } from '@/lib/login-geraet'
import { refreshTokenFromDb, invalidateUserSessionCache } from '@/lib/auth-session'

const redis = new Redis(process.env.REDIS_URL!)
afterAll(() => redis.quit())

const PW = 'richtig-langes-passwort'
const ANGREIFER = '203.0.113.66'
process.env.NEXTAUTH_SECRET ??= 'integration-test-secret-0123456789abcdef'

/** Anfrage wie vom eigenen Server: Client-Adresse im internen Header, optional Geräte-Cookie. */
function von(ip: string, geraet?: string) {
  const headers: Record<string, string> = { [CLIENT_IP_HEADER]: ip }
  if (geraet) headers.cookie = `${GERAET_COOKIE}=${geraet}`
  return new Request('http://localhost/api/auth/callback/credentials', { headers })
}

async function kontoMitPasswort(role: any = 'ANWALT', extra: Record<string, unknown> = {}) {
  return createUser(role, { passwordHash: await bcrypt.hash(PW, 4), ...extra })
}

beforeEach(async () => {
  await resetDb()
  const keys = [...(await redis.keys('login:*')), ...(await redis.keys('limit:*'))]
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

  it('vergleicht das Passwort auch für unbekannte Konten (keine Laufzeit-Auskunft)', async () => {
    const spy = vi.spyOn(bcrypt, 'compare')
    await pruefePasswort({ email: 'gibt-es-nicht@kanzlei.de', password: 'egal' }, von('198.51.100.1'))
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})

describe('Anmeldeschutz: kein Aussperren durch Fremde, Drosselung bleibt', () => {
  it('ABNAHME: Fehlversuche von einer fremden Quelle sperren das Opferkonto nicht', async () => {
    const opfer = await kontoMitPasswort()
    // Bisherige Methode: mehr Fehlversuche als die alte Kontosperre (10) von einer Quelle
    for (let i = 0; i < LOGIN_SPERRE.proQuelleUndKonto + 5; i++) {
      await pruefePasswort({ email: opfer.email, password: 'falsch' }, von(ANGREIFER))
    }
    // Die angreifende Quelle ist gedrosselt – auch mit richtigem Passwort
    expect(await pruefePasswort({ email: opfer.email, password: PW }, von(ANGREIFER))).toEqual({ ok: false, grund: 'gesperrt' })
    // Die Inhaberin meldet sich von einer unabhängigen Quelle ohne Geräte-Cookie an
    const r = await pruefePasswort({ email: opfer.email, password: PW }, von('198.51.100.77'))
    expect(r.ok && r.user.id).toBe(opfer.id)
  })

  it('ABNAHME über die Login-Route: Angreifer bekommt 429, Inhaberin von anderer Quelle 200', async () => {
    const { POST } = await import('@/app/api/auth/totp/init/route')
    const opfer = await kontoMitPasswort()
    const status: number[] = []
    for (let i = 0; i < 15; i++) {
      const r = await POST(req('/api/auth/totp/init', { method: 'POST', json: { email: opfer.email, password: 'falsch' }, headers: { [CLIENT_IP_HEADER]: ANGREIFER } }))
      status.push(r.status)
    }
    expect(status.slice(0, 10).every((x) => x === 401)).toBe(true)
    expect(status.slice(10).every((x) => x === 429)).toBe(true)
    const ok = await POST(req('/api/auth/totp/init', { method: 'POST', json: { email: opfer.email, password: PW }, headers: { [CLIENT_IP_HEADER]: '198.51.100.77' } }))
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ requireTotp: false })
    expect(ok.headers.get('set-cookie')).toContain(`${GERAET_COOKIE}=`)
  })

  it('X-Forwarded-For allein umgeht die Drosselung nicht (wird ohne Proxy nicht ausgewertet)', async () => {
    const { POST } = await import('@/app/api/auth/totp/init/route')
    const opfer = await kontoMitPasswort()
    let letzter = 0
    for (let i = 0; i < 12; i++) {
      const r = await POST(req('/api/auth/totp/init', {
        method: 'POST',
        json: { email: opfer.email, password: 'falsch' },
        headers: { [CLIENT_IP_HEADER]: ANGREIFER, 'x-forwarded-for': `10.9.${i}.1` },
      }))
      letzter = r.status
    }
    expect(letzter).toBe(429)
  })

  it('Brute Force: zählt parallele Versuche einer Quelle atomar', async () => {
    const u = await kontoMitPasswort()
    const res = await Promise.all(
      Array.from({ length: 30 }, () => pruefePasswort({ email: u.email, password: 'falsch' }, von(ANGREIFER))),
    )
    expect(res.filter((r) => !r.ok && r.grund === 'gesperrt')).toHaveLength(30 - LOGIN_SPERRE.proQuelleUndKonto)
  })

  it('Credential Stuffing: eine Quelle über viele Konten wird gedrosselt, andere Quellen nicht', async () => {
    const konten = await Promise.all(Array.from({ length: 12 }, () => kontoMitPasswort()))
    let gesperrt = 0
    for (const k of konten) {
      for (let i = 0; i < 9; i++) {
        const r = await pruefePasswort({ email: k.email, password: 'falsch' }, von(ANGREIFER))
        if (!r.ok && r.grund === 'gesperrt') gesperrt++
      }
    }
    expect(gesperrt).toBe(12 * 9 - LOGIN_SPERRE.proQuelle)
    // Ein bisher unberührtes Konto: von der Angriffsquelle gesperrt, von woanders frei
    const neu = await kontoMitPasswort()
    expect((await pruefePasswort({ email: neu.email, password: PW }, von(ANGREIFER))).ok).toBe(false)
    expect((await pruefePasswort({ email: neu.email, password: PW }, von('198.51.100.77'))).ok).toBe(true)
  })

  it('verteilter Angriff: unbekannte Geräte werden abgewiesen, das Gerät der Inhaberin nicht', async () => {
    const opfer = await kontoMitPasswort()
    // Inhaberin hat sich früher erfolgreich angemeldet und besitzt das Geräte-Cookie
    const cookie = geraetTokenErzeugen(opfer.email)!
    const quellen = Math.ceil(LOGIN_SPERRE.proKontoGesamt / LOGIN_SPERRE.proQuelleUndKonto) + 1
    for (let q = 0; q < quellen; q++) {
      for (let i = 0; i < LOGIN_SPERRE.proQuelleUndKonto; i++) {
        await pruefePasswort({ email: opfer.email, password: 'falsch' }, von(`203.0.113.${q + 1}`))
      }
    }
    // Neue Quelle ohne Cookie (z. B. weiterer Bot, auch mit richtigem Passwort): abgewiesen
    expect(await pruefePasswort({ email: opfer.email, password: PW }, von('198.51.100.8'))).toEqual({ ok: false, grund: 'gesperrt' })
    // Inhaberin mit Geräte-Cookie von beliebiger Quelle: angemeldet
    const r = await pruefePasswort({ email: opfer.email, password: PW }, von('198.51.100.9', cookie))
    expect(r.ok).toBe(true)
    // Ein Cookie für ein anderes Konto hilft nicht
    const fremd = geraetTokenErzeugen('jemand@anders.de')!
    expect((await pruefePasswort({ email: opfer.email, password: PW }, von('198.51.100.10', fremd))).ok).toBe(false)
  })

  it('setzt den Zähler der eigenen Quelle nach erfolgreicher Anmeldung zurück', async () => {
    const u = await kontoMitPasswort()
    for (let i = 0; i < LOGIN_SPERRE.proQuelleUndKonto - 1; i++) await pruefePasswort({ email: u.email, password: 'falsch' }, von(ANGREIFER))
    expect((await pruefePasswort({ email: u.email, password: PW }, von(ANGREIFER))).ok).toBe(true)
    for (let i = 0; i < LOGIN_SPERRE.proQuelleUndKonto - 1; i++) await pruefePasswort({ email: u.email, password: 'falsch' }, von(ANGREIFER))
    expect((await pruefePasswort({ email: u.email, password: PW }, von(ANGREIFER))).ok).toBe(true)
  })

  it('Admin hebt eine Sperre auf, ohne das Passwort zu ändern', async () => {
    const admin = await createUser('ADMIN')
    const u = await kontoMitPasswort()
    for (let q = 0; q < 6; q++) {
      for (let i = 0; i < LOGIN_SPERRE.proQuelleUndKonto; i++) await pruefePasswort({ email: u.email, password: 'falsch' }, von(`203.0.113.${q + 1}`))
    }
    expect((await pruefePasswort({ email: u.email, password: PW }, von('198.51.100.8'))).ok).toBe(false)
    asUser(admin)
    const { POST } = await import('@/app/api/admin/benutzer/[id]/entsperren/route')
    const r = await POST(req(`/api/admin/benutzer/${u.id}/entsperren`, { method: 'POST' }), params({ id: u.id }))
    expect(r.status).toBe(200)
    expect((await pruefePasswort({ email: u.email, password: PW }, von('198.51.100.8'))).ok).toBe(true)
    expect((await pruefePasswort({ email: u.email, password: PW }, von('203.0.113.1'))).ok).toBe(true)
    expect(await prisma.auditLog.count({ where: { aktion: 'BENUTZER_ENTSPERRT' } })).toBe(1)
    // Nicht-Admins dürfen das nicht
    asUser(await createUser('ANWALT'))
    const verboten = await POST(req(`/api/admin/benutzer/${u.id}/entsperren`, { method: 'POST' }), params({ id: u.id }))
    expect(verboten.status).toBe(403)
  })

  it('Passwort vergessen (Portal): Quelle gedrosselt, Antwort verrät kein Konto', async () => {
    const { POST } = await import('@/app/api/portal/password-reset/request/route')
    const status: number[] = []
    for (let i = 0; i < 12; i++) {
      const r = await POST(req('/api/portal/password-reset/request', { method: 'POST', json: { email: `x${i}@nirgends.de` }, headers: { [CLIENT_IP_HEADER]: ANGREIFER } }))
      status.push(r.status)
    }
    expect(status.slice(0, 10).every((x) => x === 200)).toBe(true)
    expect(status.slice(10).every((x) => x === 429)).toBe(true)
  })

  it('eigenes Passwort ändern ist kein unbegrenztes Passwort-Orakel', async () => {
    const u = await kontoMitPasswort()
    asUser(u)
    const { POST } = await import('@/app/api/user/passwort/route')
    const status: number[] = []
    for (let i = 0; i < LOGIN_SPERRE.proQuelleUndKonto + 2; i++) {
      const r = await POST(req('/api/user/passwort', { method: 'POST', json: { aktuell: 'falsch-falsch', neu: 'ganz-neues-passwort-1' } }))
      status.push(r.status)
    }
    expect(status.slice(0, LOGIN_SPERRE.proQuelleUndKonto).every((x) => x === 400)).toBe(true)
    expect(status.slice(LOGIN_SPERRE.proQuelleUndKonto).every((x) => x === 429)).toBe(true)
  })
})

describe('Anmeldeschutz bei Redis-Ausfall', () => {
  // TCP-Proxy vor dem Test-Redis: lässt sich abschalten (Ausfall), auf
  // "keine Antworten" stellen (Timeout) und wieder einschalten (Wiederkehr).
  const ziel = new URL(process.env.REDIS_URL!)
  let server: net.Server | null = null
  let modus: 'weiter' | 'schweigen' = 'weiter'
  const sockets = new Set<net.Socket>()
  let port = 0

  async function proxyStarten() {
    server = net.createServer((c) => {
      const u = net.connect(Number(ziel.port || 6379), ziel.hostname)
      for (const s of [c, u]) { sockets.add(s); s.on('error', () => {}); s.on('close', () => sockets.delete(s)) }
      c.on('data', (d) => u.write(d))
      u.on('data', (d) => { if (modus === 'weiter') c.write(d) })
      c.on('close', () => u.destroy()); u.on('close', () => c.destroy())
    })
    await new Promise<void>((r) => server!.listen(port, '127.0.0.1', () => r()))
    port = (server!.address() as net.AddressInfo).port
  }
  async function proxyStoppen() {
    for (const s of sockets) s.destroy()
    await new Promise<void>((r) => server!.close(() => r()))
    server = null
  }

  const urlVorher = process.env.REDIS_URL
  afterEach(async () => {
    if (server) await proxyStoppen()
    __setLoginThrottleRedis(null)
    process.env.REDIS_URL = urlVorher
    modus = 'weiter'
  })

  it('ABNAHME: Ausfall → kontrollierte Ablehnung (503), Timeout begrenzt, Wiederkehr → Schutz wirkt automatisch', async () => {
    const u = await kontoMitPasswort()
    await proxyStarten()
    process.env.REDIS_URL = `redis://127.0.0.1:${port}`
    __setLoginThrottleRedis(null)
    expect((await pruefePasswort({ email: u.email, password: PW }, von('198.51.100.5'))).ok).toBe(true)

    // 1) Ausfall: Redis nicht erreichbar
    await proxyStoppen()
    await new Promise((r) => setTimeout(r, 50))
    let t = Date.now()
    expect(await pruefePasswort({ email: u.email, password: PW }, von('198.51.100.5'))).toEqual({ ok: false, grund: 'dienst' })
    expect(Date.now() - t).toBeLessThan(LOGIN_SPERRE.verbindenMs + 500)
    const { POST } = await import('@/app/api/auth/totp/init/route')
    const r = await POST(req('/api/auth/totp/init', { method: 'POST', json: { email: u.email, password: PW }, headers: { [CLIENT_IP_HEADER]: '198.51.100.5' } }))
    expect(r.status).toBe(503)
    expect(r.headers.get('retry-after')).toBe('60')
    expect((await r.json()).error).toBe(ANMELDESCHUTZ_FEHLT)
    // Keine ungeschützte Anmeldung: auch beliebig viele Versuche kommen nicht durch
    const viele = await Promise.all(Array.from({ length: 20 }, () => pruefePasswort({ email: u.email, password: PW }, von('198.51.100.6'))))
    expect(viele.every((x) => !x.ok && x.grund === 'dienst')).toBe(true)
    // Bestehende Sitzungen hängen nicht an Redis
    expect(await refreshTokenFromDb({ sub: u.id, iat: Math.floor(Date.now() / 1000) })).not.toBeNull()

    // 2) Wiederkehr: ioredis verbindet selbst neu, der Schutz greift wieder
    await proxyStarten()
    let wieder = false
    for (let i = 0; i < 40 && !wieder; i++) {
      await new Promise((res) => setTimeout(res, 250))
      wieder = (await pruefePasswort({ email: u.email, password: PW }, von('198.51.100.5'))).ok
    }
    expect(wieder).toBe(true)
    for (let i = 0; i < LOGIN_SPERRE.proQuelleUndKonto; i++) await pruefePasswort({ email: u.email, password: 'falsch' }, von(ANGREIFER))
    expect(await pruefePasswort({ email: u.email, password: PW }, von(ANGREIFER))).toEqual({ ok: false, grund: 'gesperrt' })

    // 3) Timeout: Redis verbunden, antwortet aber nicht
    modus = 'schweigen'
    t = Date.now()
    expect(await pruefePasswort({ email: u.email, password: PW }, von('198.51.100.5'))).toEqual({ ok: false, grund: 'dienst' })
    expect(Date.now() - t).toBeLessThan(LOGIN_SPERRE.timeoutMs + 1000)
  })

  it('zweiter Faktor: bei Ausfall 503 statt ungebremstem Raten', async () => {
    await proxyStarten()
    process.env.REDIS_URL = `redis://127.0.0.1:${port}`
    __setLoginThrottleRedis(null)
    await proxyStoppen()
    await expect(totpGesperrt('irgendwer')).rejects.toBeInstanceOf(LimiterNichtVerfuegbar)
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
    for (let i = 0; i <= LOGIN_SPERRE.proQuelleUndKonto; i++) await pruefePasswort({ email: u.email, password: 'falsch' }, von(ANGREIFER))
    asUser(admin)
    const altToken = { sub: u.id, iat: Math.floor(Date.now() / 1000) - 5 }
    const r = await (await reset()).POST(
      req(`/api/admin/benutzer/${u.id}/passwort`, { method: 'POST', json: { totpZuruecksetzen: true } }),
      params({ id: u.id }),
    )
    expect(r.status).toBe(200)
    const { startpasswort } = await r.json()
    expect((await pruefePasswort({ email: u.email, password: PW }, von(ANGREIFER))).ok).toBe(false)
    expect((await pruefePasswort({ email: u.email, password: startpasswort }, von(ANGREIFER))).ok).toBe(true)
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
