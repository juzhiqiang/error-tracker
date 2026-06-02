import { describe, expect, it, mock } from 'bun:test'
import { MetricsService } from './metrics.service'

describe('MetricsService', () => {
  it('returns queue counts for events and cleanup queues', async () => {
    const eventsQueue = {
      getJobCounts: mock(async () => ({ waiting: 2, active: 1, failed: 3, delayed: 4 })),
    }
    const cleanupQueue = {
      getJobCounts: mock(async () => ({ waiting: 0, active: 0, failed: 1, delayed: 0 })),
    }
    const service = new MetricsService(eventsQueue as never, cleanupQueue as never)

    await expect(service.queueCounts()).resolves.toEqual({
      events: { waiting: 2, active: 1, failed: 3, delayed: 4 },
      cleanup: { waiting: 0, active: 0, failed: 1, delayed: 0 },
    })
    expect(eventsQueue.getJobCounts.mock.calls[0]).toEqual(['waiting', 'active', 'failed', 'delayed'])
  })

  it('tracks ingest accepted and rejected counters', () => {
    const service = new MetricsService({} as never, {} as never)

    service.recordIngestAccepted()
    service.recordIngestRejected('rate_limited')
    service.recordIngestRejected('payload_too_large')

    expect(service.ingestMetrics()).toEqual({
      accepted: 1,
      rejected: 2,
      rateLimited: 1,
      payloadTooLarge: 1,
      validationFailed: 0,
    })
  })
})
