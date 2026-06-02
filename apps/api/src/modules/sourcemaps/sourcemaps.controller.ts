import { Controller, Post, Delete, Param, UploadedFiles, UseInterceptors, UseGuards } from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { SourceMapsService } from './sourcemaps.service'
import { SessionGuard } from '../../common/guards/session.guard'
import { ProjectAccessGuard } from '../access/project-access.guard'
import { ProjectRoles } from '../access/project-roles.decorator'

@Controller('api/sourcemaps')
@UseGuards(SessionGuard, ProjectAccessGuard)
export class SourceMapsController {
  constructor(private readonly sourceMapsService: SourceMapsService) {}

  @Post(':projectId/:release')
  @ProjectRoles('owner', 'admin')
  @UseInterceptors(FilesInterceptor('files'))
  async upload(
    @Param('projectId') projectId: string,
    @Param('release') release: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    await Promise.all(files.map((f) => this.sourceMapsService.upload(projectId, release, f.originalname, f.buffer)))
    return { uploaded: files.length }
  }

  @Delete(':projectId/:release')
  @ProjectRoles('owner', 'admin')
  delete(@Param('projectId') projectId: string, @Param('release') release: string) {
    return this.sourceMapsService.delete(projectId, release)
  }
}
