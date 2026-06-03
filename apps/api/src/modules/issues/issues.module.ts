import { Module } from '@nestjs/common'
import { IssuesController } from './issues.controller'
import { IssuesService } from './issues.service'
import { EventsModule } from '../events/events.module'
import { AccessModule } from '../access/access.module'
import { AuditLogModule } from '../audit/audit-log.module'

@Module({
  imports: [EventsModule, AccessModule, AuditLogModule],
  controllers: [IssuesController],
  providers: [IssuesService],
})
export class IssuesModule {}
