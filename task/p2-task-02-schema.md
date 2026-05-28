# Task P2-02: Drizzle Schema + Migration

**计划：** Plan 2  
**依赖：** Task P2-01  
**可并行：** 否  
**预计时间：** 15 min

---

## 目标

定义所有数据库表的 Drizzle schema，生成并执行 migration。

**前置条件：** Docker 服务必须已启动（`bun run services:up`）

## 需要创建的文件

- `apps/api/src/db/schema.ts`
- `apps/api/src/db/db.module.ts`
- `apps/api/drizzle.config.ts`

## 步骤

- [ ] **Step 1: 创建 apps/api/src/db/schema.ts**

```typescript
import { pgTable, text, integer, timestamp, jsonb, serial, uuid } from 'drizzle-orm/pg-core'

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

- [ ] **Step 4: 启动 Docker 并执行 migration**

```bash
cd D:/myProject/error-tracker
bun run services:up
```

等待 3 秒后：

```bash
cd apps/api
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

Expected: `drizzle/` 目录下出现 migration SQL 文件，migration 执行成功

- [ ] **Step 5: 提交**

```bash
cd D:/myProject/error-tracker
git add apps/api/src/db/ apps/api/drizzle.config.ts apps/api/drizzle/
git commit -m "feat: Drizzle schema + migration（projects/issues/events/replays/performance/sourcemaps）"
```
