import { Module } from '@nestjs/common'
import { SourceMapsController } from './sourcemaps.controller'
import { SourceMapsService } from './sourcemaps.service'
import { MinioService } from './minio.service'
import { AccessModule } from '../access/access.module'

@Module({
  imports: [AccessModule],
  controllers: [SourceMapsController],
  providers: [SourceMapsService, MinioService],
  exports: [MinioService, SourceMapsService],
})
export class SourceMapsModule {}
