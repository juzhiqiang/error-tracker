import { SetMetadata } from '@nestjs/common'

export const PROJECT_ROLES_KEY = 'projectRoles'
export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer'
export const ALL_PROJECT_ROLES: ProjectRole[] = ['owner', 'admin', 'member', 'viewer']

export const ProjectRoles = (...roles: ProjectRole[]) => SetMetadata(PROJECT_ROLES_KEY, roles)
