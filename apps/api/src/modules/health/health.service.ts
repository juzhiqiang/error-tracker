import { Inject, Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { sql } from 'drizzle-orm'
import type { Queue } from 'bullmq'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { DB } from '../../db/db.module'
import * as schema from '../../db/schema'
import { MinioService } from '../sourcemaps/minio.service'

export type HealthCheckStatus = 'ok' | 'error'

export interface HealthCheckResult {
  status: HealthCheckStatus
  latencyMs: number
  message?: string
}

export interface HealthReport {
  ok: boolean
  checks: {
    api: HealthCheckResult
    db: HealthCheckResult
    redis: HealthCheckResult
    minio: HealthCheckResult
  }
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(DB) private readonly db: PostgresJsDatabase<typeof schema>,
    @InjectQueue('cleanup') private readonly cleanupQueue: Queue,
    private readonly minio: MinioService,
  ) {}

  async check(): Promise<HealthReport> {
    const [api, db, redis, minio] = await Promise.all([
      this.measure(async () => {}),
      this.measure(async () => {
        await this.db.execute(sql`select 1`)
      }),
      this.measure(async () => {
        await this.cleanupQueue.waitUntilReady()
      }),
      this.measure(async () => {
        await this.minio.headBucket()
      }),
    ])

    const checks = { api, db, redis, minio }
    return {
      ok: Object.values(checks).every((check) => check.status === 'ok'),
      checks,
    }
  }

  private async measure(check: () => Promise<void>): Promise<HealthCheckResult> {
    const startedAt = Date.now()
    try {
      await check()
      return { status: 'ok', latencyMs: Date.now() - startedAt }
    } catch (err) {
      return {
        status: 'error',
        latencyMs: Date.now() - startedAt,
        message: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
