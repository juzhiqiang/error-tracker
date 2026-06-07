import { describe, expect, it, mock } from 'bun:test'
import { HttpException, HttpStatus } from '@nestjs/common'
import { SelfMonitoringService } from './self-monitoring.service'

describe('SelfMonitoringService', () => {
  it('does not send events when no DSN is configured', async () => {
    const sender = mock(async () => new Response('{}', { status: 202 }))
    const service = new SelfMonitoringService(
      {},
      { sender },
    )

    await service.captureException(new Error('boom'))

    expect(sender).not.toHaveBeenCalled()
  })

  it('sends sanitized API exceptions to the configured ingest DSN', async () => {
    const sender = mock(async () => new Response('{}', { status: 202 }))
    const service = new SelfMonitoringService(
      {
        ERROR_TRACKER_DSN: 'http://localhost:3002/ingest/self-project',
        ERROR_TRACKER_TOKEN: 'self-token',
        ERROR_TRACKER_ENVIRONMENT: 'production',
        ERROR_TRACKER_RELEASE: 'api@1.2.3',
      },
      { sender, idFactory: () => 'evt-self-1', now: () => 1_717_171_717_000 },
    )

    await service.captureException(new Error('database password=secret exploded'), {
      method: 'GET',
      path: '/api/issues?cursor=hidden',
      statusCode: 500,
    })

    expect(sender).toHaveBeenCalledTimes(1)
    const [url, init] = sender.mock.calls[0]
    expect(url).toBe('http://localhost:3002/ingest/self-project')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('x-error-tracker-token')).toBe('self-token')
    const body = JSON.parse(String(init?.body))
    expect(body.sentAt).toBe('2024-05-31T16:08:37.000Z')
    expect(body.events).toHaveLength(1)
    expect(body.events[0]).toMatchObject({
      eventId: 'evt-self-1',
      timestamp: 1_717_171_717_000,
      level: 'error',
      message: 'database [Filtered] exploded',
      fingerprint: 'api:self-monitoring:Error:database [Filtered] exploded',
      environment: 'production',
      release: 'api@1.2.3',
      request: { method: 'GET', url: '/api/issues' },
      tags: {
        service: 'api',
        source: 'self-monitoring',
        statusCode: '500',
      },
    })
    expect(Array.isArray(body.events[0].stacktrace)).toBe(true)
  })

  it('captures only server-side failures and skips ingest recursion', () => {
    const service = new SelfMonitoringService({
      ERROR_TRACKER_DSN: 'http://localhost:3002/ingest/self-project/self-token',
    })

    expect(service.shouldCapture(new HttpException('bad request', HttpStatus.BAD_REQUEST), { path: '/api/projects' })).toBe(false)
    expect(service.shouldCapture(new HttpException('broken', HttpStatus.INTERNAL_SERVER_ERROR), { path: '/api/projects' })).toBe(true)
    expect(service.shouldCapture(new Error('boom'), { path: '/ingest/self-project/self-token' })).toBe(false)
  })
})
