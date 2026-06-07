import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
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

  @Get(':id/comments')
  async comments(@Param('id') id: string, @Req() req: SessionRequest) {
    await this.assertIssueAccess(req, id, ['viewer'])
    return this.issuesService.listComments(id)
  }

  @Post(':id/comments')
  async addComment(@Param('id') id: string, @Body() body: { body: string }, @Req() req: SessionRequest) {
    await this.assertIssueAccess(req, id, ['owner', 'admin', 'member'])
    const comment = await this.issuesService.addComment(id, req.session?.user?.id ?? '', body.body)
    const issue = await this.issuesService.findById(id)
    if (issue?.id && issue.projectId) {
      await this.auditLogService.record({
        actorUserId: req.session?.user?.id ?? null,
        projectId: issue.projectId,
        action: 'issue.comment_added',
        targetType: 'issue',
        targetId: issue.id,
        metadata: { commentId: comment?.id ?? null },
      })
    }
    return comment
  }

  @Get(':id/facets')
  async facets(@Param('id') id: string, @Req() req: SessionRequest) {
    await this.assertIssueAccess(req, id, ['viewer'])
    return this.issuesService.facets(id)
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { status: 'resolved' | 'ignored' | 'unresolved' },
    @Req() req: SessionRequest,
  ) {
    await this.assertIssueAccess(req, id, ['owner', 'admin', 'member'])
    const issue = await this.issuesService.updateStatus(id, body.status, req.session?.user?.id ?? null)
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

  @Patch(':id/assignment')
  async assign(@Param('id') id: string, @Body() body: { assigneeUserId?: string | null }, @Req() req: SessionRequest) {
    await this.assertIssueAccess(req, id, ['owner', 'admin', 'member'])
    const issue = await this.issuesService.assign(id, body.assigneeUserId ?? null, req.session?.user?.id ?? null)
    if (issue?.id && issue.projectId) {
      await this.auditLogService.record({
        actorUserId: req.session?.user?.id ?? null,
        projectId: issue.projectId,
        action: 'issue.assigned',
        targetType: 'issue',
        targetId: issue.id,
        metadata: { assigneeUserId: body.assigneeUserId ?? null },
      })
    }
    return issue
  }

  @Patch(':id/fix')
  async markFixed(@Param('id') id: string, @Body() body: { release: string }, @Req() req: SessionRequest) {
    await this.assertIssueAccess(req, id, ['owner', 'admin', 'member'])
    const issue = await this.issuesService.markFixed(id, body.release, req.session?.user?.id ?? null)
    if (issue?.id && issue.projectId) {
      await this.auditLogService.record({
        actorUserId: req.session?.user?.id ?? null,
        projectId: issue.projectId,
        action: 'issue.fixed_in_release',
        targetType: 'issue',
        targetId: issue.id,
        metadata: { release: body.release },
      })
    }
    return issue
  }

  @Post(':id/merge')
  async merge(@Param('id') id: string, @Body() body: { targetIssueId: string }, @Req() req: SessionRequest) {
    await this.assertIssueAccess(req, id, ['owner', 'admin', 'member'])
    await this.assertIssueAccess(req, body.targetIssueId, ['owner', 'admin', 'member'])
    const issue = await this.issuesService.mergeIssues(id, body.targetIssueId)
    if (issue?.id && issue.projectId) {
      await this.auditLogService.record({
        actorUserId: req.session?.user?.id ?? null,
        projectId: issue.projectId,
        action: 'issue.merged',
        targetType: 'issue',
        targetId: issue.id,
        metadata: { sourceIssueId: id, targetIssueId: body.targetIssueId },
      })
    }
    return issue
  }

  @Post(':id/split')
  async split(@Param('id') id: string, @Body() body: { eventIds: string[] }, @Req() req: SessionRequest) {
    await this.assertIssueAccess(req, id, ['owner', 'admin', 'member'])
    const issue = await this.issuesService.splitIssue(id, body.eventIds ?? [])
    if (issue?.id && issue.projectId) {
      await this.auditLogService.record({
        actorUserId: req.session?.user?.id ?? null,
        projectId: issue.projectId,
        action: 'issue.split',
        targetType: 'issue',
        targetId: issue.id,
        metadata: { sourceIssueId: id, eventIds: body.eventIds ?? [] },
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
