import { describe, expect, it, mock } from 'bun:test'
import { IngestController } from './ingest.controller'
import type { IngestService } from './ingest.service'

describe('IngestController', () => {
  it('forwards replay payloads to the ingest service', async () => {
    const ingestReplay = mock(async () => undefined)
    const controller = new IngestController({ ingestReplay } as unknown as IngestService)
    const replayEvents = [{ timestamp: 1000, type: 2, data: { href: 'http://localhost' } }]

    await controller.ingestReplay('project-1', { eventId: 'event-1', events: replayEvents })

    expect(ingestReplay.mock.calls).toEqual([['project-1', 'event-1', replayEvents]])
  })
})
