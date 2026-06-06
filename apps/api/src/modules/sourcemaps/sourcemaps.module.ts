import { Module } from '@nestjs/common'
import { SourceMapsController } from './sourcemaps.controller'
import { SourceMapsService } from './sourcemaps.service'
import { MinioService } from './minio.service'
import { AccessModule } from '../access/access.module'
import { AuditLogModule } from '../audit/audit-log.module'
import { DsnAuthGuard } from '../../common/guards/dsn-auth.guard'

@Module({
  imports: [AccessModule, AuditLogModule],
  controllers: [SourceMapsController],
  providers: [SourceMapsService, MinioService, DsnAuthGuard],
  exports: [MinioService, SourceMapsService],
})
export class SourceMapsModule {}
