import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { MetricsService } from './metrics.service'

@Module({
  imports: [BullModule.registerQueue({ name: 'events' }), BullModule.registerQueue({ name: 'cleanup' })],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class ObservabilityModule {}
