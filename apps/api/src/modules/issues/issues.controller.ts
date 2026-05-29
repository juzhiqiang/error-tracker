import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common'
import { IssuesService } from './issues.service'
import { SessionGuard } from '../../common/guards/session.guard'

@Controller('api/issues')
@UseGuards(SessionGuard)
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Get()
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
  findOne(@Param('id') id: string) {
    return this.issuesService.findById(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { status: 'resolved' | 'ignored' | 'unresolved' }) {
    return this.issuesService.updateStatus(id, body.status)
  }
}
