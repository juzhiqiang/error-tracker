import { Module } from '@nestjs/common'
import { ProjectsController } from './projects.controller'
import { ProjectsService } from './projects.service'
import { AccessModule } from '../access/access.module'
import { AuditLogModule } from '../audit/audit-log.module'

@Module({
  imports: [AccessModule, AuditLogModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
