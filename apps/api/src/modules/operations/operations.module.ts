import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { AccessModule } from '../access/access.module'
import { QueueOperationsController } from './queue-operations.controller'
import { QueueOperationsService } from './queue-operations.service'

@Module({
  imports: [
    BullModule.registerQueue({ name: 'ingest' }),
    BullModule.registerQueue({ name: 'events' }),
    BullModule.registerQueue({ name: 'cleanup' }),
    AccessModule,
  ],
  controllers: [QueueOperationsController],
  providers: [QueueOperationsService],
})
export class OperationsModule {}
