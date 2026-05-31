import { describe, expect, it, mock } from 'bun:test'
import { EventsService } from './events.service'

describe('EventsService', () => {
  it('loads replay rrweb events for an event id', async () => {
    const replayRows = [{ storageUrl: 'replays/project-1/event-1.json' }]
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => replayRows,
          }),
        }),
      }),
    }
    const minio = {
      getObject: mock(async () => JSON.stringify([{ timestamp: 1000, type: 2, data: {} }])),
    }
    const service = new EventsService(db as never, minio as never)

    const replay = await service.findReplayByEventId('event-1')

    expect(replay).toEqual({ events: [{ timestamp: 1000, type: 2, data: {} }] })
    expect(minio.getObject.mock.calls).toEqual([['replays/project-1/event-1.json']])
  })

  it('falls back to the deterministic replay object key when the replay row is not linked yet', async () => {
    const responses = [[], [{ projectId: 'project-1' }]]
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => responses.shift(),
          }),
        }),
      }),
    }
    const minio = {
      getObject: mock(async () => JSON.stringify([{ timestamp: 1000, type: 2, data: {} }])),
    }
    const service = new EventsService(db as never, minio as never)

    const replay = await service.findReplayByEventId('event-1')

    expect(replay.events).toHaveLength(1)
    expect(minio.getObject.mock.calls).toEqual([['replays/project-1/event-1.json']])
  })
})
