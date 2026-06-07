import { describe, expect, it, mock } from 'bun:test'
import { IngestProcessor } from './ingest.processor'
import type { IngestService } from './ingest.service'

describe('IngestProcessor', () => {
  it('processes queued ingest batches through the ingest service', async () => {
    const service = {
      ingestEvent: mock(async () => undefined),
      ingestPerformance: mock(async () => undefined),
    }
    const processor = new IngestProcessor(service as unknown as IngestService)
    const errorEvent = {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'boom',
      fingerprint: 'client-fp',
    }
    const performanceEvent = {
      eventId: 'perf-1',
      type: 'performance',
      name: 'LCP',
      value: 1200,
      rating: 'good',
      timestamp: Date.now(),
    }

    await processor.process({
      name: 'ingest-batch',
      data: { projectId: 'project-1', events: [errorEvent, performanceEvent] },
    } as never)

    expect(service.ingestEvent.mock.calls).toEqual([['project-1', errorEvent]])
    expect(service.ingestPerformance.mock.calls).toEqual([['project-1', [performanceEvent]]])
  })
})
