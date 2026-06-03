import { describe, expect, it, mock } from 'bun:test'

mock.module('../../common/guards/session.guard', () => ({
  SessionGuard: class SessionGuard {},
}))

describe('SourceMapsController audit logging', () => {
  it('records source map upload and delete actions', async () => {
    const sourceMapsService = {
      upload: mock(async () => undefined),
      delete: mock(async () => undefined),
    }
    const audit = { record: mock(async () => undefined) }
    const { SourceMapsController } = await import('./sourcemaps.controller')
    const controller = new SourceMapsController(sourceMapsService as never, audit as never)
    const req = { session: { user: { id: 'user-1' } } }
    const files = [{ originalname: 'app.js.map', buffer: Buffer.from('{}') }] as Express.Multer.File[]

    await controller.upload('project-1', '1.0.0', files, req)
    await controller.delete('project-1', '1.0.0', req)

    expect(audit.record.mock.calls).toEqual([
      [
        {
          actorUserId: 'user-1',
          projectId: 'project-1',
          action: 'sourcemap.uploaded',
          targetType: 'sourcemap',
          targetId: '1.0.0',
          metadata: { files: ['app.js.map'] },
        },
      ],
      [
        {
          actorUserId: 'user-1',
          projectId: 'project-1',
          action: 'sourcemap.deleted',
          targetType: 'sourcemap',
          targetId: '1.0.0',
          metadata: null,
        },
      ],
    ])
  })
})
