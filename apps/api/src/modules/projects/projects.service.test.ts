import { describe, expect, it, mock } from 'bun:test'
import { ProjectsService } from './projects.service'

describe('ProjectsService', () => {
  it('adds the creator as project owner when creating a project', async () => {
    const insertedValues: Record<string, unknown>[] = []
    const createdProject = { id: 'project-1', name: 'App' }
    const db = {
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          insertedValues.push(values)
          if (insertedValues.length === 1) {
            return { returning: mock(async () => [createdProject]) }
          }
          return { onConflictDoNothing: mock(async () => undefined) }
        },
      }),
    }
    const service = new ProjectsService(db as never)

    await expect(service.create({ name: 'App', slug: 'app' }, 'user-1')).resolves.toEqual([createdProject])

    expect(insertedValues[1]).toEqual({ projectId: 'project-1', userId: 'user-1', role: 'owner' })
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
})
