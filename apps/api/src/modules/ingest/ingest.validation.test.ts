import { BadRequestException } from '@nestjs/common'
import { describe, expect, it } from 'bun:test'
import { validateIngestBody, validateReplayBody } from './ingest.validation'

describe('ingest validation', () => {
  it('rejects missing events array', () => {
    expect(() => validateIngestBody({})).toThrow(BadRequestException)
  })

  it('rejects batches with more than 50 events', () => {
    const events = Array.from({ length: 51 }, (_, index) => ({
      eventId: `event-${index}`,
      timestamp: Date.now(),
      level: 'error',
      message: 'boom',
      fingerprint: 'fp',
    }))

    expect(() => validateIngestBody({ events, sentAt: new Date().toISOString() })).toThrow(BadRequestException)
  })

  it('rejects error events without eventId', () => {
    expect(() =>
      validateIngestBody({
        events: [{ timestamp: Date.now(), level: 'error', message: 'boom', fingerprint: 'fp' }],
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects unsupported performance metric names', () => {
    expect(() =>
      validateIngestBody({
        events: [{ eventId: 'perf-1', type: 'performance', name: 'FCP', value: 12, rating: 'good', timestamp: Date.now() }],
      }),
    ).toThrow(BadRequestException)
  })

  it('accepts valid mixed ingest events', () => {
    const body = {
      events: [
        { eventId: 'event-1', timestamp: Date.now(), level: 'error', message: 'boom', fingerprint: 'fp' },
        { eventId: 'perf-1', type: 'performance', name: 'LCP', value: 1200, rating: 'good', timestamp: Date.now() },
      ],
      sentAt: new Date().toISOString(),
    }

    expect(validateIngestBody(body)).toBe(body)
  })

  it('rejects replay bodies without rrweb events', () => {
    expect(() => validateReplayBody({ eventId: 'event-1', events: [] })).toThrow(BadRequestException)
  })
})
