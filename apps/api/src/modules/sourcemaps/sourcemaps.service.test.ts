import { describe, expect, it, mock } from 'bun:test'
import { SourceMapsService } from './sourcemaps.service'

const checksum = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

function makeDb(existing?: { checksum?: string | null; sizeBytes?: number | null }) {
  const onConflictDoNothing = mock(async () => undefined)
  const onConflictDoUpdate = mock(async () => undefined)
  const values = mock(() => ({ onConflictDoNothing, onConflictDoUpdate }))
  return {
    db: {
      select: mock(() => ({
        from: () => ({
          where: () => ({
            limit: () => (existing ? [existing] : []),
          }),
        }),
      })),
      insert: mock(() => ({ values })),
    },
    values,
    onConflictDoNothing,
    onConflictDoUpdate,
  }
}

describe('SourceMapsService', () => {
  it('computes checksum and stores sourcemap metadata', async () => {
    const db = makeDb()
    const minio = { upload: mock(async () => undefined) }
    const service = new SourceMapsService(db.db as never, minio as never)

    const result = await service.upload('project-1', 'web@2.8.1', 'app.js.map', Buffer.from('abc'))

    expect(result).toEqual({ filename: 'app.js.map', checksum, sizeBytes: 3, status: 'created' })
    expect(minio.upload.mock.calls[0]).toEqual([
      'sourcemaps/project-1/web@2.8.1/app.js.map',
      Buffer.from('abc'),
      'application/json',
    ])
    expect(db.values.mock.calls[0][0]).toMatchObject({
      projectId: 'project-1',
      release: 'web@2.8.1',
      filename: 'app.js.map',
      checksum,
      sizeBytes: 3,
    })
  })

  it('returns unchanged for duplicate files with the same checksum', async () => {
    const db = makeDb({ checksum, sizeBytes: 3 })
    const minio = { upload: mock(async () => undefined) }
    const service = new SourceMapsService(db.db as never, minio as never)

    const result = await service.upload('project-1', 'web@2.8.1', 'app.js.map', Buffer.from('abc'), checksum)

    expect(result.status).toBe('unchanged')
    expect(minio.upload).not.toHaveBeenCalled()
    expect(db.values).not.toHaveBeenCalled()
  })

  it('updates duplicate files when checksum changes', async () => {
    const db = makeDb({ checksum: 'old', sizeBytes: 3 })
    const minio = { upload: mock(async () => undefined) }
    const service = new SourceMapsService(db.db as never, minio as never)

    const result = await service.upload('project-1', 'web@2.8.1', 'app.js.map', Buffer.from('abc'), checksum)

    expect(result.status).toBe('updated')
    expect(minio.upload).toHaveBeenCalled()
    expect(db.onConflictDoUpdate).toHaveBeenCalled()
  })
})
