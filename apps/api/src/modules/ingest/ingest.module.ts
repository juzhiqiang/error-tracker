import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { IngestController } from './ingest.controller'
import { IngestService } from './ingest.service'
import { DsnAuthGuard } from '../../common/guards/dsn-auth.guard'

@Module({
  imports: [BullModule.registerQueue({ name: 'events' })],
  controllers: [IngestController],
  providers: [IngestService, DsnAuthGuard],
})
export class IngestModule {}
