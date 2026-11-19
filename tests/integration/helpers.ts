import type { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db'

let seq = 0
const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`

/** Truncate every application table (keeps the migration history). */
export async function resetDb() {
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  )
  if (rows.length === 0) return
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ')
  // Fire-and-forget writes of the previous test (e.g. audit entries) can still
  // be running; TRUNCATE then occasionally deadlocks with them (40P01).
  for (let versuch = 1; ; versuch++) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`)
      return
    } catch (e: any) {
      const deadlock = e?.meta?.code === '40P01' || /deadlock detected/.test(String(e?.message))
      if (!deadlock || versuch >= 5) throw e
      await new Promise((r) => setTimeout(r, 100 * versuch))
    }
  }
}

export async function createKanzlei() {
  return prisma.kanzlei.create({ data: { name: `Kanzlei ${uid()}` } })
}

export async function createUser(role: UserRole, extra: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: {
      email: `${role.toLowerCase()}-${uid()}@test.local`,
      name: `${role} ${uid()}`,
      role,
      passwordHash: 'x',
      ...extra,
    },
  })
}

export async function createKontakt(extra: Record<string, unknown> = {}) {
  return prisma.kontakt.create({
    data: { typ: 'NATUERLICH', vorname: 'Max', nachname: `Muster ${uid()}`, ...extra } as any,
  })
}

export async function createAkte(extra: Record<string, unknown> = {}) {
  return prisma.akte.create({
    data: { aktenzeichen: `${uid()}/26`, kurzrubrum: `Rubrum ${uid()}`, ...extra } as any,
  })
}

type SessionUser = { id: string; email: string; name: string | null; role: UserRole; kanzleiId?: string | null; kontaktId?: string | null }

/** Make subsequent auth() calls return a session for this user. */
export function asUser(user: SessionUser) {
  ;(globalThis as any).__testSession.current = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      kanzleiId: user.kanzleiId ?? null,
      kontaktId: user.kontaktId ?? null,
    },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  }
}

export function asAnonymous() {
  ;(globalThis as any).__testSession.current = null
}

/** Build a NextRequest-compatible Request for route handlers. */
export function req(path: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, ...rest } = init
  const { NextRequest } = require('next/server')
  return new NextRequest(new URL(path, 'http://localhost'), {
    ...rest,
    ...(json !== undefined
      ? { body: JSON.stringify(json), headers: { 'content-type': 'application/json', ...(rest.headers || {}) } }
      : {}),
  })
}

export const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) })
