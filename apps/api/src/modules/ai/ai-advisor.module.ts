import { Module } from '@nestjs/common'
import { AccessModule } from '../access/access.module'
import { AuditLogModule } from '../audit/audit-log.module'
import { AiAdvisorController } from './ai-advisor.controller'
import { AiAdvisorService } from './ai-advisor.service'
import { AiProviderService } from './ai-provider.service'

@Module({
  imports: [AccessModule, AuditLogModule],
  controllers: [AiAdvisorController],
  providers: [AiAdvisorService, AiProviderService],
  exports: [AiAdvisorService],
})
export class AiAdvisorModule {}
