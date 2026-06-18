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
        events: [{ eventId: 'perf-1', type: 'performance', name: 'NAV', value: 12, rating: 'good', timestamp: Date.now() }],
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

  it('accepts all SDK web-vitals metric names', () => {
    const body = {
      events: ['LCP', 'FID', 'CLS', 'INP', 'TTFB', 'FCP'].map((name) => ({
        eventId: `perf-${name}`,
        timestamp: Date.now(),
        type: 'performance',
        kind: 'web-vital',
        name,
        value: name === 'CLS' ? 0.12 : 1200,
        rating: 'good',
      })),
    }

    expect(validateIngestBody(body)).toBe(body)
  })

  it('accepts resource and longtask performance events', () => {
    const body = {
      events: [
        {
          eventId: 'resource-1',
          timestamp: Date.now(),
          type: 'performance',
          kind: 'resource',
          name: 'resource',
          value: 123.4,
          duration: 123.4,
          url: 'https://cdn.example.com/app.js',
          initiatorType: 'script',
        },
        {
          eventId: 'longtask-1',
          timestamp: Date.now(),
          type: 'performance',
          kind: 'longtask',
          name: 'longtask',
          value: 88,
          duration: 88,
          startTime: 12,
        },
      ],
    }

    expect(validateIngestBody(body)).toBe(body)
  })

  it('rejects performance events without a finite numeric value', () => {
    expect(() =>
      validateIngestBody({
        events: [
          {
            eventId: 'bad-1',
            timestamp: Date.now(),
            type: 'performance',
            kind: 'resource',
            name: 'resource',
            value: Number.NaN,
          },
        ],
      }),
    ).toThrow('events[0].value must be a finite number')
  })

  it('rejects replay bodies without rrweb events', () => {
    expect(() => validateReplayBody({ eventId: 'event-1', events: [] })).toThrow(BadRequestException)
  })
})
