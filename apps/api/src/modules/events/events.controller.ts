import { Controller, ForbiddenException, Get, Param, Req, UseGuards } from '@nestjs/common'
import { EventsService } from './events.service'
import { SessionGuard } from '../../common/guards/session.guard'
import { AccessControlService } from '../access/access-control.service'

type SessionRequest = { session?: { user?: { id?: string } } }

@Controller('api/events')
@UseGuards(SessionGuard)
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly accessControlService: AccessControlService,
  ) {}

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: SessionRequest) {
    await this.assertEventAccess(req, id)
    return this.eventsService.findById(id)
  }

  @Get(':id/replay')
  async replay(@Param('id') id: string, @Req() req: SessionRequest) {
    await this.assertEventAccess(req, id)
    return this.eventsService.findReplayByEventId(id)
  }

  private async assertEventAccess(req: SessionRequest, eventId: string): Promise<void> {
    const userId = req.session?.user?.id
    if (!userId || !(await this.accessControlService.canAccessEvent(userId, eventId, ['viewer']))) {
      throw new ForbiddenException('Event access denied')
    }
  }
}
