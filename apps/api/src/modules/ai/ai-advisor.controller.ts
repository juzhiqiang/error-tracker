import { Controller, ForbiddenException, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { SessionGuard } from '../../common/guards/session.guard'
import { AccessControlService } from '../access/access-control.service'
import { AuditLogService } from '../audit/audit-log.service'
import { AiAdvisorService } from './ai-advisor.service'

type SessionRequest = { session?: { user?: { id?: string } } }

@Controller()
@UseGuards(SessionGuard)
export class AiAdvisorController {
  constructor(
    private readonly accessControl: AccessControlService,
    private readonly advisor: AiAdvisorService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Post('api/issues/:id/ai-analysis')
  async issueAnalysis(@Param('id') issueId: string, @Req() req: SessionRequest) {
    const userId = this.userId(req)
    if (!userId || !(await this.accessControl.canAccessIssue(userId, issueId, ['viewer']))) {
      throw new ForbiddenException('Issue access denied')
    }
    const result = await this.advisor.analyzeIssueById(issueId)
    await this.auditLog.record({
      actorUserId: userId,
      projectId: result.projectId,
      action: 'ai.issue_analysis_generated',
      targetType: 'issue',
      targetId: issueId,
      metadata: { provider: result.analysis.provider, model: result.analysis.model },
    })
    return result.analysis
  }

  @Post('api/stats/performance/ai-analysis')
  async performanceAnalysis(@Query('projectId') projectId: string, @Req() req: SessionRequest) {
    const userId = this.userId(req)
    if (!userId || !(await this.accessControl.canAccessProject(userId, projectId, ['viewer']))) {
      throw new ForbiddenException('Project access denied')
    }
    const result = await this.advisor.analyzePerformanceByProject(projectId)
    await this.auditLog.record({
      actorUserId: userId,
      projectId,
      action: 'ai.performance_analysis_generated',
      targetType: 'project',
      targetId: projectId,
      metadata: { provider: result.analysis.provider, model: result.analysis.model },
    })
    return result.analysis
  }

  private userId(req: SessionRequest): string | undefined {
    return req.session?.user?.id
  }
}
