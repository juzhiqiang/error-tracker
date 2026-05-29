import { Module } from '@nestjs/common'
import { EventsController } from './events.controller'
import { EventsService } from './events.service'
import { SourceMapsModule } from '../sourcemaps/sourcemaps.module'

@Module({
  imports: [SourceMapsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
