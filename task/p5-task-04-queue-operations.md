# Task P5-04: Queue Failure Operations

**Plan:** Plan 5  
**Batch:** Formal production readiness  
**Goal:** Make BullMQ failed, delayed, waiting, and active jobs visible and actionable so background work does not fail silently.

## Acceptance Criteria

- API provides `GET /api/operations/queues?projectId=` for queue counts and failed job summaries.
- API provides `POST /api/operations/queues/:queueName/jobs/:jobId/retry?projectId=` to retry a failed job.
- API provides `DELETE /api/operations/queues/:queueName/jobs/:jobId?projectId=` to remove a failed job.
- Operations routes require session auth and project owner/admin access through `ProjectAccessGuard`.
- Web adds an Operations page with failed, delayed, waiting, and active counts plus retry/remove actions.

## Files

- Create: `apps/api/src/modules/operations/operations.module.ts`
- Create: `apps/api/src/modules/operations/queue-operations.service.ts`
- Create: `apps/api/src/modules/operations/queue-operations.controller.ts`
- Test: `apps/api/src/modules/operations/queue-operations.service.test.ts`
- Test: `apps/api/src/modules/operations/queue-operations.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/app/(dashboard)/operations/page.tsx`
- Modify: `apps/web/src/components/dashboard-shell.tsx`
- Modify: `apps/web/src/lib/i18n.tsx`

## Steps

- [x] **Step 1: Write the service tests**

Create `apps/api/src/modules/operations/queue-operations.service.test.ts`:

```typescript
import { describe, expect, it, mock } from 'bun:test'
import { QueueOperationsService } from './queue-operations.service'

describe('QueueOperationsService', () => {
  it('lists queue counts and failed jobs', async () => {
    const failedJob = { id: 'job-1', name: 'check-alert', failedReason: 'webhook failed', timestamp: 1 }
    const eventsQueue = {
      getJobCounts: mock(async () => ({ waiting: 0, active: 0, failed: 1, delayed: 0 })),
      getJobs: mock(async () => [failedJob]),
    }
    const cleanupQueue = {
      getJobCounts: mock(async () => ({ waiting: 0, active: 0, failed: 0, delayed: 0 })),
      getJobs: mock(async () => []),
    }

    const service = new QueueOperationsService(eventsQueue as never, cleanupQueue as never)
    const report = await service.list()

    expect(report.events.counts.failed).toBe(1)
    expect(report.events.failedJobs[0]).toEqual({
      id: 'job-1',
      name: 'check-alert',
      failedReason: 'webhook failed',
      timestamp: 1,
    })
  })

  it('retries and removes jobs by queue name', async () => {
    const job = { retry: mock(async () => undefined), remove: mock(async () => undefined) }
    const queue = { getJob: mock(async () => job) }
    const service = new QueueOperationsService(queue as never, queue as never)

    await service.retry('events', 'job-1')
    await service.remove('cleanup', 'job-1')

    expect(job.retry).toHaveBeenCalled()
    expect(job.remove).toHaveBeenCalled()
  })
})
```

- [x] **Step 2: Verify the service tests fail**

Run:

```bash
bun run --cwd apps/api test src/modules/operations/queue-operations.service.test.ts
```

Expected: FAIL because `QueueOperationsService` does not exist.

- [x] **Step 3: Implement QueueOperationsService**

Create `apps/api/src/modules/operations/queue-operations.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'

type QueueName = 'events' | 'cleanup'

@Injectable()
export class QueueOperationsService {
  constructor(
    @InjectQueue('events') private readonly eventsQueue: Queue,
    @InjectQueue('cleanup') private readonly cleanupQueue: Queue,
  ) {}

  async list() {
    const [events, cleanup] = await Promise.all([this.describe(this.eventsQueue), this.describe(this.cleanupQueue)])
    return { events, cleanup }
  }

  async retry(queueName: QueueName, jobId: string) {
    const job = await this.getJob(queueName, jobId)
    await job.retry()
    return { ok: true }
  }

  async remove(queueName: QueueName, jobId: string) {
    const job = await this.getJob(queueName, jobId)
    await job.remove()
    return { ok: true }
  }

  private async describe(queue: Queue) {
    const [counts, failedJobs] = await Promise.all([
      queue.getJobCounts('waiting', 'active', 'failed', 'delayed'),
      queue.getJobs(['failed'], 0, 20),
    ])
    return {
      counts,
      failedJobs: failedJobs.map((job) => ({
        id: String(job.id),
        name: job.name,
        failedReason: job.failedReason ?? null,
        timestamp: job.timestamp,
      })),
    }
  }

  private async getJob(queueName: QueueName, jobId: string) {
    const queue = queueName === 'events' ? this.eventsQueue : this.cleanupQueue
    const job = await queue.getJob(jobId)
    if (!job) throw new NotFoundException('Queue job not found')
    return job
  }
}
```

- [x] **Step 4: Write controller guard tests**

Create `apps/api/src/modules/operations/queue-operations.controller.test.ts`:

```typescript
import { describe, expect, it, mock } from 'bun:test'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { PROJECT_ROLES_KEY } from '../access/project-roles.decorator'

mock.module('../../common/guards/session.guard', () => ({
  SessionGuard: class SessionGuard {},
}))

mock.module('../access/project-access.guard', () => ({
  ProjectAccessGuard: class ProjectAccessGuard {},
}))

describe('QueueOperationsController', () => {
  it('uses session and project owner/admin guards', async () => {
    const { QueueOperationsController } = await import('./queue-operations.controller')
    const guards = Reflect.getMetadata(GUARDS_METADATA, QueueOperationsController) as Array<{ name: string }>
    const roles = Reflect.getMetadata(PROJECT_ROLES_KEY, QueueOperationsController)

    expect(guards.map((guard) => guard.name)).toEqual(['SessionGuard', 'ProjectAccessGuard'])
    expect(roles).toEqual(['owner', 'admin'])
  })

  it('passes queue actions to the service', async () => {
    const service = {
      list: mock(async () => ({ events: { counts: {}, failedJobs: [] }, cleanup: { counts: {}, failedJobs: [] } })),
      retry: mock(async () => ({ ok: true })),
      remove: mock(async () => ({ ok: true })),
    }
    const { QueueOperationsController } = await import('./queue-operations.controller')
    const controller = new QueueOperationsController(service as never)

    await controller.list('project-1')
    await controller.retry('project-1', 'events', 'job-1')
    await controller.remove('project-1', 'cleanup', 'job-2')

    expect(service.retry.mock.calls[0]).toEqual(['events', 'job-1'])
    expect(service.remove.mock.calls[0]).toEqual(['cleanup', 'job-2'])
  })
})
```

- [x] **Step 5: Implement controller and module**

Create `apps/api/src/modules/operations/queue-operations.controller.ts`:

```typescript
import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { SessionGuard } from '../../common/guards/session.guard'
import { ProjectAccessGuard } from '../access/project-access.guard'
import { ProjectRoles } from '../access/project-roles.decorator'
import { QueueOperationsService } from './queue-operations.service'

@Controller('api/operations/queues')
@UseGuards(SessionGuard, ProjectAccessGuard)
@ProjectRoles('owner', 'admin')
export class QueueOperationsController {
  constructor(private readonly service: QueueOperationsService) {}

  @Get()
  list(@Query('projectId') _projectId: string) {
    return this.service.list()
  }

  @Post(':queueName/jobs/:jobId/retry')
  retry(
    @Query('projectId') _projectId: string,
    @Param('queueName') queueName: 'events' | 'cleanup',
    @Param('jobId') jobId: string,
  ) {
    return this.service.retry(queueName, jobId)
  }

  @Delete(':queueName/jobs/:jobId')
  remove(
    @Query('projectId') _projectId: string,
    @Param('queueName') queueName: 'events' | 'cleanup',
    @Param('jobId') jobId: string,
  ) {
    return this.service.remove(queueName, jobId)
  }
}
```

Create `apps/api/src/modules/operations/operations.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AccessModule } from '../access/access.module'
import { QueueOperationsController } from './queue-operations.controller'
import { QueueOperationsService } from './queue-operations.service'

@Module({
  imports: [BullModule.registerQueue({ name: 'events' }, { name: 'cleanup' }), AccessModule],
  controllers: [QueueOperationsController],
  providers: [QueueOperationsService],
})
export class OperationsModule {}
```

Add `OperationsModule` to `apps/api/src/app.module.ts`.

- [x] **Step 6: Add Web API client methods**

In `apps/web/src/lib/api.ts`, add:

```typescript
export interface QueueFailedJob {
  id: string
  name: string
  failedReason?: string | null
  timestamp: number
}

export interface QueueOperationsReport {
  events: { counts: Record<string, number>; failedJobs: QueueFailedJob[] }
  cleanup: { counts: Record<string, number>; failedJobs: QueueFailedJob[] }
}
```

Add methods:

```typescript
operations: {
  queues: (projectId: string) => apiFetch<QueueOperationsReport>(`/api/operations/queues?projectId=${projectId}`),
  retryQueueJob: (projectId: string, queueName: 'events' | 'cleanup', jobId: string) =>
    apiFetch<{ ok: true }>(`/api/operations/queues/${queueName}/jobs/${jobId}/retry?projectId=${projectId}`, { method: 'POST' }),
  removeQueueJob: (projectId: string, queueName: 'events' | 'cleanup', jobId: string) =>
    apiFetch<{ ok: true }>(`/api/operations/queues/${queueName}/jobs/${jobId}?projectId=${projectId}`, { method: 'DELETE' }),
}
```

- [x] **Step 7: Add the Operations page**

Create `apps/web/src/app/(dashboard)/operations/page.tsx`. It must use the existing project list to choose a project, then call `api.operations.queues(selectedProject.id)`. Show:

- events queue counts
- cleanup queue counts
- failed job name
- failed reason
- retry button
- remove button

- [x] **Step 8: Add navigation and i18n**

Add an Operations nav item to `DashboardShell`, and add `nav.operations` plus Operations page copy to `apps/web/src/lib/i18n.tsx`.

- [x] **Step 9: Verify**

Run:

```bash
bun run --cwd apps/api test src/modules/operations/queue-operations.service.test.ts src/modules/operations/queue-operations.controller.test.ts
bun run --cwd apps/api lint
bun run --cwd apps/api build
bun run --cwd apps/web lint
bun run --cwd apps/web build
```

Expected: all commands pass.

- [x] **Step 10: Commit**

```bash
git add apps/api/src/modules/operations apps/api/src/app.module.ts apps/web/src/lib/api.ts "apps/web/src/app/(dashboard)/operations" apps/web/src/components/dashboard-shell.tsx apps/web/src/lib/i18n.tsx
git commit -m "feat: 增加队列失败闭环操作台"
```
