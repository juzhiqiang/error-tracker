import { Controller, ForbiddenException, Get, Param, Query, Req, UseGuards } from '@nestjs/common'
import { StatsService } from './stats.service'
import { SessionGuard } from '../../common/guards/session.guard'
import { ProjectAccessGuard } from '../access/project-access.guard'
import { AccessControlService } from '../access/access-control.service'

type SessionRequest = { session?: { user?: { id?: string } } }

@Controller('api/stats')
@UseGuards(SessionGuard)
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly accessControlService: AccessControlService,
  ) {}

  @Get('issues')
  @UseGuards(ProjectAccessGuard)
  issues(@Query('projectId') pId: string, @Query('days') days: string) {
    return this.statsService.issuesTrend(pId, Number(days) || 7)
  }

  @Get('performance')
  @UseGuards(ProjectAccessGuard)
  performance(@Query('projectId') pId: string, @Query('days') days: string) {
    return this.statsService.performanceSummary(pId, Number(days) || 7)
  }

  @Get('performance/devices')
  @UseGuards(ProjectAccessGuard)
  performanceDevices(@Query('projectId') pId: string, @Query('days') days: string) {
    return this.statsService.performanceDevices(pId, Number(days) || 7)
  }

  @Get('performance/issues/:issueId')
  async issuePerformance(@Param('issueId') issueId: string, @Req() req: SessionRequest) {
    const userId = req.session?.user?.id
    if (!userId || !(await this.accessControlService.canAccessIssue(userId, issueId, ['viewer']))) {
      throw new ForbiddenException('Issue access denied')
    }
    return this.statsService.issueRelatedPerformance(issueId)
  }

  @Get('geo')
  @UseGuards(ProjectAccessGuard)
  geo(@Query('projectId') pId: string) {
    return this.statsService.geoDistribution(pId)
  }
}
