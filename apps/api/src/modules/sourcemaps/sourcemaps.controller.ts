import { Controller, Post, Delete, Param, UploadedFiles, UseInterceptors, UseGuards, Req } from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { SourceMapsService } from './sourcemaps.service'
import { SessionGuard } from '../../common/guards/session.guard'
import { ProjectAccessGuard } from '../access/project-access.guard'
import { ProjectRoles } from '../access/project-roles.decorator'
import { AuditLogService } from '../audit/audit-log.service'

type SessionRequest = { session?: { user?: { id?: string } } }

@Controller('api/sourcemaps')
@UseGuards(SessionGuard, ProjectAccessGuard)
export class SourceMapsController {
  constructor(
    private readonly sourceMapsService: SourceMapsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post(':projectId/:release')
  @ProjectRoles('owner', 'admin')
  @UseInterceptors(FilesInterceptor('files'))
  async upload(
    @Param('projectId') projectId: string,
    @Param('release') release: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: SessionRequest,
  ) {
    await Promise.all(files.map((f) => this.sourceMapsService.upload(projectId, release, f.originalname, f.buffer)))
    await this.auditLogService.record({
      actorUserId: req.session?.user?.id ?? null,
      projectId,
      action: 'sourcemap.uploaded',
      targetType: 'sourcemap',
      targetId: release,
      metadata: { files: files.map((f) => f.originalname) },
    })
    return { uploaded: files.length }
  }

  @Delete(':projectId/:release')
  @ProjectRoles('owner', 'admin')
  async delete(@Param('projectId') projectId: string, @Param('release') release: string, @Req() req: SessionRequest) {
    const result = await this.sourceMapsService.delete(projectId, release)
    await this.auditLogService.record({
      actorUserId: req.session?.user?.id ?? null,
      projectId,
      action: 'sourcemap.deleted',
      targetType: 'sourcemap',
      targetId: release,
      metadata: null,
    })
    return result
  }
}
