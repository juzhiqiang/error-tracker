import { Controller, Get, Post, Body, UseGuards, Param, Req } from '@nestjs/common'
import { ProjectsService } from './projects.service'
import { SessionGuard } from '../../common/guards/session.guard'
import { ProjectAccessGuard } from '../access/project-access.guard'
import { ProjectRoles } from '../access/project-roles.decorator'
import { AuditLogService } from '../audit/audit-log.service'

type SessionRequest = { session?: { user?: { id?: string } } }

@Controller('api/projects')
@UseGuards(SessionGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  list() {
    return this.projectsService.list()
  }

  @Post()
  async create(@Body() body: { name: string; slug: string }, @Req() req: SessionRequest) {
    const created = await this.projectsService.create(body, req.session?.user?.id)
    const project = created[0]
    if (project?.id) {
      await this.auditLogService.record({
        actorUserId: req.session?.user?.id ?? null,
        projectId: project.id,
        action: 'project.created',
        targetType: 'project',
        targetId: project.id,
        metadata: { name: body.name, slug: body.slug },
      })
    }
    return created
  }

  @Post(':id/rotate-token')
  @ProjectRoles('owner', 'admin')
  @UseGuards(SessionGuard, ProjectAccessGuard)
  async rotateToken(@Param('id') id: string, @Req() req: SessionRequest) {
    const updated = await this.projectsService.rotateToken(id)
    const project = updated[0]
    if (project?.id) {
      await this.auditLogService.record({
        actorUserId: req.session?.user?.id ?? null,
        projectId: project.id,
        action: 'project.token_rotated',
        targetType: 'project',
        targetId: project.id,
        metadata: null,
      })
    }
    return updated
  }
}
