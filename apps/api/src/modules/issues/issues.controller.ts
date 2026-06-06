import { Body, Controller, ForbiddenException, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common'
import { IssuesService } from './issues.service'
import { EventsService } from '../events/events.service'
import { SessionGuard } from '../../common/guards/session.guard'
import { ProjectAccessGuard } from '../access/project-access.guard'
import { AuditLogService } from '../audit/audit-log.service'
import { AccessControlService } from '../access/access-control.service'
import type { ProjectRole } from '../access/project-roles.decorator'

type SessionRequest = { session?: { user?: { id?: string } } }

@Controller('api/issues')
@UseGuards(SessionGuard)
export class IssuesController {
  constructor(
    private readonly issuesService: IssuesService,
    private readonly eventsService: EventsService,
    private readonly accessControlService: AccessControlService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  @UseGuards(SessionGuard, ProjectAccessGuard)
  list(@Query() query: Record<string, string>) {
    return this.issuesService.list({
      projectId: query.projectId,
      status: query.status as never,
      level: query.level,
      q: query.q,
      timeRange: query.timeRange as never,
      page: query.page ? Number(query.page) : 1,
    })
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: SessionRequest) {
    await this.assertIssueAccess(req, id, ['viewer'])
    return this.issuesService.findById(id)
  }

  @Get(':id/events')
  async events(@Param('id') id: string, @Req() req: SessionRequest) {
    await this.assertIssueAccess(req, id, ['viewer'])
    return this.eventsService.listByIssue(id)
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { status: 'resolved' | 'ignored' | 'unresolved' },
    @Req() req: SessionRequest,
  ) {
    await this.assertIssueAccess(req, id, ['owner', 'admin', 'member'])
    const issue = await this.issuesService.updateStatus(id, body.status)
    if (issue?.id && issue.projectId) {
      await this.auditLogService.record({
        actorUserId: req.session?.user?.id ?? null,
        projectId: issue.projectId,
        action: 'issue.status_updated',
        targetType: 'issue',
        targetId: issue.id,
        metadata: { status: body.status },
      })
    }
    return issue
  }

  private async assertIssueAccess(req: SessionRequest, issueId: string, roles: ProjectRole[]): Promise<void> {
    const userId = req.session?.user?.id
    if (!userId || !(await this.accessControlService.canAccessIssue(userId, issueId, roles))) {
      throw new ForbiddenException('Issue access denied')
    }
  }
}
