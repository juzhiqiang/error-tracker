import { describe, expect, it, mock } from 'bun:test'
import { ProjectsService } from './projects.service'

describe('ProjectsService', () => {
  it('lists only projects available to the current user', async () => {
    const project = { id: 'project-1', name: 'App', slug: 'app' }
    const db = { execute: mock(async () => ({ rows: [project] })) }
    const service = new ProjectsService(db as never)

    await expect(service.list('user-1')).resolves.toEqual([project])
    expect(db.execute).toHaveBeenCalledTimes(1)
  })

  it('returns no projects when list is called without a user id', async () => {
    const db = { execute: mock(async () => ({ rows: [{ id: 'project-1' }] })) }
    const service = new ProjectsService(db as never)

    await expect(service.list()).resolves.toEqual([])
    expect(db.execute).not.toHaveBeenCalled()
  })

  it('creates a personal organization when creating a first project without an organization id', async () => {
    const createdProject = { id: 'project-1', name: 'App' }
    const execute = mock(async () => {
      const callNumber = execute.mock.calls.length
      if (callNumber === 1) return { rows: [] }
      if (callNumber === 2) return { rows: [{ id: 'org-1' }] }
      if (callNumber === 3) return { rows: [createdProject] }
      return { rows: [] }
    })
    const db = { execute }
    const service = new ProjectsService(db as never)

    await expect(service.create({ name: 'App', slug: 'app' }, 'user-1')).resolves.toEqual([createdProject])

    expect(execute).toHaveBeenCalledTimes(4)
  })

  it('uses the provided organization id when the creator can create projects there', async () => {
    const createdProject = { id: 'project-1', name: 'App', organizationId: 'org-1' }
    const execute = mock(async () => {
      const callNumber = execute.mock.calls.length
      if (callNumber === 1) return { rows: [{ id: 'org-1' }] }
      if (callNumber === 2) return { rows: [createdProject] }
      return { rows: [] }
    })
    const db = { execute }
    const service = new ProjectsService(db as never)

    await expect(service.create({ name: 'App', slug: 'app', organizationId: 'org-1' }, 'user-1')).resolves.toEqual([
      createdProject,
    ])

    expect(execute).toHaveBeenCalledTimes(3)
  })

  it('adds the creator as project owner when creating a project', async () => {
    const createdProject = { id: 'project-1', name: 'App' }
    const db = {
      execute: mock(async () => {
        const callNumber = db.execute.mock.calls.length
        if (callNumber === 1) return { rows: [{ id: 'org-1' }] }
        if (callNumber === 2) return { rows: [createdProject] }
        return { rows: [] }
      }),
    }
    const service = new ProjectsService(db as never)

    await expect(service.create({ name: 'App', slug: 'app' }, 'user-1')).resolves.toEqual([createdProject])

    expect(db.execute).toHaveBeenCalledTimes(3)
  })

  it('rotates a project DSN token and returns the updated project', async () => {
    const updatedProject = { id: 'project-1', dsnToken: 'new-token' }
    const setValues: Record<string, unknown>[] = []
    const db = {
      update: () => ({
        set: (values: Record<string, unknown>) => {
          setValues.push(values)
          return {
            where: () => ({
              returning: mock(async () => [updatedProject]),
            }),
          }
        },
      }),
    }
    const service = new ProjectsService(db as never)

    await expect(service.rotateToken('project-1')).resolves.toEqual([updatedProject])

    expect(setValues).toHaveLength(1)
    expect(typeof setValues[0].dsnToken).toBe('string')
    expect((setValues[0].dsnToken as string).length).toBe(40)
    expect(setValues[0].dsnToken).not.toBe('old-token')
  })

  it('updates project AI analysis opt-in state', async () => {
    const updatedProject = { id: 'project-1', aiAnalysisEnabled: true }
    const setValues: Record<string, unknown>[] = []
    const db = {
      update: () => ({
        set: (values: Record<string, unknown>) => {
          setValues.push(values)
          return {
            where: () => ({
              returning: mock(async () => [updatedProject]),
            }),
          }
        },
      }),
    }
    const service = new ProjectsService(db as never)

    await expect(service.updateAiAnalysisEnabled('project-1', true)).resolves.toEqual([updatedProject])

    expect(setValues).toEqual([{ aiAnalysisEnabled: true }])
  })
})
