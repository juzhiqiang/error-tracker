import { describe, expect, it, mock } from 'bun:test'
import { ProjectsService } from './projects.service'

describe('ProjectsService', () => {
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
