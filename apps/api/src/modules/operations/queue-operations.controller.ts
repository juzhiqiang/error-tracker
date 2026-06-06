import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { SessionGuard } from '../../common/guards/session.guard'
import { ProjectAccessGuard } from '../access/project-access.guard'
import { ProjectRoles } from '../access/project-roles.decorator'
import { QueueOperationsService } from './queue-operations.service'
import type { OperationsQueueName } from './queue-operations.service'

@Controller('api/operations/queues')
@UseGuards(SessionGuard, ProjectAccessGuard)
@ProjectRoles('owner', 'admin')
export class QueueOperationsController {
  constructor(private readonly service: QueueOperationsService) {}

  @Get()
  list(@Query('projectId') _projectId: string) {
    return this.service.list()
  }

  @Post(':queueName/jobs/:jobId/retry')
  retry(
    @Query('projectId') _projectId: string,
    @Param('queueName') queueName: OperationsQueueName,
    @Param('jobId') jobId: string,
  ) {
    return this.service.retry(queueName, jobId)
  }

  @Delete(':queueName/jobs/:jobId')
  remove(
    @Query('projectId') _projectId: string,
    @Param('queueName') queueName: OperationsQueueName,
    @Param('jobId') jobId: string,
  ) {
    return this.service.remove(queueName, jobId)
  }
}
