# Task P2-03: Ingest 模块（事件接收核心）

**计划：** Plan 2  
**依赖：** Task P2-02  
**可并行：** 是（与 Task P2-04, P2-05, P2-06 并行）  
**预计时间：** 20 min

---

## 目标

实现事件接收核心：DSN Token 鉴权 guard、服务端指纹计算、UPSERT issues、BullMQ 异步处理。

## 需要创建的文件

- `apps/api/src/common/guards/dsn-auth.guard.ts`
- `apps/api/src/modules/ingest/ingest.service.ts`
- `apps/api/src/modules/ingest/ingest.controller.ts`
- `apps/api/src/modules/ingest/ingest.module.ts`

## 步骤

- [ ] **Step 1: 创建 DSN Token 认证 guard**

```typescript
// apps/api/src/common/guards/dsn-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { projects } from '../../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

@Injectable()
export class DsnAuthGuard implements CanActivate {
  constructor(@Inject(DB) private db: PostgresJsDatabase<typeof schema>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const token = req.params.token as string
    const projectId = req.params.projectId as string

    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.dsnToken, token))
      .limit(1)

    if (!project || project.id !== projectId) {
      throw new UnauthorizedException('Invalid DSN token')
    }

    req.project = project
    return true
  }
}
```

- [ ] **Step 2: 创建 ingest.service.ts（服务端指纹 + UPSERT）**

```typescript
// apps/api/src/modules/ingest/ingest.service.ts
import { Injectable, Inject } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bullmq'
import { createHash } from 'crypto'
import { sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { events, performanceMetrics } from '../../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

interface StackFrame { function: string; filename: string; lineno?: number; colno?: number }
interface IncomingEvent {
  eventId: string
  timestamp: number
  level: string
  message: string
  fingerprint: string
  stacktrace?: StackFrame[]
  breadcrumbs?: unknown[]
  request?: Record<string, unknown>
  user?: Record<string, unknown>
  tags?: Record<string, string>
  environment?: string
  release?: string
}

interface PerformancePayload {
  eventId: string
  type: 'performance'
  name: 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  url?: string
  timestamp: number
}

@Injectable()
export class IngestService {
  constructor(
    @Inject(DB) private db: PostgresJsDatabase<typeof schema>,
    @InjectQueue('events') private eventsQueue: Queue,
  ) {}

  async ingestEvent(projectId: string, payload: IncomingEvent): Promise<void> {
    const serverFingerprint = this.computeServerFingerprint(payload)

    // UPSERT issue：相同指纹 count++，已 resolved 自动重新打开
    const result = await this.db.execute(sql`
      INSERT INTO issues (project_id, fingerprint, title, level, first_seen, last_seen, count, user_count)
      VALUES (${projectId}, ${serverFingerprint}, ${payload.message.slice(0, 255)}, ${payload.level}, now(), now(), 1, 1)
      ON CONFLICT (project_id, fingerprint) DO UPDATE SET
        last_seen = now(),
        count = issues.count + 1,
        user_count = issues.user_count + 1,
        status = CASE WHEN issues.status = 'resolved' THEN 'unresolved' ELSE issues.status END
      RETURNING id
    `)

    const issueId = (result as unknown as { rows: { id: string }[] }).rows[0]?.id

    await this.db.insert(events).values({
      id: payload.eventId,
      issueId,
      projectId,
      timestamp: new Date(payload.timestamp),
      level: payload.level,
      message: payload.message,
      stacktrace: payload.stacktrace ?? null,
      breadcrumbs: payload.breadcrumbs ?? null,
      request: payload.request ?? null,
      user: payload.user ?? null,
      tags: payload.tags ?? null,
      environment: payload.environment,
      release: payload.release,
    })

    await this.eventsQueue.add('check-alert', { projectId, issueId })
  }

  async ingestPerformance(projectId: string, metrics: PerformancePayload[]): Promise<void> {
    if (!metrics.length) return
    await this.db.insert(performanceMetrics).values(
      metrics.map(m => ({
        projectId,
        name: m.name,
        value: Math.round(m.value),
        rating: m.rating,
        url: m.url,
        timestamp: new Date(m.timestamp),
      }))
    )
  }

  private computeServerFingerprint(event: IncomingEvent): string {
    const frames = (event.stacktrace ?? []).slice(0, 3)
    const frameKey = frames
      .map(f => `${f.function}@${f.filename.split('/').pop()}`)
      .join('|')
    return createHash('sha1')
      .update(`${event.level}:${event.message}:${frameKey}`)
      .digest('hex')
      .slice(0, 16)
  }
}
```

- [ ] **Step 3: 创建 ingest.controller.ts**

```typescript
// apps/api/src/modules/ingest/ingest.controller.ts
import { Controller, Post, Param, Body, UseGuards, HttpCode } from '@nestjs/common'
import { DsnAuthGuard } from '../../common/guards/dsn-auth.guard'
import { IngestService } from './ingest.service'

@Controller('ingest')
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post(':projectId/:token')
  @UseGuards(DsnAuthGuard)
  @HttpCode(202)
  async ingest(
    @Param('projectId') projectId: string,
    @Body() body: { events: unknown[]; sentAt: string },
  ) {
    const errorEvents = (body.events ?? []).filter((e: unknown) => (e as { type?: string }).type !== 'performance')
    const perfEvents = (body.events ?? []).filter((e: unknown) => (e as { type?: string }).type === 'performance')

    await Promise.all([
      ...errorEvents.map(e => this.ingestService.ingestEvent(projectId, e as never)),
      perfEvents.length > 0
        ? this.ingestService.ingestPerformance(projectId, perfEvents as never)
        : Promise.resolve(),
    ])

    return { ok: true }
  }

  @Post(':projectId/:token/replay')
  @UseGuards(DsnAuthGuard)
  @HttpCode(202)
  async ingestReplay(
    @Param('projectId') projectId: string,
    @Body() body: { eventId: string; events: unknown[] },
  ) {
    // MinIO 上传在 Task P2-05 实现
    return { ok: true }
  }
}
```

- [ ] **Step 4: 创建 ingest.module.ts**

```typescript
// apps/api/src/modules/ingest/ingest.module.ts
import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { IngestController } from './ingest.controller'
import { IngestService } from './ingest.service'
import { DsnAuthGuard } from '../../common/guards/dsn-auth.guard'

@Module({
  imports: [BullModule.registerQueue({ name: 'events' })],
  controllers: [IngestController],
  providers: [IngestService, DsnAuthGuard],
})
export class IngestModule {}
```

- [ ] **Step 5: 提交**

```bash
cd D:/myProject/error-tracker
git add apps/api/src/common/ apps/api/src/modules/ingest/
git commit -m "feat: Ingest 模块（DSN 鉴权、服务端指纹、UPSERT issues）"
```
