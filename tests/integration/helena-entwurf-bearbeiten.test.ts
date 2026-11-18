import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb, createUser, createAkte, asUser, req, params } from './helpers'
import { draftUrl, type DraftAction } from '@/lib/helena/draft-actions'

describe('Helena-Entwurf bearbeiten (Detail-Modal → PATCH action "edit")', () => {
  beforeEach(resetDb)

  async function setup() {
    const anwalt = await createUser('ANWALT')
    const akte = await createAkte({ anwaltId: anwalt.id })
    const draft = await prisma.helenaDraft.create({
      data: { akteId: akte.id, userId: anwalt.id, typ: 'NOTIZ', titel: 'Alt', inhalt: 'Alter Text' } as any,
    })
    asUser(anwalt)
    return { draft }
  }

  it('speichert Titel und Inhalt mit genau der Nutzlast des Modals', async () => {
    const { draft } = await setup()
    const body: DraftAction = { action: 'edit', titel: 'Neu', inhalt: 'Neuer Text' }
    const { PATCH } = await import('@/app/api/helena/drafts/[id]/route')
    const res = await PATCH(req(draftUrl(draft.id), { method: 'PATCH', json: body }), params({ id: draft.id }))
    expect(res.status).toBe(200)
    const stored = await prisma.helenaDraft.findUniqueOrThrow({ where: { id: draft.id } })
    expect(stored).toMatchObject({ titel: 'Neu', inhalt: 'Neuer Text', status: 'PENDING' })
  })

  it('lehnt einen leeren Titel ab', async () => {
    const { draft } = await setup()
    const { PATCH } = await import('@/app/api/helena/drafts/[id]/route')
    const res = await PATCH(req(draftUrl(draft.id), { method: 'PATCH', json: { action: 'edit', titel: '   ' } }), params({ id: draft.id }))
    expect(res.status).toBe(400)
    expect((await prisma.helenaDraft.findUniqueOrThrow({ where: { id: draft.id } })).titel).toBe('Alt')
  })
})
