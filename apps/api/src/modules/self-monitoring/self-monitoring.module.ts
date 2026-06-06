import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { SelfMonitoringExceptionFilter } from './self-monitoring.filter'
import { SelfMonitoringService } from './self-monitoring.service'

@Module({
  providers: [
    SelfMonitoringService,
    {
      provide: APP_FILTER,
      useClass: SelfMonitoringExceptionFilter,
    },
  ],
  exports: [SelfMonitoringService],
})
export class SelfMonitoringModule {}
