import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AccessControlService } from './access-control.service'
import { ALL_PROJECT_ROLES, PROJECT_ROLES_KEY, ProjectRole } from './project-roles.decorator'

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private readonly accessControl: AccessControlService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const userId = req.session?.user?.id
    const projectId = this.projectIdFromRequest(req)
    const roles =
      this.reflector.getAllAndOverride<ProjectRole[]>(PROJECT_ROLES_KEY, [context.getHandler(), context.getClass()]) ??
      ALL_PROJECT_ROLES

    if (!userId || !projectId) {
      throw new ForbiddenException('Project access denied')
    }

    const allowed = await this.accessControl.canAccessProject(userId, projectId, roles)
    if (!allowed) {
      throw new ForbiddenException('Project access denied')
    }

    req.projectAccess = { projectId, roles }
    return true
  }

  private projectIdFromRequest(req: {
    params?: Record<string, unknown>
    query?: Record<string, unknown>
    body?: Record<string, unknown>
  }): string | undefined {
    return firstString(req.params?.projectId, req.query?.projectId, req.body?.projectId, req.params?.id)
  }
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0)
}
