/**
 * Every raw SQL statement in src/ is checked against the real database schema.
 *
 * Raw SQL bypasses Prisma's model→table mapping (@@map / @map), so a statement
 * that names a Prisma model ("KalenderEintrag") instead of the table
 * (kalender_eintraege) compiles fine and only fails at runtime with
 * 42P01 relation does not exist. This test finds all $queryRaw / $executeRaw /
 * $queryRawUnsafe / $executeRawUnsafe template or string literals, replaces
 * interpolations with bind parameters and lets PostgreSQL parse and analyse
 * them (PREPARE for DML, a rolled-back transaction for DDL). PostgreSQL then
 * resolves every table, column, operator and cast exactly as in production.
 *
 * New raw SQL is picked up automatically.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/db'

const SRC = path.resolve(__dirname, '../../src')

interface RawStatement {
  file: string
  line: number
  sql: string
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue
      walk(p, out)
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(p)
    }
  }
  return out
}

/** Read a template literal starting at src[i] === '`'. Returns body with ${…} replaced by $n. */
function readTemplate(src: string, i: number): { sql: string; end: number } {
  let out = ''
  let n = 0
  i++ // skip opening backtick
  while (i < src.length && src[i] !== '`') {
    if (src[i] === '\\') {
      out += src[i + 1]
      i += 2
      continue
    }
    if (src[i] === '$' && src[i + 1] === '{') {
      let depth = 1
      i += 2
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth++
        else if (src[i] === '}') depth--
        i++
      }
      out += `$${++n}`
      continue
    }
    out += src[i++]
  }
  return { sql: out, end: i + 1 }
}

function readString(src: string, i: number): { sql: string; end: number } {
  const q = src[i]
  let out = ''
  i++
  while (i < src.length && src[i] !== q) {
    if (src[i] === '\\') {
      out += src[i + 1]
      i += 2
      continue
    }
    out += src[i++]
  }
  return { sql: out, end: i + 1 }
}

export function extractRawStatements(file: string): RawStatement[] {
  const src = fs.readFileSync(file, 'utf8')
  const out: RawStatement[] = []
  const re = /\$(queryRaw|executeRaw)(Unsafe)?\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length
    // optional generic type argument <...> (may span lines, may nest)
    while (/\s/.test(src[i])) i++
    if (src[i] === '<') {
      let depth = 0
      do {
        if (src[i] === '<') depth++
        else if (src[i] === '>' && src[i - 1] !== '=') depth--
        i++
      } while (i < src.length && depth > 0)
      while (/\s/.test(src[i])) i++
    }
    if (m[2]) {
      // $queryRawUnsafe( "..." | `...` , ...params)
      if (src[i] !== '(') continue
      i++
      while (/\s/.test(src[i])) i++
    }
    const ch = src[i]
    if (ch !== '`' && ch !== '"' && ch !== "'") continue // dynamic SQL string: cannot be checked statically
    const { sql } = ch === '`' ? readTemplate(src, i) : readString(src, i)
    const line = src.slice(0, m.index).split('\n').length
    out.push({ file: path.relative(SRC, file), line, sql: sql.trim() })
  }
  return out
}

const statements = walk(SRC).flatMap(extractRawStatements)

describe('raw SQL against the real schema', () => {
  it('finds the raw SQL statements in src/', () => {
    // Guard against the extractor silently matching nothing.
    expect(statements.length).toBeGreaterThan(20)
  })

  it.each(statements.map((s) => [`${s.file}:${s.line}`, s] as const))('%s', async (_label, s) => {
    const isDml = /^(select|with|insert|update|delete)\b/i.test(s.sql)
    if (isDml) {
      const name = `rawcheck_${Math.random().toString(36).slice(2)}`
      try {
        await prisma.$executeRawUnsafe(`PREPARE ${name} AS ${s.sql}`)
      } finally {
        await prisma.$executeRawUnsafe(`DEALLOCATE ALL`).catch(() => {})
      }
    } else {
      // DDL: run it for real inside a transaction that is always rolled back.
      const rollback = new Error('__rollback__')
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(s.sql)
          throw rollback
        }),
      ).rejects.toBe(rollback)
    }
  })
})
