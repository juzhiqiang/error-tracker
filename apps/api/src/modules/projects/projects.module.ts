import { Module } from '@nestjs/common'
import { ProjectInvitationsController } from './project-invitations.controller'
import { InvitationEmailService } from './invitation-email.service'
import { ProjectInvitationsService } from './project-invitations.service'
import { ProjectMembersController } from './project-members.controller'
import { ProjectMembersService } from './project-members.service'
import { ProjectsController } from './projects.controller'
import { ProjectsService } from './projects.service'
import { AccessModule } from '../access/access.module'
import { AuditLogModule } from '../audit/audit-log.module'

@Module({
  imports: [AccessModule, AuditLogModule],
  controllers: [ProjectsController, ProjectMembersController, ProjectInvitationsController],
  providers: [ProjectsService, ProjectMembersService, ProjectInvitationsService, InvitationEmailService],
})
export class ProjectsModule {}
