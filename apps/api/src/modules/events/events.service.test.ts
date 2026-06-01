import { describe, expect, it, mock } from 'bun:test'
import { EventsService } from './events.service'

mock.module('source-map', () => ({
  SourceMapConsumer: class {
    constructor(_raw: string) {}
    originalPositionFor() {
      return { source: 'src/App.tsx', line: 10, column: 2, name: 'render' }
    }
    destroy() {}
  },
}))

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

  it('resolves stack traces with the source map matching project, release, and filename', async () => {
    const whereConditions: unknown[] = []
    const responses = [
      [
        {
          id: 'event-1',
          projectId: 'project-1',
          release: '1.0.0',
          stacktrace: [{ function: 'render', filename: 'app.js', lineno: 100, colno: 20 }],
        },
      ],
      [{ storageUrl: 'sourcemaps/project-1/1.0.0/app.js.map' }],
    ]
    const db = {
      select: () => ({
        from: () => ({
          where: (condition: unknown) => ({
            limit: () => {
              whereConditions.push(condition)
              return responses.shift()
            },
          }),
        }),
      }),
    }
    const minio = {
      getObject: mock(async () => '{}'),
    }
    const service = new EventsService(db as never, minio as never)

    const event = await service.findById('event-1')

    expect(event?.stacktrace).toEqual([{ function: 'render', filename: 'src/App.tsx', lineno: 10, colno: 2 }])
    expect(extractSqlParamValues(whereConditions[1])).toEqual(expect.arrayContaining(['project-1', '1.0.0', 'app.js.map']))
    expect(minio.getObject.mock.calls).toEqual([['sourcemaps/project-1/1.0.0/app.js.map']])
  })
})

function extractSqlParamValues(value: unknown): unknown[] {
  if (!value || typeof value !== 'object') return []
  const record = value as { value?: unknown; queryChunks?: unknown[] }
  const values = 'value' in record ? [record.value] : []
  return values.concat((record.queryChunks ?? []).flatMap((chunk) => extractSqlParamValues(chunk)))
}
