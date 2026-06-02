import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common'
import { ProjectsService } from './projects.service'
import { SessionGuard } from '../../common/guards/session.guard'

@Controller('api/projects')
@UseGuards(SessionGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list() {
    return this.projectsService.list()
  }

  @Post()
  create(@Body() body: { name: string; slug: string }) {
    return this.projectsService.create(body)
  }

  @Post(':id/rotate-token')
  rotateToken(@Param('id') id: string) {
    return this.projectsService.rotateToken(id)
  }
}
