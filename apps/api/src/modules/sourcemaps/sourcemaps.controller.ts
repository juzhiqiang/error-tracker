import { Controller, Post, Delete, Param, UploadedFiles, UseInterceptors, UseGuards } from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { SourceMapsService } from './sourcemaps.service'
import { SessionGuard } from '../../common/guards/session.guard'

@Controller('api/sourcemaps')
@UseGuards(SessionGuard)
export class SourceMapsController {
  constructor(private readonly sourceMapsService: SourceMapsService) {}

  @Post(':projectId/:release')
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
  delete(@Param('projectId') projectId: string, @Param('release') release: string) {
    return this.sourceMapsService.delete(projectId, release)
  }
}
