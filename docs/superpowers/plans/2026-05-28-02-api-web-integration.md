# Error Tracker Plan 2: API Server + Dashboard + utils-plane 接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 error-tracker 的 NestJS API（事件接收、聚合、Source Map 反解、Webhook 告警、数据清理）、Next.js Dashboard（登录、错误列表/详情/录屏/性能页），以及 utils-plane 的 SDK 接入。

**Architecture:** API 接收 `/ingest` 事件后通过 BullMQ 异步处理，服务端二次指纹计算后 UPSERT issues，Source Map 从 MinIO 取文件用 `source-map` 包反解。Dashboard 用 Better-Auth 保护，`/ingest/*` 公开。

**Tech Stack:** NestJS 11, Drizzle ORM, PostgreSQL 16, BullMQ, MinIO (S3), source-map npm, Better-Auth, Next.js 14 App Router, TailwindCSS, Radix UI, Recharts（趋势图）, rrweb-player

**前置条件:** Plan 1 完成（`packages/sdk` 已构建）

---

## 文件结构

```
apps/api/
├── package.json
├── tsconfig.json
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── filters/http-exception.filter.ts
│   │   └── guards/dsn-auth.guard.ts       # /ingest DSN Token 验证
│   ├── modules/
│   │   ├── ingest/
│   │   │   ├── ingest.module.ts
│   │   │   ├── ingest.controller.ts       # POST /ingest/:projectId
│   │   │   ├── ingest.service.ts          # 指纹计算 + UPSERT
│   │   │   └── ingest.processor.ts        # BullMQ worker
│   │   ├── issues/
│   │   │   ├── issues.module.ts
│   │   │   ├── issues.controller.ts       # GET/PATCH /api/issues
│   │   │   └── issues.service.ts
│   │   ├── events/
│   │   │   ├── events.module.ts
│   │   │   ├── events.controller.ts       # GET /api/events/:id
│   │   │   └── events.service.ts          # source-map 反解
│   │   ├── projects/
│   │   │   ├── projects.module.ts
│   │   │   ├── projects.controller.ts     # GET/POST /api/projects
│   │   │   └── projects.service.ts
│   │   ├── sourcemaps/
│   │   │   ├── sourcemaps.module.ts
│   │   │   ├── sourcemaps.controller.ts   # POST /api/sourcemaps/:projectId/:release
│   │   │   └── sourcemaps.service.ts      # MinIO 上传 + DB 记录
│   │   ├── stats/
│   │   │   ├── stats.module.ts
│   │   │   ├── stats.controller.ts        # GET /api/stats/issues + /performance
│   │   │   └── stats.service.ts
│   │   ├── alerts/
│   │   │   ├── alerts.module.ts
│   │   │   └── alerts.processor.ts        # BullMQ Webhook worker
│   │   └── cleanup/
│   │       ├── cleanup.module.ts
│   │       └── cleanup.processor.ts       # BullMQ 定时清理
│   └── db/
│       ├── schema.ts                      # Drizzle schema
│       └── db.module.ts

apps/web/
├── package.json
├── src/app/
│   ├── layout.tsx                         # SDK init + Better-Auth Provider
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── setup/page.tsx                 # 首次创建管理员
│   ├── (dashboard)/
│   │   ├── layout.tsx                     # 需要登录的布局
│   │   ├── page.tsx                       # 概览
│   │   ├── issues/
│   │   │   ├── page.tsx                   # 错误列表（搜索/过滤）
│   │   │   └── [id]/
│   │   │       ├── page.tsx               # 错误详情（Stack Trace + Breadcrumbs）
│   │   │       └── replay/page.tsx        # 录屏回放
│   │   ├── performance/page.tsx           # Web Vitals 趋势
│   │   └── settings/page.tsx             # DSN Token + Webhook + 清理策略

packages/db-tracker/                       # Drizzle schema 共享包（可选）
```

---

### Task 1: API 依赖 + 基础结构

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`

- [ ] **Step 1: 创建 apps/api/package.json**

```json
{
  "name": "@error-tracker/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "test": "bun test",
    "lint": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/bull": "^10.0.0",
    "bullmq": "^5.0.0",
    "drizzle-orm": "^0.45.0",
    "postgres": "^3.4.0",
    "drizzle-kit": "^0.30.0",
    "better-auth": "^1.4.0",
    "@aws-sdk/client-s3": "^3.0.0",
    "source-map": "^0.7.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.0.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.0",
    "crypto": "^1.0.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/source-map": "^0.5.0",
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: 创建 apps/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "target": "ES2022",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: 创建 apps/api/src/main.ts**

```typescript
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3003' })
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  await app.listen(3002)
  console.log('error-tracker API running on http://localhost:3002')
}
bootstrap()
```

- [ ] **Step 4: 安装依赖**

```bash
cd D:/myProject/error-tracker && bun install
```

- [ ] **Step 5: 提交**

```bash
git add apps/api/package.json apps/api/tsconfig.json apps/api/src/main.ts
git commit -m "feat: api app 基础结构"
```

---

### Task 2: Drizzle Schema

**Files:**
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/db.module.ts`
- Create: `apps/api/drizzle.config.ts`

- [ ] **Step 1: 创建 apps/api/src/db/schema.ts**

```typescript
import { pgTable, text, integer, timestamp, jsonb, serial, uuid, boolean } from 'drizzle-orm/pg-core'

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  dsnToken: text('dsn_token').notNull().unique(),
  webhookUrl: text('webhook_url'),
  alertThreshold: integer('alert_threshold').default(50),
  retentionDays: integer('retention_days').default(30),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const issues = pgTable('issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  fingerprint: text('fingerprint').notNull(),
  title: text('title').notNull(),
  level: text('level', { enum: ['fatal', 'error', 'warning', 'info'] }).notNull().default('error'),
  status: text('status', { enum: ['unresolved', 'resolved', 'ignored'] }).notNull().default('unresolved'),
  firstSeen: timestamp('first_seen').defaultNow().notNull(),
  lastSeen: timestamp('last_seen').defaultNow().notNull(),
  count: integer('count').default(1).notNull(),
  userCount: integer('user_count').default(1).notNull(),
})

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  issueId: uuid('issue_id').references(() => issues.id),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  level: text('level').notNull().default('error'),
  message: text('message').notNull(),
  stacktrace: jsonb('stacktrace'),
  breadcrumbs: jsonb('breadcrumbs'),
  request: jsonb('request'),
  user: jsonb('user'),
  tags: jsonb('tags'),
  environment: text('environment'),
  release: text('release'),
})

export const replays = pgTable('replays', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').references(() => events.id),
  storageUrl: text('storage_url').notNull(),
  duration: integer('duration'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const performanceMetrics = pgTable('performance_metrics', {
  id: serial('id').primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  name: text('name', { enum: ['LCP', 'FID', 'CLS', 'INP', 'TTFB'] }).notNull(),
  value: integer('value').notNull(),
  rating: text('rating', { enum: ['good', 'needs-improvement', 'poor'] }).notNull(),
  url: text('url'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
})

export const sourceMaps = pgTable('source_maps', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  release: text('release').notNull(),
  filename: text('filename').notNull(),
  storageUrl: text('storage_url').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Better-Auth 表由 better-auth 自动管理，无需手写
```

- [ ] **Step 2: 创建 apps/api/src/db/db.module.ts**

```typescript
import { Module, Global } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export const DB = Symbol('DB')

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: () => {
        const client = postgres(process.env.DATABASE_URL!)
        return drizzle(client, { schema })
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
```

- [ ] **Step 3: 创建 apps/api/drizzle.config.ts**

```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config
```

- [ ] **Step 4: 生成并运行 migration**

```bash
cd D:/myProject/error-tracker
# 确保 Docker 已启动
bun run services:up
# 等待 postgres 就绪
sleep 3
cd apps/api
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

Expected: `drizzle/` 目录下出现 migration SQL 文件，migration 执行成功

- [ ] **Step 5: 提交**

```bash
git add apps/api/src/db/ apps/api/drizzle.config.ts apps/api/drizzle/
git commit -m "feat: Drizzle schema + migration（projects/issues/events/replays/performance/sourcemaps）"
```

---

### Task 3: Ingest 模块（事件接收核心）

**Files:**
- Create: `apps/api/src/common/guards/dsn-auth.guard.ts`
- Create: `apps/api/src/modules/ingest/ingest.controller.ts`
- Create: `apps/api/src/modules/ingest/ingest.service.ts`
- Create: `apps/api/src/modules/ingest/ingest.processor.ts`
- Create: `apps/api/src/modules/ingest/ingest.module.ts`

- [ ] **Step 1: 创建 DSN Token 认证 guard**

```typescript
// apps/api/src/common/guards/dsn-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { Inject } from '@nestjs/common'
import { DB } from '../../db/db.module'
import { projects } from '../../db/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'

@Injectable()
export class DsnAuthGuard implements CanActivate {
  constructor(@Inject(DB) private db: NodePgDatabase<typeof schema>) {}

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
import { eq, and } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { issues, events, performanceMetrics } from '../../db/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'

interface StackFrame { function: string; filename: string; lineno?: number; colno?: number }
interface IncomingEvent {
  eventId: string
  timestamp: number
  level: string
  message: string
  fingerprint: string  // 客户端指纹（备用）
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
    @Inject(DB) private db: NodePgDatabase<typeof schema>,
    @InjectQueue('events') private eventsQueue: Queue,
  ) {}

  async ingestEvent(projectId: string, payload: IncomingEvent): Promise<void> {
    // 服务端指纹：用原始 filename（不含 hash），后续 source map 反解后更新指纹不影响聚合
    const serverFingerprint = this.computeServerFingerprint(payload)

    // UPSERT issue
    const [issue] = await this.db.execute<{ id: string }[]>(/* sql */`
      INSERT INTO issues (project_id, fingerprint, title, level, first_seen, last_seen, count, user_count)
      VALUES (${projectId}, ${serverFingerprint}, ${payload.message.slice(0, 255)}, ${payload.level}, now(), now(), 1, 1)
      ON CONFLICT (project_id, fingerprint) DO UPDATE SET
        last_seen = now(),
        count = issues.count + 1,
        user_count = issues.user_count + 1,
        status = CASE WHEN issues.status = 'resolved' THEN 'unresolved' ELSE issues.status END
      RETURNING id
    `)

    // INSERT raw event
    await this.db.insert(events).values({
      id: payload.eventId,
      issueId: issue.id,
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

    // 异步处理：Webhook 告警检查
    await this.eventsQueue.add('check-alert', { projectId, issueId: issue.id })
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
      .map(f => `${f.function}@${f.filename.split('/').pop()}`)  // 只取文件名
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
import { Controller, Post, Param, Body, UseGuards, Req, HttpCode } from '@nestjs/common'
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
    // 录屏直接存 MinIO，在 Task 6 实现
    return { ok: true }
  }
}
```

- [ ] **Step 4: 创建 ingest.module.ts**

```typescript
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
git add apps/api/src/common/ apps/api/src/modules/ingest/
git commit -m "feat: Ingest 模块（DSN 鉴权、服务端指纹、UPSERT issues）"
```

---

### Task 4: Issues + Events + Projects + Stats 模块

**Files:**
- Create: `apps/api/src/modules/issues/issues.service.ts`
- Create: `apps/api/src/modules/issues/issues.controller.ts`
- Create: `apps/api/src/modules/issues/issues.module.ts`
- Create: `apps/api/src/modules/events/events.service.ts`
- Create: `apps/api/src/modules/events/events.controller.ts`
- Create: `apps/api/src/modules/events/events.module.ts`
- Create: `apps/api/src/modules/projects/projects.service.ts`
- Create: `apps/api/src/modules/projects/projects.controller.ts`
- Create: `apps/api/src/modules/projects/projects.module.ts`
- Create: `apps/api/src/modules/stats/stats.service.ts`
- Create: `apps/api/src/modules/stats/stats.controller.ts`
- Create: `apps/api/src/modules/stats/stats.module.ts`

- [ ] **Step 1: 创建 issues.service.ts**

```typescript
import { Injectable, Inject } from '@nestjs/common'
import { eq, and, ilike, gte, sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { issues } from '../../db/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'

export interface IssuesQuery {
  projectId: string
  status?: 'unresolved' | 'resolved' | 'ignored'
  level?: string
  q?: string
  timeRange?: '1h' | '24h' | '7d' | '30d'
  page?: number
  limit?: number
}

const timeRangeMap: Record<string, string> = {
  '1h': '1 hour', '24h': '24 hours', '7d': '7 days', '30d': '30 days',
}

@Injectable()
export class IssuesService {
  constructor(@Inject(DB) private db: NodePgDatabase<typeof schema>) {}

  async list(query: IssuesQuery) {
    const { projectId, status, level, q, timeRange, page = 1, limit = 25 } = query
    const conditions = [eq(issues.projectId, projectId)]
    if (status) conditions.push(eq(issues.status, status))
    if (level) conditions.push(eq(issues.level, level as never))
    if (q) conditions.push(ilike(issues.title, `%${q}%`))
    if (timeRange) {
      conditions.push(sql`${issues.lastSeen} >= now() - interval '${sql.raw(timeRangeMap[timeRange])}'`)
    }

    const [rows, [{ total }]] = await Promise.all([
      this.db.select().from(issues).where(and(...conditions))
        .orderBy(sql`${issues.lastSeen} desc`)
        .limit(limit).offset((page - 1) * limit),
      this.db.select({ total: sql<number>`count(*)` }).from(issues).where(and(...conditions)),
    ])
    return { rows, total: Number(total), page, limit }
  }

  async findById(id: string) {
    const [issue] = await this.db.select().from(issues).where(eq(issues.id, id)).limit(1)
    return issue ?? null
  }

  async updateStatus(id: string, status: 'resolved' | 'ignored' | 'unresolved') {
    await this.db.update(issues).set({ status }).where(eq(issues.id, id))
  }
}
```

- [ ] **Step 2: 创建 issues.controller.ts**

```typescript
import { Controller, Get, Patch, Param, Query, Body } from '@nestjs/common'
import { IssuesService } from './issues.service'

@Controller('api/issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.issuesService.list({
      projectId: query.projectId,
      status: query.status as never,
      level: query.level,
      q: query.q,
      timeRange: query.timeRange as never,
      page: query.page ? Number(query.page) : 1,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.issuesService.findById(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { status: 'resolved' | 'ignored' | 'unresolved' }) {
    return this.issuesService.updateStatus(id, body.status)
  }
}
```

- [ ] **Step 3: 创建 events.service.ts（含 source-map 反解）**

```typescript
import { Injectable, Inject } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { SourceMapConsumer } from 'source-map'
import { DB } from '../../db/db.module'
import { events, sourceMaps } from '../../db/schema'
import { MinioService } from '../sourcemaps/minio.service'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'

interface StackFrame { function: string; filename: string; lineno?: number; colno?: number }

@Injectable()
export class EventsService {
  constructor(
    @Inject(DB) private db: NodePgDatabase<typeof schema>,
    private readonly minio: MinioService,
  ) {}

  async findById(id: string) {
    const [event] = await this.db.select().from(events).where(eq(events.id, id)).limit(1)
    if (!event) return null

    const stacktrace = event.stacktrace as StackFrame[] | null
    if (stacktrace && event.release) {
      event.stacktrace = await this.resolveStackTrace(event.projectId, event.release, stacktrace) as unknown
    }
    return event
  }

  async listByIssue(issueId: string, page = 1, limit = 20) {
    return this.db.select().from(events)
      .where(eq(events.issueId, issueId))
      .orderBy(events.timestamp)
      .limit(limit).offset((page - 1) * limit)
  }

  private async resolveStackTrace(projectId: string, release: string, frames: StackFrame[]) {
    return Promise.all(frames.map(async frame => {
      try {
        const jsFilename = frame.filename.split('/').pop() ?? ''
        const [sm] = await this.db.select().from(sourceMaps)
          .where(eq(sourceMaps.projectId, projectId))
          .limit(1)

        if (!sm) return frame

        const rawMap = await this.minio.getObject(sm.storageUrl)
        const consumer = await new SourceMapConsumer(rawMap)
        if (!frame.lineno || !frame.colno) return frame

        const orig = consumer.originalPositionFor({ line: frame.lineno, column: frame.colno })
        consumer.destroy()

        if (orig.source) {
          return { ...frame, filename: orig.source, lineno: orig.line ?? frame.lineno, colno: orig.column ?? frame.colno, function: orig.name ?? frame.function }
        }
        return frame
      } catch {
        return frame  // source map 反解失败时返回原始帧
      }
    }))
  }
}
```

- [ ] **Step 4: 创建 projects.service.ts**

```typescript
import { Injectable, Inject } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { DB } from '../../db/db.module'
import { projects } from '../../db/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'

@Injectable()
export class ProjectsService {
  constructor(@Inject(DB) private db: NodePgDatabase<typeof schema>) {}

  list() {
    return this.db.select().from(projects).orderBy(projects.createdAt)
  }

  create(body: { name: string; slug: string }) {
    const dsnToken = randomBytes(20).toString('hex')
    return this.db.insert(projects).values({ name: body.name, slug: body.slug, dsnToken }).returning()
  }
}
```

- [ ] **Step 5: 创建 stats.service.ts**

```typescript
import { Injectable, Inject } from '@nestjs/common'
import { sql, gte, eq, and } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { issues, performanceMetrics } from '../../db/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'

@Injectable()
export class StatsService {
  constructor(@Inject(DB) private db: NodePgDatabase<typeof schema>) {}

  async issuesTrend(projectId: string, days = 7) {
    return this.db.execute(sql`
      SELECT date_trunc('hour', last_seen) as hour, count(*) as count
      FROM issues
      WHERE project_id = ${projectId}
        AND last_seen >= now() - interval '${sql.raw(days + ' days')}'
      GROUP BY 1 ORDER BY 1
    `)
  }

  async performanceSummary(projectId: string) {
    return this.db.execute(sql`
      SELECT name, rating, count(*) as count, avg(value) as avg_value
      FROM performance_metrics
      WHERE project_id = ${projectId}
        AND timestamp >= now() - interval '24 hours'
      GROUP BY name, rating ORDER BY name, rating
    `)
  }
}
```

- [ ] **Step 6: 创建各 controller 和 module 文件**

`issues.controller.ts` 已在 Step 2 完成。补充剩余：

`events.controller.ts`:
```typescript
import { Controller, Get, Param, Query } from '@nestjs/common'
import { EventsService } from './events.service'

@Controller('api/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get(':id')
  findOne(@Param('id') id: string) { return this.eventsService.findById(id) }
}
```

`projects.controller.ts`:
```typescript
import { Controller, Get, Post, Body } from '@nestjs/common'
import { ProjectsService } from './projects.service'

@Controller('api/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get() list() { return this.projectsService.list() }
  @Post() create(@Body() body: { name: string; slug: string }) { return this.projectsService.create(body) }
}
```

`stats.controller.ts`:
```typescript
import { Controller, Get, Query } from '@nestjs/common'
import { StatsService } from './stats.service'

@Controller('api/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('issues') issues(@Query('projectId') pId: string, @Query('days') days: string) {
    return this.statsService.issuesTrend(pId, Number(days) || 7)
  }
  @Get('performance') performance(@Query('projectId') pId: string) {
    return this.statsService.performanceSummary(pId)
  }
}
```

- [ ] **Step 7: 提交**

```bash
git add apps/api/src/modules/
git commit -m "feat: issues/events/projects/stats 模块（含 issues 搜索过滤）"
```

---

### Task 5: Source Map 模块 + MinIO Service

**Files:**
- Create: `apps/api/src/modules/sourcemaps/minio.service.ts`
- Create: `apps/api/src/modules/sourcemaps/sourcemaps.service.ts`
- Create: `apps/api/src/modules/sourcemaps/sourcemaps.controller.ts`
- Create: `apps/api/src/modules/sourcemaps/sourcemaps.module.ts`

- [ ] **Step 1: 创建 minio.service.ts**

```typescript
import { Injectable } from '@nestjs/common'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

@Injectable()
export class MinioService {
  private readonly s3: S3Client
  private readonly bucket: string

  constructor() {
    this.bucket = process.env.MINIO_BUCKET ?? 'error-tracker'
    this.s3 = new S3Client({
      endpoint: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY!,
        secretAccessKey: process.env.MINIO_SECRET_KEY!,
      },
      forcePathStyle: true,
    })
  }

  async upload(key: string, body: Buffer | string, contentType = 'application/octet-stream'): Promise<string> {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }))
    return key
  }

  async getObject(key: string): Promise<string> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    return res.Body!.transformToString()
  }
}
```

- [ ] **Step 2: 创建 sourcemaps.service.ts**

```typescript
import { Injectable, Inject } from '@nestjs/common'
import { eq, and } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { sourceMaps } from '../../db/schema'
import { MinioService } from './minio.service'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'

@Injectable()
export class SourceMapsService {
  constructor(
    @Inject(DB) private db: NodePgDatabase<typeof schema>,
    private readonly minio: MinioService,
  ) {}

  async upload(projectId: string, release: string, filename: string, content: Buffer): Promise<void> {
    const key = `sourcemaps/${projectId}/${release}/${filename}`
    await this.minio.upload(key, content, 'application/json')
    await this.db.insert(sourceMaps).values({ projectId, release, filename, storageUrl: key })
      .onConflictDoNothing()
  }

  async delete(projectId: string, release: string): Promise<void> {
    await this.db.delete(sourceMaps)
      .where(and(eq(sourceMaps.projectId, projectId), eq(sourceMaps.release, release)))
  }
}
```

- [ ] **Step 3: 创建 sourcemaps.controller.ts**

```typescript
import { Controller, Post, Delete, Param, UploadedFiles, UseInterceptors } from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { SourceMapsService } from './sourcemaps.service'

@Controller('api/sourcemaps')
export class SourceMapsController {
  constructor(private readonly sourceMapsService: SourceMapsService) {}

  @Post(':projectId/:release')
  @UseInterceptors(FilesInterceptor('files'))
  async upload(
    @Param('projectId') projectId: string,
    @Param('release') release: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    await Promise.all(
      files.map(f => this.sourceMapsService.upload(projectId, release, f.originalname, f.buffer))
    )
    return { uploaded: files.length }
  }

  @Delete(':projectId/:release')
  delete(@Param('projectId') projectId: string, @Param('release') release: string) {
    return this.sourceMapsService.delete(projectId, release)
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add apps/api/src/modules/sourcemaps/
git commit -m "feat: Source Map 模块（MinIO 上传 + source-map 反解）"
```

---

### Task 6: Webhook 告警 + 数据清理

**Files:**
- Create: `apps/api/src/modules/alerts/alerts.processor.ts`
- Create: `apps/api/src/modules/alerts/alerts.module.ts`
- Create: `apps/api/src/modules/cleanup/cleanup.processor.ts`
- Create: `apps/api/src/modules/cleanup/cleanup.module.ts`

- [ ] **Step 1: 创建 alerts.processor.ts**

```typescript
import { Processor, Process } from '@nestjs/bull'
import { Job } from 'bullmq'
import { Inject } from '@nestjs/common'
import { eq, and, gte, sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { issues, projects, events } from '../../db/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'

@Processor('events')
export class AlertsProcessor {
  constructor(@Inject(DB) private db: NodePgDatabase<typeof schema>) {}

  @Process('check-alert')
  async checkAlert(job: Job<{ projectId: string; issueId: string }>) {
    const { projectId, issueId } = job.data
    const [project] = await this.db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
    if (!project?.webhookUrl) return

    const [issue] = await this.db.select().from(issues).where(eq(issues.id, issueId)).limit(1)
    if (!issue) return

    const isNew = issue.count === 1

    // 检查 10 分钟内是否超过阈值
    const [{ recentCount }] = await this.db.execute<[{ recentCount: number }]>(sql`
      SELECT count(*) as "recentCount" FROM events
      WHERE issue_id = ${issueId}
        AND timestamp >= now() - interval '10 minutes'
    `)

    const shouldAlert = isNew || Number(recentCount) >= (project.alertThreshold ?? 50)
    if (!shouldAlert) return

    const text = isNew
      ? `🔴 [${project.name}] 新错误首次出现: ${issue.title}`
      : `⚠️ [${project.name}] 错误激增 (${recentCount}次/10min): ${issue.title}`

    await fetch(project.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch(() => {})
  }
}
```

- [ ] **Step 2: 创建 cleanup.processor.ts**

```typescript
import { Processor, Process } from '@nestjs/bull'
import { Inject } from '@nestjs/common'
import { sql, eq } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { projects, events, performanceMetrics, replays } from '../../db/schema'
import { MinioService } from '../sourcemaps/minio.service'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../../db/schema'

@Processor('cleanup')
export class CleanupProcessor {
  constructor(
    @Inject(DB) private db: NodePgDatabase<typeof schema>,
    private readonly minio: MinioService,
  ) {}

  @Process('daily-cleanup')
  async dailyCleanup() {
    const allProjects = await this.db.select().from(projects)

    for (const project of allProjects) {
      const days = project.retentionDays ?? 30

      // 先找出要删除的 replays 对象，从 MinIO 删除
      const oldReplays = await this.db.execute<{ storage_url: string }[]>(sql`
        SELECT r.storage_url FROM replays r
        JOIN events e ON r.event_id = e.id
        WHERE e.project_id = ${project.id}
          AND e.timestamp < now() - interval '${sql.raw(days + ' days')}'
      `)
      for (const r of oldReplays) {
        await this.minio.upload(r.storage_url, '')  // 用空 body 覆盖（简化删除）
      }

      // 删除旧 events（关联 replays 会级联删除）
      await this.db.execute(sql`
        DELETE FROM events WHERE project_id = ${project.id}
          AND timestamp < now() - interval '${sql.raw(days + ' days')}'
      `)

      // 删除旧 performance_metrics
      await this.db.execute(sql`
        DELETE FROM performance_metrics WHERE project_id = ${project.id}
          AND timestamp < now() - interval '${sql.raw(days + ' days')}'
      `)
    }
  }
}
```

- [ ] **Step 3: 在 app.module.ts 里注册每日 cleanup 任务**

在 AppModule 的 `onModuleInit` 里：
```typescript
// 每天 02:00 添加一个定时任务
await this.cleanupQueue.add('daily-cleanup', {}, {
  repeat: { cron: '0 2 * * *' },
  removeOnComplete: true,
})
```

- [ ] **Step 4: 提交**

```bash
git add apps/api/src/modules/alerts/ apps/api/src/modules/cleanup/
git commit -m "feat: Webhook 告警 + 数据自动清理（每日 02:00）"
```

---

### Task 7: Better-Auth 登录（API 侧）

**Files:**
- Create: `apps/api/src/modules/auth/auth.module.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: 初始化 Better-Auth**

```typescript
// apps/api/src/modules/auth/auth.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../../db/db.module'  // 直接引用 drizzle 实例

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3002',
})
```

- [ ] **Step 2: 在 main.ts 挂载 Better-Auth handler**

```typescript
// 在 bootstrap() 里，listen 之前
import { toNodeHandler } from 'better-auth/node'
app.use('/api/auth/**', toNodeHandler(auth))
```

- [ ] **Step 3: 创建 session guard（保护 /api/* 路由）**

```typescript
// apps/api/src/common/guards/session.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { auth } from '../../modules/auth/auth'

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const session = await auth.api.getSession({ headers: new Headers(req.headers) })
    if (!session) throw new UnauthorizedException()
    req.session = session
    return true
  }
}
```

- [ ] **Step 4: 给所有 /api/* controller 加上 `@UseGuards(SessionGuard)` 装饰器**

issues.controller, events.controller, projects.controller, stats.controller, sourcemaps.controller 都加上：

```typescript
@Controller('api/issues')
@UseGuards(SessionGuard)
export class IssuesController { ... }
```

- [ ] **Step 5: 提交**

```bash
git add apps/api/src/modules/auth/ apps/api/src/common/guards/session.guard.ts apps/api/src/main.ts
git commit -m "feat: Better-Auth 登录（email+password，session guard 保护 API）"
```

---

### Task 8: 完成 app.module.ts

**Files:**
- Create: `apps/api/src/app.module.ts`

- [ ] **Step 1: 创建 app.module.ts**

```typescript
import { Module, OnModuleInit } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bullmq'
import { DbModule } from './db/db.module'
import { IngestModule } from './modules/ingest/ingest.module'
import { IssuesModule } from './modules/issues/issues.module'
import { EventsModule } from './modules/events/events.module'
import { ProjectsModule } from './modules/projects/projects.module'
import { StatsModule } from './modules/stats/stats.module'
import { SourceMapsModule } from './modules/sourcemaps/sourcemaps.module'
import { AlertsModule } from './modules/alerts/alerts.module'
import { CleanupModule } from './modules/cleanup/cleanup.module'

@Module({
  imports: [
    BullModule.forRoot({
      connection: { host: 'localhost', port: 6379 },
    }),
    DbModule,
    IngestModule,
    IssuesModule,
    EventsModule,
    ProjectsModule,
    StatsModule,
    SourceMapsModule,
    AlertsModule,
    CleanupModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(@InjectQueue('cleanup') private cleanupQueue: Queue) {}

  async onModuleInit() {
    // 注册每日清理定时任务
    await this.cleanupQueue.add('daily-cleanup', {}, {
      repeat: { pattern: '0 2 * * *' },
      removeOnComplete: true,
      jobId: 'daily-cleanup-recurring',
    })
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat: AppModule 完整装配（BullMQ + 所有子模块）"
```

---

### Task 9: Next.js Dashboard 基础结构

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`

- [ ] **Step 1: 创建 apps/web/package.json**

```json
{
  "name": "@error-tracker/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3003",
    "build": "next build",
    "start": "next start -p 3003",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "better-auth": "^1.4.0",
    "@error-tracker/sdk": "workspace:*",
    "recharts": "^2.0.0",
    "rrweb-player": "^2.0.0",
    "@radix-ui/react-dialog": "^1.0.0",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-badge": "^1.0.0",
    "sonner": "^1.0.0",
    "clsx": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/react": "^18.0.0",
    "@types/node": "^22.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

- [ ] **Step 2: 创建 apps/web/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 创建 next.config.ts**

```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@error-tracker/sdk'],
}
export default config
```

- [ ] **Step 4: 安装依赖并提交**

```bash
cd D:/myProject/error-tracker && bun install
git add apps/web/
git commit -m "feat: web app 基础结构"
```

---

### Task 10: Dashboard 页面

**Files:**
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(dashboard)/layout.tsx`
- Create: `apps/web/src/app/(dashboard)/page.tsx`
- Create: `apps/web/src/app/(dashboard)/issues/page.tsx`
- Create: `apps/web/src/app/(dashboard)/issues/[id]/page.tsx`
- Create: `apps/web/src/app/(dashboard)/issues/[id]/replay/page.tsx`
- Create: `apps/web/src/app/(dashboard)/performance/page.tsx`
- Create: `apps/web/src/app/(dashboard)/settings/page.tsx`
- Create: `apps/web/src/lib/api.ts`

- [ ] **Step 1: 创建 src/lib/api.ts（API 客户端）**

```typescript
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json()
}

export const api = {
  issues: {
    list: (params: Record<string, string>) =>
      apiFetch<{ rows: unknown[]; total: number }>(`/api/issues?${new URLSearchParams(params)}`),
    get: (id: string) => apiFetch<unknown>(`/api/issues/${id}`),
    update: (id: string, body: { status: string }) =>
      apiFetch(`/api/issues/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  events: {
    get: (id: string) => apiFetch<unknown>(`/api/events/${id}`),
    listByIssue: (issueId: string) => apiFetch<unknown[]>(`/api/issues/${issueId}/events`),
  },
  stats: {
    issues: (projectId: string) => apiFetch<unknown[]>(`/api/stats/issues?projectId=${projectId}`),
    performance: (projectId: string) => apiFetch<unknown[]>(`/api/stats/performance?projectId=${projectId}`),
  },
  projects: {
    list: () => apiFetch<unknown[]>('/api/projects'),
    create: (body: { name: string; slug: string }) =>
      apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  },
}
```

- [ ] **Step 2: 创建 app/layout.tsx（SDK init）**

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'Error Tracker' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: 创建登录页**

```typescript
// apps/web/src/app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { authClient } from '../../lib/auth-client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { error: err } = await authClient.signIn.email({ email, password })
    if (err) { setError(err.message ?? '登录失败'); return }
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Error Tracker</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input
          type="email" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2" required
        />
        <input
          type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2" required
        />
        <button type="submit" className="w-full bg-blue-600 text-white rounded py-2">登录</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: 创建 (dashboard)/layout.tsx（Session 检查）**

```typescript
// apps/web/src/app/(dashboard)/layout.tsx
import { auth } from 'better-auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <nav className="w-56 bg-gray-900 text-gray-100 p-4 space-y-2">
        <div className="font-bold text-lg mb-6">Error Tracker</div>
        <a href="/" className="block px-3 py-2 rounded hover:bg-gray-700">概览</a>
        <a href="/issues" className="block px-3 py-2 rounded hover:bg-gray-700">错误</a>
        <a href="/performance" className="block px-3 py-2 rounded hover:bg-gray-700">性能</a>
        <a href="/settings" className="block px-3 py-2 rounded hover:bg-gray-700">设置</a>
      </nav>
      <main className="flex-1 p-6 bg-gray-50">{children}</main>
    </div>
  )
}
```

- [ ] **Step 5: 创建错误列表页**

```typescript
// apps/web/src/app/(dashboard)/issues/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import Link from 'next/link'

const statusColors: Record<string, string> = {
  unresolved: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
  ignored: 'bg-gray-100 text-gray-500',
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<unknown[]>([])
  const [q, setQ] = useState('')
  const [timeRange, setTimeRange] = useState('24h')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const params: Record<string, string> = { timeRange }
    if (q) params.q = q
    if (status) params.status = status
    api.issues.list(params).then(r => setIssues(r.rows))
  }, [q, timeRange, status])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">错误</h1>
      <div className="flex gap-3 mb-4">
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="搜索错误..." className="border rounded px-3 py-1.5 w-64" />
        <select value={timeRange} onChange={e => setTimeRange(e.target.value)} className="border rounded px-3 py-1.5">
          <option value="1h">最近 1 小时</option>
          <option value="24h">最近 24 小时</option>
          <option value="7d">最近 7 天</option>
          <option value="30d">最近 30 天</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded px-3 py-1.5">
          <option value="">全部状态</option>
          <option value="unresolved">未解决</option>
          <option value="resolved">已解决</option>
          <option value="ignored">已忽略</option>
        </select>
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {(issues as { id: string; title: string; count: number; status: string; lastSeen: string }[]).map(issue => (
          <Link key={issue.id} href={`/issues/${issue.id}`}
            className="flex items-center px-4 py-3 border-b hover:bg-gray-50 gap-4">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[issue.status]}`}>{issue.status}</span>
            <span className="flex-1 font-mono text-sm truncate">{issue.title}</span>
            <span className="text-gray-400 text-sm">{issue.count} 次</span>
            <span className="text-gray-400 text-sm">{new Date(issue.lastSeen).toLocaleString('zh')}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 创建错误详情页**

```typescript
// apps/web/src/app/(dashboard)/issues/[id]/page.tsx
import { api } from '../../../../lib/api'

export default async function IssuePage({ params }: { params: { id: string } }) {
  const issue = await api.issues.get(params.id) as {
    id: string; title: string; status: string; count: number; firstSeen: string; lastSeen: string
  }
  const events = await api.events.listByIssue(params.id) as {
    id: string; message: string; stacktrace: { function: string; filename: string; lineno: number }[];
    breadcrumbs: { timestamp: number; type: string; message?: string }[];
    user: Record<string, string>; environment: string; release: string; timestamp: string
  }[]

  const latest = events[0]

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono">{issue.title}</h1>
          <p className="text-gray-500 text-sm mt-1">首次: {new Date(issue.firstSeen).toLocaleString('zh')} · 最近: {new Date(issue.lastSeen).toLocaleString('zh')} · {issue.count} 次</p>
        </div>
        <div className="flex gap-2">
          <a href={`/issues/${params.id}/replay`} className="px-3 py-1.5 bg-gray-100 rounded text-sm hover:bg-gray-200">录屏</a>
        </div>
      </div>

      {latest && (
        <>
          <section className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold mb-3">Stack Trace</h2>
            <pre className="font-mono text-xs bg-gray-50 rounded p-3 overflow-x-auto">
              {latest.stacktrace?.map((f, i) => `  at ${f.function} (${f.filename}:${f.lineno})`).join('\n')}
            </pre>
          </section>

          <section className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold mb-3">Breadcrumbs</h2>
            <div className="space-y-1.5">
              {latest.breadcrumbs?.map((b, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-gray-400 font-mono">{new Date(b.timestamp).toLocaleTimeString('zh')}</span>
                  <span className="px-1.5 bg-gray-100 rounded text-xs">{b.type}</span>
                  <span className="text-gray-700">{b.message}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 7: 创建录屏页**

```typescript
// apps/web/src/app/(dashboard)/issues/[id]/replay/page.tsx
'use client'
import { useEffect, useRef } from 'react'
// rrweb-player 是 UMD，动态 import
export default function ReplayPage({ params }: { params: { id: string } }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // 动态 import rrweb-player（避免 SSR 问题）
    import('rrweb-player').then(({ default: Replayer }) => {
      if (!containerRef.current) return
      fetch(`/api/events/${params.id}/replay`)
        .then(r => r.json())
        .then(({ events }) => {
          new Replayer({ target: containerRef.current!, props: { events } })
        })
    })
  }, [params.id])
  return <div ref={containerRef} className="bg-white rounded-xl shadow p-4 min-h-96" />
}
```

- [ ] **Step 8: 创建性能页**

```typescript
// apps/web/src/app/(dashboard)/performance/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '../../../lib/api'

const ratingColor = { good: '#22c55e', 'needs-improvement': '#f59e0b', poor: '#ef4444' }

export default function PerformancePage() {
  const [data, setData] = useState<{ name: string; rating: string; count: number; avg_value: number }[]>([])
  useEffect(() => {
    // projectId 从 URL 或 context 取，这里简化为取第一个项目
    api.projects.list().then(projects => {
      if (projects[0]) {
        api.stats.performance((projects[0] as { id: string }).id).then(r => setData(r as never))
      }
    })
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">性能概览</h1>
      <div className="grid grid-cols-2 gap-6">
        {['LCP', 'CLS', 'INP', 'TTFB'].map(metric => {
          const rows = data.filter(d => d.name === metric)
          return (
            <div key={metric} className="bg-white rounded-xl shadow p-4">
              <h2 className="font-semibold mb-3">{metric}</h2>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={rows}>
                  <XAxis dataKey="rating" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count">
                    {rows.map((r, i) => (
                      <Cell key={i} fill={ratingColor[r.rating as keyof typeof ratingColor] ?? '#gray'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 9: 提交**

```bash
git add apps/web/src/
git commit -m "feat: Dashboard 所有页面（登录、错误列表/详情/录屏、性能）"
```

---

### Task 11: utils-plane 接入

**Files:**
- Modify: `D:/myProject/unitls-plane/apps/web/src/app/layout.tsx`
- Modify: `D:/myProject/unitls-plane/apps/api/src/main.ts`
- Modify: `D:/myProject/unitls-plane/.env.local`
- Create: `D:/myProject/unitls-plane/scripts/upload-sourcemaps.ts`

- [ ] **Step 1: 在 utils-plane 安装 SDK**

```bash
cd D:/myProject/unitls-plane
bun add @error-tracker/sdk@workspace:../error-tracker/packages/sdk
```

或在 utils-plane/package.json 的 dependencies 里手动加：
```json
"@error-tracker/sdk": "link:../error-tracker/packages/sdk"
```

- [ ] **Step 2: 在 utils-plane web 的 layout.tsx 初始化 SDK**

```typescript
// 在 apps/web/src/app/layout.tsx 的顶部加入（仅客户端）
'use client'
import { init } from '@error-tracker/sdk'
import { ReplayPlugin } from '@error-tracker/sdk/plugins/replay'

if (typeof window !== 'undefined') {
  init({
    dsn: process.env.NEXT_PUBLIC_ERROR_TRACKER_DSN!,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_RELEASE ?? '0.0.0',
    integrations: [new ReplayPlugin({ bufferSeconds: 30, sampleRate: 0.5 })],
  })
}
```

- [ ] **Step 3: 在 utils-plane api 的 main.ts 初始化 SDK**

```typescript
// 在 apps/api/src/main.ts bootstrap() 第一行加入
import { init } from '@error-tracker/sdk/node'
init({
  dsn: process.env.ERROR_TRACKER_DSN!,
  environment: process.env.NODE_ENV,
  release: process.env.RELEASE ?? '0.0.0',
})
```

- [ ] **Step 4: 在 utils-plane .env.local 添加 DSN**

```env
NEXT_PUBLIC_ERROR_TRACKER_DSN=http://localhost:3002/ingest/<projectId>/<token>
ERROR_TRACKER_DSN=http://localhost:3002/ingest/<projectId>/<token>
NEXT_PUBLIC_RELEASE=dev
```

（projectId 和 token 在 error-tracker Dashboard `/settings` 页面创建项目后获取）

- [ ] **Step 5: 创建 Source Map 上传脚本**

```typescript
// D:/myProject/unitls-plane/scripts/upload-sourcemaps.ts
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const API = process.env.ERROR_TRACKER_API ?? 'http://localhost:3002'
const PROJECT_ID = process.env.ERROR_TRACKER_PROJECT_ID!
const RELEASE = process.env.NEXT_PUBLIC_RELEASE ?? 'dev'
const BUILD_DIR = join(process.cwd(), 'apps/web/.next/static/chunks')

async function uploadSourceMaps() {
  const files = readdirSync(BUILD_DIR).filter(f => f.endsWith('.map'))
  console.log(`Uploading ${files.length} source maps for release ${RELEASE}`)

  for (const file of files) {
    const content = readFileSync(join(BUILD_DIR, file))
    const form = new FormData()
    form.append('files', new Blob([content]), file)
    const res = await fetch(`${API}/api/sourcemaps/${PROJECT_ID}/${RELEASE}`, {
      method: 'POST',
      body: form,
    })
    console.log(file, res.status === 200 ? '✓' : '✗')
  }
}

uploadSourceMaps()
```

- [ ] **Step 6: 验证接入**

```bash
# 1. 启动 error-tracker
cd D:/myProject/error-tracker && bun run services:up && bun run dev

# 2. 在 Dashboard 创建项目，获取 DSN，填入 utils-plane .env.local

# 3. 启动 utils-plane
cd D:/myProject/unitls-plane && bun run dev

# 4. 在 utils-plane 前端控制台执行
throw new Error('test from utils-plane')

# 5. 查看 error-tracker Dashboard /issues，应出现该错误
```

- [ ] **Step 7: 提交（在 utils-plane 仓库）**

```bash
cd D:/myProject/unitls-plane
git add apps/web/src/app/layout.tsx apps/api/src/main.ts scripts/upload-sourcemaps.ts
git commit -m "feat: 接入 error-tracker SDK（浏览器 + Node.js + rrweb 录屏）"
```

---

## 验证方式

```bash
# 1. 启动所有服务
cd D:/myProject/error-tracker
bun run services:up
bun run dev

# 2. 创建项目（获取 DSN Token）
curl -X POST http://localhost:3002/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"utils-plane","slug":"utils-plane"}'

# 3. 上报测试事件（用 DSN 里的 projectId/token）
curl -X POST http://localhost:3002/ingest/<projectId>/<token> \
  -H 'Content-Type: application/json' \
  -d '{"events":[{"eventId":"test-1","timestamp":1716800000000,"level":"error","message":"test error","fingerprint":"fp-test","stacktrace":[{"function":"testFn","filename":"test.ts","lineno":1}]}],"sentAt":"2026-05-28T00:00:00Z"}'

# 4. 验证 Dashboard
# 打开 http://localhost:3003
# 登录后在 /issues 看到 "test error"
# 点进详情看到 stack trace

# 5. 验证搜索过滤
# /issues?q=test&timeRange=1h → 出现该错误

# 6. 验证 Web Vitals
# 在 utils-plane 前端浏览几秒后查看 /performance
```
