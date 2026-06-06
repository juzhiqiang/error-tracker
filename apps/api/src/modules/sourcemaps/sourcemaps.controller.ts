import { BadRequestException, Body, Controller, Post, Delete, Param, UploadedFiles, UseInterceptors, UseGuards, Req } from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { SourceMapsService } from './sourcemaps.service'
import { SessionGuard } from '../../common/guards/session.guard'
import { DsnAuthGuard } from '../../common/guards/dsn-auth.guard'
import { ProjectAccessGuard } from '../access/project-access.guard'
import { ProjectRoles } from '../access/project-roles.decorator'
import { AuditLogService } from '../audit/audit-log.service'

type SessionRequest = { session?: { user?: { id?: string } } }
type ChecksumUploadBody = { checksums?: string | string[] }
type UploadVia = 'console' | 'ci'

@Controller('api/sourcemaps')
export class SourceMapsController {
  constructor(
    private readonly sourceMapsService: SourceMapsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post(':projectId/:release')
  @ProjectRoles('owner', 'admin')
  @UseGuards(SessionGuard, ProjectAccessGuard)
  @UseInterceptors(FilesInterceptor('files'))
  async upload(
    @Param('projectId') projectId: string,
    @Param('release') release: string,
    @Body() body: ChecksumUploadBody,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: SessionRequest,
  ) {
    return this.uploadFiles(projectId, release, body, files, 'console', req.session?.user?.id ?? null)
  }

  @Post(':projectId/:release/ci')
  @UseGuards(DsnAuthGuard)
  @UseInterceptors(FilesInterceptor('files'))
  async uploadFromCi(
    @Param('projectId') projectId: string,
    @Param('release') release: string,
    @Body() body: ChecksumUploadBody,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.uploadFiles(projectId, release, body, files, 'ci', null)
  }

  @Delete(':projectId/:release')
  @ProjectRoles('owner', 'admin')
  @UseGuards(SessionGuard, ProjectAccessGuard)
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

  private async uploadFiles(
    projectId: string,
    release: string,
    body: ChecksumUploadBody,
    files: Express.Multer.File[] = [],
    via: UploadVia,
    actorUserId: string | null,
  ) {
    const checksums = checksumValues(body, files)
    const uploaded = await Promise.all(
      files.map((file, index) =>
        this.sourceMapsService.upload(projectId, release, file.originalname, file.buffer, checksums[index]),
      ),
    )
    await this.auditLogService.record({
      actorUserId,
      projectId,
      action: 'sourcemap.uploaded',
      targetType: 'sourcemap',
      targetId: release,
      metadata: { files: uploaded, via },
    })
    return { uploaded: uploaded.length, files: uploaded }
  }
}

function checksumValues(body: ChecksumUploadBody, files: Express.Multer.File[]): Array<string | undefined> {
  const raw = body?.checksums
  if (!raw) return []
  const values = Array.isArray(raw) ? raw : [raw]

  if (values.length === 1 && values[0]?.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(values[0]) as Array<string | { filename?: string; checksum?: string }>
      if (parsed.every((item) => typeof item === 'string')) {
        return parsed as string[]
      }
      return files.map((file) => {
        const match = parsed.find((item) => typeof item !== 'string' && item.filename === file.originalname)
        return typeof match === 'string' ? undefined : match?.checksum
      })
    } catch {
      throw new BadRequestException('Invalid checksums payload')
    }
  }

  return values
}
