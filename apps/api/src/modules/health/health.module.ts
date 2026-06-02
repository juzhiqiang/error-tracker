import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { SourceMapsModule } from '../sourcemaps/sourcemaps.module'
import { ObservabilityModule } from '../observability/observability.module'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'

@Module({
  imports: [BullModule.registerQueue({ name: 'cleanup' }), SourceMapsModule, ObservabilityModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
