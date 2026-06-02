import { describe, expect, it, mock } from 'bun:test'
import { HttpException, HttpStatus } from '@nestjs/common'
import { HealthController } from './health.controller'

describe('HealthController', () => {
  it('returns the health report when all checks are healthy', async () => {
    const report = { ok: true, checks: { api: { status: 'ok', latencyMs: 0 } } }
    const controller = new HealthController({ check: mock(async () => report) } as never)

    await expect(controller.health()).resolves.toBe(report)
  })

  it('throws 503 with the health report when any check is unhealthy', async () => {
    const report = { ok: false, checks: { db: { status: 'error', latencyMs: 1, message: 'down' } } }
    const controller = new HealthController({ check: mock(async () => report) } as never)

    try {
      await controller.health()
      throw new Error('expected health to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException)
      expect((err as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
      expect((err as HttpException).getResponse()).toEqual(report)
    }
  })
})
