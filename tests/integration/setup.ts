import { vi, beforeEach } from 'vitest'

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
process.env.EMAIL_ENCRYPTION_KEY ??= '0'.repeat(64)
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:56380'

// The real NextAuth instance needs a request context; tests set the
// session explicitly through asUser()/asAnonymous() from ./helpers.
const session = vi.hoisted(() => ({ current: null as any }))
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => session.current),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}))
;(globalThis as any).__testSession = session

beforeEach(() => {
  session.current = null
})
