import { Module } from '@nestjs/common'
import { EventsController } from './events.controller'
import { EventsService } from './events.service'
import { SourceMapsModule } from '../sourcemaps/sourcemaps.module'
import { AccessModule } from '../access/access.module'

@Module({
  imports: [SourceMapsModule, AccessModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
