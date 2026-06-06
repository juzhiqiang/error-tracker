import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common'
import { SessionGuard } from '../../common/guards/session.guard'
import { ProjectAccessGuard } from '../access/project-access.guard'
import { AuditLogListFilters, AuditLogService } from './audit-log.service'

@Controller('api/audit-logs')
@UseGuards(SessionGuard, ProjectAccessGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="audit-logs.csv"')
  async exportCsv(@Query() query: AuditLogQuery) {
    return AuditLogService.toCsv(await this.auditLogService.list(normalizeFilters(query)))
  }

  @Get()
  list(@Query() query: AuditLogQuery) {
    return this.auditLogService.list(normalizeFilters(query))
  }
}

type AuditLogQuery = Omit<AuditLogListFilters, 'limit'> & { limit?: string | number }

function normalizeFilters(query: AuditLogQuery): AuditLogListFilters {
  return {
    ...query,
    limit: query.limit ? Number(query.limit) : undefined,
  }
}
