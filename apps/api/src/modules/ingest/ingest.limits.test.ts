import { describe, expect, it } from 'bun:test'
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

  it('rejects requests above the per-project rate window', () => {
    const service = new IngestLimitsService({ rateLimitWindowMs: 60_000, maxRequestsPerWindow: 2 })

    service.assertRequestAllowed('project-1')
    service.assertRequestAllowed('project-1')

    try {
      service.assertRequestAllowed('project-1')
      throw new Error('expected rate limit to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException)
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS)
    }
  })

  it('rejects event batches above the daily project quota', () => {
    const service = new IngestLimitsService({ dailyEventQuota: 3 })

    service.assertDailyQuota('project-1', 2)
    service.assertDailyQuota('project-1', 1)

    try {
      service.assertDailyQuota('project-1', 1)
      throw new Error('expected quota to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException)
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS)
    }
  })

  it('can be constructed by Nest without an explicit options provider', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [IngestLimitsService],
    }).compile()

    expect(moduleRef.get(IngestLimitsService)).toBeInstanceOf(IngestLimitsService)
  })
})
