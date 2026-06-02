import { Controller, Get, Post, Body, UseGuards, Param, Req } from '@nestjs/common'
import { ProjectsService } from './projects.service'
import { SessionGuard } from '../../common/guards/session.guard'
import { ProjectAccessGuard } from '../access/project-access.guard'
import { ProjectRoles } from '../access/project-roles.decorator'

@Controller('api/projects')
@UseGuards(SessionGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list() {
    return this.projectsService.list()
  }

  @Post()
  create(@Body() body: { name: string; slug: string }, @Req() req: { session?: { user?: { id?: string } } }) {
    return this.projectsService.create(body, req.session?.user?.id)
  }

  @Post(':id/rotate-token')
  @ProjectRoles('owner', 'admin')
  @UseGuards(ProjectAccessGuard)
  rotateToken(@Param('id') id: string) {
    return this.projectsService.rotateToken(id)
  }
}
