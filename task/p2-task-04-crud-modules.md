# Task P2-04: Issues + Events + Projects + Stats 模块

**计划：** Plan 2  
**依赖：** Task P2-02  
**可并行：** 是（与 Task P2-03, P2-05, P2-06 并行）  
**预计时间：** 25 min

---

## 目标

实现四个 CRUD 模块：issues（含搜索过滤）、events（含 source-map 反解占位）、projects、stats。

## 需要创建的文件

- `apps/api/src/modules/issues/issues.service.ts`
- `apps/api/src/modules/issues/issues.controller.ts`
- `apps/api/src/modules/issues/issues.module.ts`
- `apps/api/src/modules/events/events.service.ts`
- `apps/api/src/modules/events/events.controller.ts`
- `apps/api/src/modules/events/events.module.ts`
- `apps/api/src/modules/projects/projects.service.ts`
- `apps/api/src/modules/projects/projects.controller.ts`
- `apps/api/src/modules/projects/projects.module.ts`
- `apps/api/src/modules/stats/stats.service.ts`
- `apps/api/src/modules/stats/stats.controller.ts`
- `apps/api/src/modules/stats/stats.module.ts`

## 步骤

- [x] **Step 1: 创建 issues.service.ts**

```typescript
// apps/api/src/modules/issues/issues.service.ts
import { Injectable, Inject } from '@nestjs/common'
import { eq, and, ilike, sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { issues } from '../../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
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
  constructor(@Inject(DB) private db: PostgresJsDatabase<typeof schema>) {}

  async list(query: IssuesQuery) {
    const { projectId, status, level, q, timeRange, page = 1, limit = 25 } = query
    const conditions = [eq(issues.projectId, projectId)]
    if (status) conditions.push(eq(issues.status, status))
    if (level) conditions.push(eq(issues.level, level as never))
    if (q) conditions.push(ilike(issues.title, `%${q}%`))
    if (timeRange) {
      conditions.push(sql`${issues.lastSeen} >= now() - interval '${sql.raw(timeRangeMap[timeRange])}'`)
    }

    const [rows, countResult] = await Promise.all([
      this.db.select().from(issues).where(and(...conditions))
        .orderBy(sql`${issues.lastSeen} desc`)
        .limit(limit).offset((page - 1) * limit),
      this.db.select({ total: sql<number>`count(*)` }).from(issues).where(and(...conditions)),
    ])
    return { rows, total: Number(countResult[0]?.total ?? 0), page, limit }
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

- [x] **Step 2: 创建 issues.controller.ts**

```typescript
// apps/api/src/modules/issues/issues.controller.ts
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

- [x] **Step 3: 创建 issues.module.ts**

```typescript
// apps/api/src/modules/issues/issues.module.ts
import { Module } from '@nestjs/common'
import { IssuesController } from './issues.controller'
import { IssuesService } from './issues.service'

@Module({
  controllers: [IssuesController],
  providers: [IssuesService],
})
export class IssuesModule {}
```

- [x] **Step 4: 创建 events.service.ts**

```typescript
// apps/api/src/modules/events/events.service.ts
import { Injectable, Inject } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { events } from '../../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

@Injectable()
export class EventsService {
  constructor(@Inject(DB) private db: PostgresJsDatabase<typeof schema>) {}

  async findById(id: string) {
    const [event] = await this.db.select().from(events).where(eq(events.id, id)).limit(1)
    return event ?? null
    // source-map 反解在 Task P2-05 完成后集成
  }

  async listByIssue(issueId: string, page = 1, limit = 20) {
    return this.db.select().from(events)
      .where(eq(events.issueId, issueId))
      .orderBy(events.timestamp)
      .limit(limit).offset((page - 1) * limit)
  }
}
```

- [x] **Step 5: 创建 events.controller.ts + events.module.ts**

```typescript
// apps/api/src/modules/events/events.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common'
import { EventsService } from './events.service'

@Controller('api/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get(':id')
  findOne(@Param('id') id: string) { return this.eventsService.findById(id) }
}
```

```typescript
// apps/api/src/modules/events/events.module.ts
import { Module } from '@nestjs/common'
import { EventsController } from './events.controller'
import { EventsService } from './events.service'

@Module({
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
```

- [x] **Step 6: 创建 projects.service.ts + controller + module**

```typescript
// apps/api/src/modules/projects/projects.service.ts
import { Injectable, Inject } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { DB } from '../../db/db.module'
import { projects } from '../../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

@Injectable()
export class ProjectsService {
  constructor(@Inject(DB) private db: PostgresJsDatabase<typeof schema>) {}

  list() {
    return this.db.select().from(projects).orderBy(projects.createdAt)
  }

  create(body: { name: string; slug: string }) {
    const dsnToken = randomBytes(20).toString('hex')
    return this.db.insert(projects).values({ name: body.name, slug: body.slug, dsnToken }).returning()
  }
}
```

```typescript
// apps/api/src/modules/projects/projects.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common'
import { ProjectsService } from './projects.service'

@Controller('api/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get() list() { return this.projectsService.list() }
  @Post() create(@Body() body: { name: string; slug: string }) { return this.projectsService.create(body) }
}
```

```typescript
// apps/api/src/modules/projects/projects.module.ts
import { Module } from '@nestjs/common'
import { ProjectsController } from './projects.controller'
import { ProjectsService } from './projects.service'

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
```

- [x] **Step 7: 创建 stats.service.ts + controller + module**

```typescript
// apps/api/src/modules/stats/stats.service.ts
import { Injectable, Inject } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

@Injectable()
export class StatsService {
  constructor(@Inject(DB) private db: PostgresJsDatabase<typeof schema>) {}

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

```typescript
// apps/api/src/modules/stats/stats.controller.ts
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

```typescript
// apps/api/src/modules/stats/stats.module.ts
import { Module } from '@nestjs/common'
import { StatsController } from './stats.controller'
import { StatsService } from './stats.service'

@Module({
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
```

- [x] **Step 8: 提交**

```bash
cd D:/myProject/error-tracker
git add apps/api/src/modules/issues/ apps/api/src/modules/events/ \
  apps/api/src/modules/projects/ apps/api/src/modules/stats/
git commit -m "feat: issues/events/projects/stats 模块（含 issues 搜索过滤）"
```
