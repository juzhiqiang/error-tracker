# Task P2-08: 完成 app.module.ts

**计划：** Plan 2  
**依赖：** Task P2-07  
**可并行：** 否  
**预计时间：** 10 min

---

## 目标

创建 `AppModule`，装配所有子模块，注册 BullMQ，并在启动时注册每日清理定时任务。

## 需要创建的文件

- `apps/api/src/app.module.ts`

## 步骤

- [x] **Step 1: 创建 apps/api/src/app.module.ts**

```typescript
import { Module, OnModuleInit } from '@nestjs/common'
import { BullModule, InjectQueue } from '@nestjs/bull'
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
import { AuthModule } from './modules/auth/auth.module'

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
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
    AuthModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(@InjectQueue('cleanup') private cleanupQueue: Queue) {}

  async onModuleInit() {
    // 注册每日 02:00 清理定时任务（幂等：jobId 防止重复注册）
    await this.cleanupQueue.add('daily-cleanup', {}, {
      repeat: { pattern: '0 2 * * *' },
      removeOnComplete: true,
      jobId: 'daily-cleanup-recurring',
    })
  }
}
```

- [x] **Step 2: 在 .env.example 补充 Redis 配置**

在 `error-tracker/.env.example` 末尾追加：

```env
REDIS_HOST=localhost
REDIS_PORT=6379
CORS_ORIGIN=http://localhost:3003
```

同时在 `docker-compose.yml` 添加 Redis 服务：

```yaml
  redis:
    image: redis:7-alpine
    container_name: error-tracker-redis
    ports:
      - "6379:6379"
```

- [x] **Step 3: 尝试编译验证**

```bash
cd D:/myProject/error-tracker/apps/api
bun run lint
```

Expected: 无 TypeScript 错误（或只有可接受的类型警告）

- [x] **Step 4: 提交**

```bash
cd D:/myProject/error-tracker
git add apps/api/src/app.module.ts .env.example docker-compose.yml
git commit -m "feat: AppModule 完整装配（BullMQ + 所有子模块 + Redis）"
```
