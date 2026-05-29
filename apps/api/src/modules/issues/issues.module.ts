import { Module } from '@nestjs/common'
import { IssuesController } from './issues.controller'
import { IssuesService } from './issues.service'
import { EventsModule } from '../events/events.module'

@Module({
  imports: [EventsModule],
  controllers: [IssuesController],
  providers: [IssuesService],
})
export class IssuesModule {}
