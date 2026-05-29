import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { CleanupProcessor } from './cleanup.processor'
import { SourceMapsModule } from '../sourcemaps/sourcemaps.module'

@Module({
  imports: [BullModule.registerQueue({ name: 'cleanup' }), SourceMapsModule],
  providers: [CleanupProcessor],
  exports: [],
})
export class CleanupModule {}
