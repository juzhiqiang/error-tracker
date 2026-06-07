import { describe, expect, it, mock } from 'bun:test'
import { QueueOperationsService } from './queue-operations.service'

describe('QueueOperationsService', () => {
  it('lists queue counts and failed jobs', async () => {
    const failedJob = { id: 'job-1', name: 'check-alert', failedReason: 'webhook failed', timestamp: 1 }
    const eventsQueue = {
      getJobCounts: mock(async () => ({ waiting: 0, active: 0, failed: 1, delayed: 0 })),
      getJobs: mock(async () => [failedJob]),
    }
    const ingestQueue = {
      getJobCounts: mock(async () => ({ waiting: 3, active: 1, failed: 0, delayed: 0 })),
      getJobs: mock(async () => []),
    }
    const cleanupQueue = {
      getJobCounts: mock(async () => ({ waiting: 0, active: 0, failed: 0, delayed: 0 })),
      getJobs: mock(async () => []),
    }

    const service = new QueueOperationsService(ingestQueue as never, eventsQueue as never, cleanupQueue as never)
    const report = await service.list()

    expect(report.ingest.counts.waiting).toBe(3)
    expect(report.events.counts.failed).toBe(1)
    expect(report.events.failedJobs[0]).toEqual({
      id: 'job-1',
      name: 'check-alert',
      failedReason: 'webhook failed',
      timestamp: 1,
    })
    expect(eventsQueue.getJobCounts.mock.calls[0]).toEqual(['waiting', 'active', 'failed', 'delayed'])
    expect(eventsQueue.getJobs.mock.calls[0]).toEqual([['failed'], 0, 20])
  })

  it('retries and removes jobs by queue name', async () => {
    const job = { retry: mock(async () => undefined), remove: mock(async () => undefined) }
    const queue = { getJob: mock(async () => job) }
    const service = new QueueOperationsService(queue as never, queue as never, queue as never)

    await service.retry('ingest', 'job-1')
    await service.remove('cleanup', 'job-1')

    expect(job.retry).toHaveBeenCalled()
    expect(job.remove).toHaveBeenCalled()
  })
})
