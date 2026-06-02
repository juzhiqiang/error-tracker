import { Module } from '@nestjs/common'
import { IssuesController } from './issues.controller'
import { IssuesService } from './issues.service'
import { EventsModule } from '../events/events.module'
import { AccessModule } from '../access/access.module'

@Module({
  imports: [EventsModule, AccessModule],
  controllers: [IssuesController],
  providers: [IssuesService],
})
export class IssuesModule {}
