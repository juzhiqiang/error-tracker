import { describe, expect, it, mock } from 'bun:test'
import { ForbiddenException } from '@nestjs/common'
import { ProjectAccessGuard } from './project-access.guard'

function makeContext(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }
}

describe('ProjectAccessGuard', () => {
  it('allows a session user with project access from query projectId', async () => {
    const access = { canAccessProject: mock(async () => true) }
    const reflector = { getAllAndOverride: mock(() => ['viewer', 'member']) }
    const guard = new ProjectAccessGuard(access as never, reflector as never)
    const req = {
      session: { user: { id: 'user-1' } },
      params: {},
      query: { projectId: 'project-1' },
      body: {},
    }

    await expect(guard.canActivate(makeContext(req) as never)).resolves.toBe(true)
    expect(access.canAccessProject.mock.calls[0]).toEqual(['user-1', 'project-1', ['viewer', 'member']])
    expect(req).toHaveProperty('projectAccess', { projectId: 'project-1', roles: ['viewer', 'member'] })
  })

  it('rejects when the required project role is missing', async () => {
    const access = { canAccessProject: mock(async () => false) }
    const reflector = { getAllAndOverride: mock(() => ['owner', 'admin']) }
    const guard = new ProjectAccessGuard(access as never, reflector as never)
    const req = {
      session: { user: { id: 'user-1' } },
      params: { projectId: 'project-1' },
      query: {},
      body: {},
    }

    await expect(guard.canActivate(makeContext(req) as never)).rejects.toThrow(ForbiddenException)
  })
})
