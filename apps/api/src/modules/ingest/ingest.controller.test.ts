import { describe, expect, it, mock } from 'bun:test'
import { BadRequestException } from '@nestjs/common'
import { IngestController } from './ingest.controller'
import type { IngestService } from './ingest.service'
import type { IngestLimitsService } from './ingest.limits'

describe('IngestController', () => {
  it('rejects invalid ingest bodies before calling the service', async () => {
    const ingestEvent = mock(async () => undefined)
    const ingestPerformance = mock(async () => undefined)
    const limits = createLimits()
    const controller = new IngestController({ ingestEvent, ingestPerformance } as unknown as IngestService, limits)

    await expect(controller.ingest('project-1', { events: 'not-array' } as never)).rejects.toThrow(BadRequestException)
    expect(ingestEvent.mock.calls).toHaveLength(0)
    expect(ingestPerformance.mock.calls).toHaveLength(0)
  })

  it('forwards replay payloads to the ingest service', async () => {
    const ingestReplay = mock(async () => undefined)
    const limits = createLimits()
    const controller = new IngestController({ ingestReplay } as unknown as IngestService, limits)
    const replayEvents = [{ timestamp: 1000, type: 2, data: { href: 'http://localhost' } }]

    await controller.ingestReplay('project-1', { eventId: 'event-1', events: replayEvents })

    expect(ingestReplay.mock.calls).toEqual([['project-1', 'event-1', replayEvents]])
  })

  it('checks body size, rate limit, and daily quota before ingesting events', async () => {
    const ingestEvent = mock(async () => undefined)
    const limits = createLimits()
    const controller = new IngestController({ ingestEvent } as unknown as IngestService, limits)
    const body = {
      events: [
        {
          eventId: 'event-1',
          timestamp: Date.now(),
          level: 'error',
          message: 'boom',
          fingerprint: 'abc',
        },
      ],
    }

    await controller.ingest('project-1', body)

    expect(limits.calls).toEqual([
      ['body', 'ingest'],
      ['rate', 'project-1'],
      ['quota', 'project-1', 1],
    ])
  })
})

function createLimits() {
  const calls: unknown[][] = []
  return {
    calls,
    assertBodySize: (kind: string) => calls.push(['body', kind]),
    assertRequestAllowed: (projectId: string) => calls.push(['rate', projectId]),
    assertDailyQuota: (projectId: string, eventCount: number) => calls.push(['quota', projectId, eventCount]),
  } as unknown as IngestLimitsService & { calls: unknown[][] }
}
