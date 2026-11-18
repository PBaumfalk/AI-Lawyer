import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb, createUser, asUser } from './helpers'
import type { DokumentTagsResponse } from '@/lib/dokument-tags'

describe('Dokument-Tag-Filter (Suche, Tag-Manager)', () => {
  beforeEach(resetDb)

  it('liefert {tags: [...]} in der Form, die die Oberfläche erwartet', async () => {
    asUser(await createUser('SEKRETARIAT'))
    await prisma.dokumentTagKategorie.create({ data: { name: 'Vertrag', farbe: '#ff0000', sortierung: 2 } })
    await prisma.dokumentTagKategorie.create({ data: { name: 'Klage', farbe: '#00ff00', sortierung: 1 } })
    const { GET } = await import('@/app/api/dokumente/tags/route')
    const body = (await (await GET()).json()) as DokumentTagsResponse
    expect(Array.isArray(body.tags)).toBe(true)
    expect(body.tags.map((t) => t.name)).toEqual(['Klage', 'Vertrag'])
    expect(body.tags[0]).toMatchObject({ farbe: '#00ff00', system: false })
  })
})
