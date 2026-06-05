import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { SessionGuard } from '../../common/guards/session.guard'
import { ProjectAccessGuard } from '../access/project-access.guard'
import { ProjectRoles, type ProjectRole } from '../access/project-roles.decorator'
import { AuditLogService } from '../audit/audit-log.service'
import { ProjectMembersService } from './project-members.service'

type SessionRequest = { session?: { user?: { id?: string } } }
type RoleBody = { role: ProjectRole }
type AddMemberBody = { email: string; role: ProjectRole }

@Controller('api/projects/:projectId/members')
@UseGuards(SessionGuard, ProjectAccessGuard)
export class ProjectMembersController {
  constructor(
    private readonly membersService: ProjectMembersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  list(@Param('projectId') projectId: string) {
    return this.membersService.list(projectId)
  }

  @Post()
  @ProjectRoles('owner', 'admin')
  @UseGuards(SessionGuard, ProjectAccessGuard)
  async add(@Param('projectId') projectId: string, @Body() body: AddMemberBody, @Req() req: SessionRequest) {
    const member = await this.membersService.addByEmail(projectId, body.email, body.role)
    if (!member) throw new NotFoundException('User not found')
    await this.auditLogService.record({
      actorUserId: req.session?.user?.id ?? null,
      projectId,
      action: 'project.member_added',
      targetType: 'project_member',
      targetId: member.userId,
      metadata: { email: member.email, role: member.role },
    })
    return member
  }

  @Patch(':userId')
  @ProjectRoles('owner', 'admin')
  @UseGuards(SessionGuard, ProjectAccessGuard)
  async updateRole(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() body: RoleBody,
    @Req() req: SessionRequest,
  ) {
    const member = await this.membersService.updateRole(projectId, userId, body.role)
    if (!member) throw new NotFoundException('Project member not found')
    await this.auditLogService.record({
      actorUserId: req.session?.user?.id ?? null,
      projectId,
      action: 'project.member_role_updated',
      targetType: 'project_member',
      targetId: userId,
      metadata: { role: member.role },
    })
    return member
  }

  @Delete(':userId')
  @ProjectRoles('owner', 'admin')
  @UseGuards(SessionGuard, ProjectAccessGuard)
  async remove(@Param('projectId') projectId: string, @Param('userId') userId: string, @Req() req: SessionRequest) {
    await this.membersService.remove(projectId, userId)
    await this.auditLogService.record({
      actorUserId: req.session?.user?.id ?? null,
      projectId,
      action: 'project.member_removed',
      targetType: 'project_member',
      targetId: userId,
      metadata: null,
    })
    return { ok: true }
  }
}
