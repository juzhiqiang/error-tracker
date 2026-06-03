import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { SessionGuard } from '../../common/guards/session.guard'
import { ProjectAccessGuard } from '../access/project-access.guard'
import { AuditLogService } from './audit-log.service'

@Controller('api/audit-logs')
@UseGuards(SessionGuard, ProjectAccessGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(@Query('projectId') projectId: string, @Query('limit') limit?: string) {
    return this.auditLogService.listByProject(projectId, limit ? Number(limit) : 100)
  }
}
