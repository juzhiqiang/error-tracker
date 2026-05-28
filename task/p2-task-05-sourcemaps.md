# Task P2-05: Source Map 模块 + MinIO Service

**计划：** Plan 2  
**依赖：** Task P2-02  
**可并行：** 是（与 Task P2-03, P2-04, P2-06 并行）  
**预计时间：** 15 min

---

## 目标

实现 MinIO 对象存储服务和 Source Map 上传/查询模块。完成后需要回到 `events.service.ts` 集成 source-map 反解。

## 需要创建的文件

- `apps/api/src/modules/sourcemaps/minio.service.ts`
- `apps/api/src/modules/sourcemaps/sourcemaps.service.ts`
- `apps/api/src/modules/sourcemaps/sourcemaps.controller.ts`
- `apps/api/src/modules/sourcemaps/sourcemaps.module.ts`

## 步骤

- [ ] **Step 1: 创建 minio.service.ts**

```typescript
// apps/api/src/modules/sourcemaps/minio.service.ts
import { Injectable } from '@nestjs/common'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

@Injectable()
export class MinioService {
  private readonly s3: S3Client
  private readonly bucket: string

  constructor() {
    this.bucket = process.env.MINIO_BUCKET ?? 'error-tracker'
    this.s3 = new S3Client({
      endpoint: `http://${process.env.MINIO_ENDPOINT ?? 'localhost'}:${process.env.MINIO_PORT ?? '9001'}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY!,
        secretAccessKey: process.env.MINIO_SECRET_KEY!,
      },
      forcePathStyle: true,  // MinIO 必须设置，否则 bucket 路径不对
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
// apps/api/src/modules/sourcemaps/sourcemaps.service.ts
import { Injectable, Inject } from '@nestjs/common'
import { eq, and } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { sourceMaps } from '../../db/schema'
import { MinioService } from './minio.service'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

@Injectable()
export class SourceMapsService {
  constructor(
    @Inject(DB) private db: PostgresJsDatabase<typeof schema>,
    private readonly minio: MinioService,
  ) {}

  async upload(projectId: string, release: string, filename: string, content: Buffer): Promise<void> {
    const key = `sourcemaps/${projectId}/${release}/${filename}`
    await this.minio.upload(key, content, 'application/json')
    await this.db.insert(sourceMaps)
      .values({ projectId, release, filename, storageUrl: key })
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
// apps/api/src/modules/sourcemaps/sourcemaps.controller.ts
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

- [ ] **Step 4: 创建 sourcemaps.module.ts**

```typescript
// apps/api/src/modules/sourcemaps/sourcemaps.module.ts
import { Module } from '@nestjs/common'
import { SourceMapsController } from './sourcemaps.controller'
import { SourceMapsService } from './sourcemaps.service'
import { MinioService } from './minio.service'

@Module({
  controllers: [SourceMapsController],
  providers: [SourceMapsService, MinioService],
  exports: [MinioService, SourceMapsService],
})
export class SourceMapsModule {}
```

- [ ] **Step 5: 更新 events.service.ts 集成 source-map 反解**

在 `apps/api/src/modules/events/events.service.ts` 中，将 `findById` 方法更新为：

```typescript
// apps/api/src/modules/events/events.service.ts
import { Injectable, Inject } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { SourceMapConsumer } from 'source-map'
import { DB } from '../../db/db.module'
import { events, sourceMaps } from '../../db/schema'
import { MinioService } from '../sourcemaps/minio.service'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

interface StackFrame { function: string; filename: string; lineno?: number; colno?: number }

@Injectable()
export class EventsService {
  constructor(
    @Inject(DB) private db: PostgresJsDatabase<typeof schema>,
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

同时更新 `events.module.ts` 导入 `SourceMapsModule`：

```typescript
// apps/api/src/modules/events/events.module.ts
import { Module } from '@nestjs/common'
import { EventsController } from './events.controller'
import { EventsService } from './events.service'
import { SourceMapsModule } from '../sourcemaps/sourcemaps.module'

@Module({
  imports: [SourceMapsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
```

- [ ] **Step 6: 提交**

```bash
cd D:/myProject/error-tracker
git add apps/api/src/modules/sourcemaps/ apps/api/src/modules/events/
git commit -m "feat: Source Map 模块（MinIO 上传 + source-map 反解）"
```
