import { describe, expect, it, mock } from 'bun:test'
import { HealthService } from './health.service'

describe('HealthService', () => {
  it('returns ok when API, DB, Redis, and MinIO checks pass', async () => {
    const db = { execute: mock(async () => ({ rows: [{ ok: 1 }] })) }
    const queue = { waitUntilReady: mock(async () => ({})) }
    const minio = { headBucket: mock(async () => {}) }
    const metrics = {
      queueCounts: mock(async () => ({ events: { failed: 0 }, cleanup: { failed: 0 } })),
      ingestMetrics: mock(() => ({
        accepted: 1,
        rejected: 0,
        rateLimited: 0,
        payloadTooLarge: 0,
        validationFailed: 0,
      })),
    }
    const service = new HealthService(db as never, queue as never, minio as never, metrics as never)

    const report = await service.check()

    expect(report.ok).toBe(true)
    expect(report.checks.api.status).toBe('ok')
    expect(report.checks.db.status).toBe('ok')
    expect(report.checks.redis.status).toBe('ok')
    expect(report.checks.minio.status).toBe('ok')
    expect(report.queues).toEqual({ events: { failed: 0 }, cleanup: { failed: 0 } })
    expect(report.ingest).toEqual({
      accepted: 1,
      rejected: 0,
      rateLimited: 0,
      payloadTooLarge: 0,
      validationFailed: 0,
    })
    expect(db.execute).toHaveBeenCalledTimes(1)
    expect(queue.waitUntilReady).toHaveBeenCalledTimes(1)
    expect(minio.headBucket).toHaveBeenCalledTimes(1)
  })

  it('returns unhealthy when DB check fails without skipping other checks', async () => {
    const db = { execute: mock(async () => { throw new Error('database unavailable') }) }
    const queue = { waitUntilReady: mock(async () => ({})) }
    const minio = { headBucket: mock(async () => {}) }
    const metrics = {
      queueCounts: mock(async () => ({ events: { failed: 0 }, cleanup: { failed: 0 } })),
      ingestMetrics: mock(() => ({ accepted: 0, rejected: 1 })),
    }
    const service = new HealthService(db as never, queue as never, minio as never, metrics as never)

    const report = await service.check()

    expect(report.ok).toBe(false)
    expect(report.checks.db.status).toBe('error')
    expect(report.checks.db.message).toBe('database unavailable')
    expect(report.checks.redis.status).toBe('ok')
    expect(report.checks.minio.status).toBe('ok')
  })
})
