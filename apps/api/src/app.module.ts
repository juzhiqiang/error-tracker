import { Module, OnModuleInit } from '@nestjs/common'
import { BullModule, InjectQueue } from '@nestjs/bullmq'
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
import { HealthModule } from './modules/health/health.module'
import { ObservabilityModule } from './modules/observability/observability.module'
import { AuditLogModule } from './modules/audit/audit-log.module'
import { OperationsModule } from './modules/operations/operations.module'
import { OrganizationsModule } from './modules/organizations/organizations.module'
import { SelfMonitoringModule } from './modules/self-monitoring/self-monitoring.module'
import { AiAdvisorModule } from './modules/ai/ai-advisor.module'

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6380),
      },
    }),
    BullModule.registerQueue({ name: 'cleanup' }),
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
    ObservabilityModule,
    AuditLogModule,
    OperationsModule,
    OrganizationsModule,
    SelfMonitoringModule,
    AiAdvisorModule,
    HealthModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(@InjectQueue('cleanup') private cleanupQueue: Queue) {}

  async onModuleInit() {
    // 注册每日 02:00 清理定时任务（jobId 幂等，防止重复注册）
    await this.cleanupQueue.add(
      'daily-cleanup',
      {},
      {
        repeat: { pattern: '0 2 * * *' },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
        jobId: 'daily-cleanup-recurring',
      },
    )
  }
}
