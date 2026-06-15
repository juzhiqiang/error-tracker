import { describe, expect, it, mock } from 'bun:test'

// NOTE: do not mock '@nestjs/common'. Bun's mock.module is process-global and persists
// across files, so replacing the whole module here used to drop exports (e.g. Logger) that
// other test files load lazily — any later test importing @nestjs/platform-express then hit
// `new Logger(...)` against an undefined constructor. The real decorators work fine for a
// direct `new Controller(...)` unit test, so we only stub the auth guard's import chain.
mock.module('../../common/guards/session.guard', () => ({
  SessionGuard: class SessionGuard {},
}))

describe('AiAdvisorController', () => {
  it('checks issue access and records an audit row for issue analysis', async () => {
    const analysis = { summary: 'fix it' }
    const access = { canAccessIssue: mock(async () => true), canAccessProject: mock(async () => true) }
    const advisor = { analyzeIssueById: mock(async () => ({ projectId: 'project-1', analysis })) }
    const audit = { record: mock(async () => undefined) }
    const { AiAdvisorController } = await import('./ai-advisor.controller')
    const controller = new AiAdvisorController(access as never, advisor as never, audit as never)
    const req = { session: { user: { id: 'user-1' } } }

    await expect(controller.issueAnalysis('issue-1', req)).resolves.toEqual(analysis)

    expect(access.canAccessIssue).toHaveBeenCalledWith('user-1', 'issue-1', ['viewer'])
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'user-1',
      projectId: 'project-1',
      action: 'ai.issue_analysis_generated',
      targetType: 'issue',
      targetId: 'issue-1',
      metadata: { provider: undefined, model: undefined },
    })
  })

  it('checks project access and records an audit row for performance analysis', async () => {
    const analysis = { summary: 'optimize it', provider: 'local', model: 'local-rules' }
    const access = { canAccessIssue: mock(async () => true), canAccessProject: mock(async () => true) }
    const advisor = { analyzePerformanceByProject: mock(async () => ({ projectId: 'project-1', analysis })) }
    const audit = { record: mock(async () => undefined) }
    const { AiAdvisorController } = await import('./ai-advisor.controller')
    const controller = new AiAdvisorController(access as never, advisor as never, audit as never)
    const req = { session: { user: { id: 'user-1' } } }

    await expect(controller.performanceAnalysis('project-1', req)).resolves.toEqual(analysis)

    expect(access.canAccessProject).toHaveBeenCalledWith('user-1', 'project-1', ['viewer'])
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'user-1',
      projectId: 'project-1',
      action: 'ai.performance_analysis_generated',
      targetType: 'project',
      targetId: 'project-1',
      metadata: { provider: 'local', model: 'local-rules' },
    })
  })
})
