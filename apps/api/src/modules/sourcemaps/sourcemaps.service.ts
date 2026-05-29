import { Injectable, Inject } from '@nestjs/common'
import { eq, and } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { sourceMaps } from '../../db/schema'
import { MinioService } from './minio.service'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

@Injectable()
export class SourceMapsService {
  constructor(
    @Inject(DB) private db: PostgresJsDatabase<typeof schema>,
    private readonly minio: MinioService,
  ) {}

  async upload(projectId: string, release: string, filename: string, content: Buffer): Promise<void> {
    const key = `sourcemaps/${projectId}/${release}/${filename}`
    await this.minio.upload(key, content, 'application/json')
    await this.db.insert(sourceMaps).values({ projectId, release, filename, storageUrl: key }).onConflictDoNothing()
  }

  async delete(projectId: string, release: string): Promise<void> {
    await this.db.delete(sourceMaps).where(and(eq(sourceMaps.projectId, projectId), eq(sourceMaps.release, release)))
  }
}
