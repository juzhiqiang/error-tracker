import { describe, expect, it, mock } from 'bun:test'
import { GUARDS_METADATA } from '@nestjs/common/constants'

mock.module('../../common/guards/session.guard', () => ({
  SessionGuard: class SessionGuard {},
}))

mock.module('../../common/guards/dsn-auth.guard', () => ({
  DsnAuthGuard: class DsnAuthGuard {},
}))

mock.module('../access/project-access.guard', () => ({
  ProjectAccessGuard: class ProjectAccessGuard {},
}))

describe('SourceMapsController audit logging', () => {
  it('records source map upload and delete actions', async () => {
    const uploaded = { filename: 'app.js.map', checksum: 'abc', sizeBytes: 2, status: 'created' }
    const sourceMapsService = {
      upload: mock(async () => uploaded),
      delete: mock(async () => undefined),
    }
    const audit = { record: mock(async () => undefined) }
    const { SourceMapsController } = await import('./sourcemaps.controller')
    const controller = new SourceMapsController(sourceMapsService as never, audit as never)
    const req = { session: { user: { id: 'user-1' } } }
    const files = [{ originalname: 'app.js.map', buffer: Buffer.from('{}') }] as Express.Multer.File[]
    const body = { checksums: JSON.stringify([{ filename: 'app.js.map', checksum: 'abc' }]) }

    await expect(controller.upload('project-1', '1.0.0', body, files, req)).resolves.toEqual({
      uploaded: 1,
      files: [uploaded],
    })
    await controller.delete('project-1', '1.0.0', req)

    expect(sourceMapsService.upload.mock.calls[0]).toEqual(['project-1', '1.0.0', 'app.js.map', Buffer.from('{}'), 'abc'])
    expect(audit.record.mock.calls).toEqual([
      [
        {
          actorUserId: 'user-1',
          projectId: 'project-1',
          action: 'sourcemap.uploaded',
          targetType: 'sourcemap',
          targetId: '1.0.0',
          metadata: { files: [uploaded], via: 'console' },
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

  it('uses DSN token guard for CI uploads', async () => {
    const { SourceMapsController } = await import('./sourcemaps.controller')
    const guards = Reflect.getMetadata(GUARDS_METADATA, SourceMapsController.prototype.uploadFromCi) as Array<{
      name: string
    }>

    expect(guards.map((guard) => guard.name)).toEqual(['DsnAuthGuard'])
  })
})
