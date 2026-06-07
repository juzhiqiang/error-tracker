import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { IngestController } from './ingest.controller'
import { IngestProcessor } from './ingest.processor'
import { IngestService } from './ingest.service'
import { DsnAuthGuard } from '../../common/guards/dsn-auth.guard'
import { SourceMapsModule } from '../sourcemaps/sourcemaps.module'
import { IngestLimitsService } from './ingest.limits'
import { ObservabilityModule } from '../observability/observability.module'

@Module({
  imports: [BullModule.registerQueue({ name: 'events' }), BullModule.registerQueue({ name: 'ingest' }), SourceMapsModule, ObservabilityModule],
  controllers: [IngestController],
  providers: [IngestService, IngestProcessor, DsnAuthGuard, IngestLimitsService],
})
export class IngestModule {}
