import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { SessionGuard } from '../../common/guards/session.guard'
import { ProjectAccessGuard } from '../access/project-access.guard'
import { ProjectRoles, type ProjectRole } from '../access/project-roles.decorator'
import { AuditLogService } from '../audit/audit-log.service'
import { InvitationEmailService } from './invitation-email.service'
import { ProjectInvitationsService } from './project-invitations.service'

type SessionRequest = { session?: { user?: { id?: string; email?: string } } }
type InviteBody = { email: string; role: ProjectRole }

@Controller()
export class ProjectInvitationsController {
  constructor(
    private readonly invitationsService: ProjectInvitationsService,
    private readonly auditLogService: AuditLogService,
    private readonly invitationEmailService: InvitationEmailService,
  ) {}

  @Get('api/projects/:projectId/invitations')
  @UseGuards(SessionGuard, ProjectAccessGuard)
  list(@Param('projectId') projectId: string) {
    return this.invitationsService.list(projectId)
  }

  @Post('api/projects/:projectId/invitations')
  @ProjectRoles('owner', 'admin')
  @UseGuards(SessionGuard, ProjectAccessGuard)
  async create(@Param('projectId') projectId: string, @Body() body: InviteBody, @Req() req: SessionRequest) {
    const invitation = await this.invitationsService.create({
      projectId,
      email: body.email,
      role: body.role,
      invitedByUserId: req.session?.user?.id ?? null,
    })
    const emailDelivery = await this.invitationEmailService.sendProjectInvitation(invitation, {
      invitedByEmail: req.session?.user?.email ?? null,
    })
    await this.auditLogService.record({
      actorUserId: req.session?.user?.id ?? null,
      projectId,
      action: 'project.invitation_created',
      targetType: 'project_invitation',
      targetId: invitation.id,
      metadata: {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        emailDeliveryStatus: emailDelivery.status,
      },
    })
    return { ...invitation, emailDelivery }
  }

  @Post('api/projects/:projectId/invitations/:invitationId/resend')
  @ProjectRoles('owner', 'admin')
  @UseGuards(SessionGuard, ProjectAccessGuard)
  async resend(
    @Param('projectId') projectId: string,
    @Param('invitationId') invitationId: string,
    @Req() req: SessionRequest,
  ) {
    const invitation = await this.invitationsService.resend(projectId, invitationId)
    if (!invitation) throw new NotFoundException('Invitation not found')
    const emailDelivery = await this.invitationEmailService.sendProjectInvitation(invitation, {
      invitedByEmail: req.session?.user?.email ?? null,
    })
    await this.auditLogService.record({
      actorUserId: req.session?.user?.id ?? null,
      projectId,
      action: 'project.invitation_resent',
      targetType: 'project_invitation',
      targetId: invitation.id,
      metadata: {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        emailDeliveryStatus: emailDelivery.status,
      },
    })
    return { ...invitation, emailDelivery }
  }

  @Delete('api/projects/:projectId/invitations/:invitationId')
  @ProjectRoles('owner', 'admin')
  @UseGuards(SessionGuard, ProjectAccessGuard)
  async revoke(
    @Param('projectId') projectId: string,
    @Param('invitationId') invitationId: string,
    @Req() req: SessionRequest,
  ) {
    const revoked = await this.invitationsService.revoke(projectId, invitationId)
    if (!revoked) throw new NotFoundException('Invitation not found')
    await this.auditLogService.record({
      actorUserId: req.session?.user?.id ?? null,
      projectId,
      action: 'project.invitation_revoked',
      targetType: 'project_invitation',
      targetId: invitationId,
      metadata: null,
    })
    return { ok: true }
  }

  @Get('api/invitations/:token')
  async detail(@Param('token') token: string) {
    const invitation = await this.invitationsService.detail(token)
    if (!invitation) throw new NotFoundException('Invitation not found')
    return invitation
  }

  @Post('api/invitations/:token/accept')
  @UseGuards(SessionGuard)
  async accept(@Param('token') token: string, @Req() req: SessionRequest) {
    const userId = req.session?.user?.id
    const email = req.session?.user?.email
    if (!userId || !email) throw new ForbiddenException('Signed-in user is required')

    const result = await this.invitationsService.accept(token, { userId, email })
    if (result.outcome === 'not_found') throw new NotFoundException('Invitation not found')
    if (result.outcome === 'email_mismatch') throw new ForbiddenException('Invitation email does not match signed-in user')
    if (result.outcome === 'expired') throw new BadRequestException('Invitation expired')
    if (result.outcome === 'revoked') throw new BadRequestException('Invitation revoked')
    if (result.outcome === 'already_accepted') throw new ConflictException('Invitation already accepted')
    if (!result.invitation) throw new BadRequestException('Invitation could not be accepted')

    await this.auditLogService.record({
      actorUserId: userId,
      projectId: result.invitation.projectId,
      action: 'project.invitation_accepted',
      targetType: 'project_invitation',
      targetId: result.invitation.id,
      metadata: { email: result.invitation.email, role: result.invitation.role },
    })
    return result.invitation
  }
}
