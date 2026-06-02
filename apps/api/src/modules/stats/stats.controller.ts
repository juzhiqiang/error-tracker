import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { StatsService } from './stats.service'
import { SessionGuard } from '../../common/guards/session.guard'
import { ProjectAccessGuard } from '../access/project-access.guard'

@Controller('api/stats')
@UseGuards(SessionGuard, ProjectAccessGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('issues')
  issues(@Query('projectId') pId: string, @Query('days') days: string) {
    return this.statsService.issuesTrend(pId, Number(days) || 7)
  }

  @Get('performance')
  performance(@Query('projectId') pId: string) {
    return this.statsService.performanceSummary(pId)
  }
}
