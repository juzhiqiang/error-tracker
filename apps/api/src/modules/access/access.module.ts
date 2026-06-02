import { Module } from '@nestjs/common'
import { AccessControlService } from './access-control.service'
import { ProjectAccessGuard } from './project-access.guard'

@Module({
  providers: [AccessControlService, ProjectAccessGuard],
  exports: [AccessControlService, ProjectAccessGuard],
})
export class AccessModule {}
