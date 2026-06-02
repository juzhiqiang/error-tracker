import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { IngestController } from './ingest.controller'
import { IngestService } from './ingest.service'
import { DsnAuthGuard } from '../../common/guards/dsn-auth.guard'
import { SourceMapsModule } from '../sourcemaps/sourcemaps.module'
import { IngestLimitsService } from './ingest.limits'

@Module({
  imports: [BullModule.registerQueue({ name: 'events' }), SourceMapsModule],
  controllers: [IngestController],
  providers: [IngestService, DsnAuthGuard, IngestLimitsService],
})
export class IngestModule {}
