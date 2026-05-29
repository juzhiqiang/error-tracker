import { Module } from '@nestjs/common'
import { SourceMapsController } from './sourcemaps.controller'
import { SourceMapsService } from './sourcemaps.service'
import { MinioService } from './minio.service'

@Module({
  controllers: [SourceMapsController],
  providers: [SourceMapsService, MinioService],
  exports: [MinioService, SourceMapsService],
})
export class SourceMapsModule {}
