import { describe, expect, it, mock } from 'bun:test'
import { BadRequestException } from '@nestjs/common'
import { IngestController } from './ingest.controller'
import type { IngestService } from './ingest.service'
import type { IngestLimitsService } from './ingest.limits'
import type { MetricsService } from '../observability/metrics.service'

describe('IngestController', () => {
  it('rejects invalid ingest bodies before calling the service', async () => {
    const enqueueBatch = mock(async () => undefined)
    const limits = createLimits()
    const metrics = createMetrics()
    const controller = new IngestController({ enqueueBatch } as unknown as IngestService, limits, metrics)

    await expect(controller.ingest('project-1', { events: 'not-array' } as never)).rejects.toThrow(BadRequestException)
    expect(enqueueBatch.mock.calls).toHaveLength(0)
    expect(metrics.calls).toEqual([['rejected', 'validation_failed']])
  })

  it('forwards replay payloads to the ingest service', async () => {
    const ingestReplay = mock(async () => undefined)
    const limits = createLimits()
    const metrics = createMetrics()
    const controller = new IngestController({ ingestReplay } as unknown as IngestService, limits, metrics)
    const replayEvents = [{ timestamp: 1000, type: 2, data: { href: 'http://localhost' } }]

    await controller.ingestReplay('project-1', { eventId: 'event-1', events: replayEvents })

    expect(ingestReplay.mock.calls).toEqual([['project-1', 'event-1', replayEvents]])
  })

  it('checks body size, rate limit, and daily quota before ingesting events', async () => {
    const enqueueBatch = mock(async () => undefined)
    const limits = createLimits()
    const metrics = createMetrics()
    const controller = new IngestController({ enqueueBatch } as unknown as IngestService, limits, metrics)
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
    expect(enqueueBatch.mock.calls).toEqual([['project-1', body.events]])
    expect(metrics.calls).toEqual([['accepted']])
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

function createMetrics() {
  const calls: unknown[][] = []
  return {
    calls,
    recordIngestAccepted: () => calls.push(['accepted']),
    recordIngestRejected: (reason: string) => calls.push(['rejected', reason]),
  } as unknown as MetricsService & { calls: unknown[][] }
}
