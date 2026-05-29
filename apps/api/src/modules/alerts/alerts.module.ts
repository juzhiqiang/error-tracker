import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AlertsProcessor } from './alerts.processor'

@Module({
  imports: [BullModule.registerQueue({ name: 'events' })],
  providers: [AlertsProcessor],
})
export class AlertsModule {}
