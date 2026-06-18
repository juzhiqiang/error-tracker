import { describe, expect, it, mock } from 'bun:test'
import { UnauthorizedException } from '@nestjs/common'
import { DsnAuthGuard } from './dsn-auth.guard'

function makeContext(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  }
}

describe('DsnAuthGuard', () => {
  it('authenticates with x-error-tracker-token when path token is omitted', async () => {
    const project = { id: 'project-1', dsnToken: 'secret-token' }
    const whereMock = mock(() => ({
      limit: () => [project],
    }))
    const db = {
      select: () => ({
        from: () => ({
          where: whereMock,
        }),
      }),
    }
    const guard = new DsnAuthGuard(db as never)
    const req = {
      params: { projectId: 'project-1' },
      headers: { 'x-error-tracker-token': 'secret-token' },
    }

    await expect(guard.canActivate(makeContext(req) as never)).resolves.toBe(true)
    const condition = whereMock.mock.calls[0][0] as { queryChunks: { value?: unknown }[] }
    expect(condition.queryChunks.some((chunk) => chunk.value === 'secret-token')).toBe(true)
    expect(req).toHaveProperty('project', project)
  })

  it('rejects a stale token after project token rotation', async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => [],
          }),
        }),
      }),
    }
    const guard = new DsnAuthGuard(db as never)
    const req = {
      params: { projectId: 'project-1', token: 'old-token' },
      headers: {},
    }

    await expect(guard.canActivate(makeContext(req) as never)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects ingest requests that omit the DSN token', async () => {
    const db = {
      select: mock(() => ({
        from: () => ({
          where: () => ({
            limit: () => [],
          }),
        }),
      })),
    }
    const guard = new DsnAuthGuard(db as never)
    const req = {
      params: { projectId: 'project-1' },
      headers: {},
    }

    await expect(guard.canActivate(makeContext(req) as never)).rejects.toThrow(UnauthorizedException)
    expect(db.select.mock.calls).toHaveLength(0)
  })
})
