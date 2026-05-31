import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { EventsService } from './events.service'
import { SessionGuard } from '../../common/guards/session.guard'

@Controller('api/events')
@UseGuards(SessionGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findById(id)
  }

  @Get(':id/replay')
  replay(@Param('id') id: string) {
    return this.eventsService.findReplayByEventId(id)
  }
}
