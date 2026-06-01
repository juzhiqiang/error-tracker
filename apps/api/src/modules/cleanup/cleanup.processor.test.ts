import { describe, expect, it, mock } from 'bun:test'
import { CleanupProcessor } from './cleanup.processor'

describe('CleanupProcessor', () => {
  it('uses raw SQL rows when clearing old replay objects', async () => {
    const deleted: string[] = []
    const db = {
      select: () => ({
        from: () => [{ id: 'project-1', retentionDays: 30 }],
      }),
      execute: mock(async () => ({ rows: [{ storage_url: 'replays/project-1/event-1.json' }] })),
    }
    const minio = {
      deleteObject: mock(async (key: string) => {
        deleted.push(key)
        return key
      }),
    }
    const processor = new CleanupProcessor(db as never, minio as never)

    await processor.process({ name: 'daily-cleanup' } as never)

    expect(deleted).toEqual(['replays/project-1/event-1.json'])
  })
})
