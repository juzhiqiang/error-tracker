import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { SessionGuard } from '../../common/guards/session.guard'
import {
  OrganizationCreateBody,
  OrganizationsService,
  TeamCreateBody,
  TeamMemberBody,
  TeamProjectBody,
} from './organizations.service'

type SessionRequest = { session?: { user?: { id?: string } } }

@Controller('api/organizations')
@UseGuards(SessionGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  list(@Req() req: SessionRequest) {
    return this.organizationsService.list(req.session?.user?.id)
  }

  @Post()
  create(@Body() body: OrganizationCreateBody, @Req() req: SessionRequest) {
    return this.organizationsService.create(body, req.session?.user?.id ?? '')
  }

  @Get(':organizationId/projects')
  projects(@Param('organizationId') organizationId: string, @Req() req: SessionRequest) {
    return this.organizationsService.listProjects(organizationId, req.session?.user?.id)
  }

  @Post(':organizationId/teams')
  createTeam(
    @Param('organizationId') organizationId: string,
    @Body() body: TeamCreateBody,
    @Req() req: SessionRequest,
  ) {
    return this.organizationsService.createTeam(organizationId, body, req.session?.user?.id ?? '')
  }

  @Post(':organizationId/teams/:teamId/members')
  addTeamMember(
    @Param('organizationId') organizationId: string,
    @Param('teamId') teamId: string,
    @Body() body: TeamMemberBody,
    @Req() req: SessionRequest,
  ) {
    return this.organizationsService.addTeamMember(organizationId, teamId, body, req.session?.user?.id ?? '')
  }

  @Post(':organizationId/teams/:teamId/projects')
  bindTeamProject(
    @Param('organizationId') organizationId: string,
    @Param('teamId') teamId: string,
    @Body() body: TeamProjectBody,
    @Req() req: SessionRequest,
  ) {
    return this.organizationsService.bindTeamProject(organizationId, teamId, body, req.session?.user?.id ?? '')
  }
}
