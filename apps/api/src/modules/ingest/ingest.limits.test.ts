import { describe, expect, it, mock } from 'bun:test'
import { HttpException, HttpStatus, PayloadTooLargeException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { IngestLimitsService } from './ingest.limits'

describe('IngestLimitsService', () => {
  it('rejects ingest bodies above the configured byte limit', () => {
    const service = new IngestLimitsService({ maxIngestBytes: 20 })

    expect(() => service.assertBodySize('ingest', { message: 'this is too large' })).toThrow(PayloadTooLargeException)
  })

  it('rejects replay bodies above the configured byte limit', () => {
    const service = new IngestLimitsService({ maxReplayBytes: 20 })

    expect(() => service.assertBodySize('replay', { events: [{ data: 'this is too large' }] })).toThrow(
      PayloadTooLargeException,
    )
  })

  it('rejects requests above the per-project rate window', async () => {
    const service = new IngestLimitsService({ rateLimitWindowMs: 60_000, maxRequestsPerWindow: 2 })

    await service.assertRequestAllowed('project-1')
    await service.assertRequestAllowed('project-1')

    await expect(service.assertRequestAllowed('project-1')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    })
  })

  it('rejects event batches above the daily project quota', async () => {
    const service = new IngestLimitsService({ dailyEventQuota: 3 })

    await service.assertDailyQuota('project-1', 2)
    await service.assertDailyQuota('project-1', 1)

    await expect(service.assertDailyQuota('project-1', 1)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    })
  })

  it('shares rate counters through Redis across service instances', async () => {
    const redis = createRedisCounter()
    const queue = { client: Promise.resolve(redis) }
    const first = new IngestLimitsService({ rateLimitWindowMs: 60_000, maxRequestsPerWindow: 2 }, queue as never)
    const second = new IngestLimitsService({ rateLimitWindowMs: 60_000, maxRequestsPerWindow: 2 }, queue as never)

    await first.assertRequestAllowed('project-1', 1_700_000_000_000)
    await second.assertRequestAllowed('project-1', 1_700_000_001_000)

    await expect(second.assertRequestAllowed('project-1', 1_700_000_002_000)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    })
    expect(redis.incrby).toHaveBeenCalled()
  })

  it('can be constructed by Nest without an explicit options provider', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [IngestLimitsService],
    }).compile()

    expect(moduleRef.get(IngestLimitsService)).toBeInstanceOf(IngestLimitsService)
  })
})

function createRedisCounter() {
  const values = new Map<string, number>()
  return {
    incrby: mock(async (key: string, amount: number) => {
      const next = (values.get(key) ?? 0) + amount
      values.set(key, next)
      return next
    }),
    decrby: mock(async (key: string, amount: number) => {
      const next = (values.get(key) ?? 0) - amount
      values.set(key, next)
      return next
    }),
    pexpire: mock(async () => 1),
  }
}
