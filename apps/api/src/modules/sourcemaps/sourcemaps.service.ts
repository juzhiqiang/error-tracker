import { Injectable, Inject } from '@nestjs/common'
import { createHash } from 'crypto'
import { eq, and } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { sourceMaps } from '../../db/schema'
import { MinioService } from './minio.service'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

export type SourceMapUploadStatus = 'created' | 'updated' | 'unchanged'

export interface SourceMapUploadResult {
  filename: string
  checksum: string
  sizeBytes: number
  status: SourceMapUploadStatus
}

@Injectable()
export class SourceMapsService {
  constructor(
    @Inject(DB) private db: PostgresJsDatabase<typeof schema>,
    private readonly minio: MinioService,
  ) {}

  async upload(
    projectId: string,
    release: string,
    filename: string,
    content: Buffer,
    checksum?: string,
  ): Promise<SourceMapUploadResult> {
    const key = `sourcemaps/${projectId}/${release}/${filename}`
    const finalChecksum = checksum ?? sha256(content)
    const sizeBytes = content.length
    const [existing] = await this.db
      .select()
      .from(sourceMaps)
      .where(and(eq(sourceMaps.projectId, projectId), eq(sourceMaps.release, release), eq(sourceMaps.filename, filename)))
      .limit(1)

    if (existing?.checksum === finalChecksum && existing.sizeBytes === sizeBytes) {
      return { filename, checksum: finalChecksum, sizeBytes, status: 'unchanged' }
    }

    await this.minio.upload(key, content, 'application/json')
    await this.db
      .insert(sourceMaps)
      .values({ projectId, release, filename, storageUrl: key, checksum: finalChecksum, sizeBytes })
      .onConflictDoUpdate({
        target: [sourceMaps.projectId, sourceMaps.release, sourceMaps.filename],
        set: { storageUrl: key, checksum: finalChecksum, sizeBytes },
      })
    return { filename, checksum: finalChecksum, sizeBytes, status: existing ? 'updated' : 'created' }
  }

  async delete(projectId: string, release: string): Promise<void> {
    await this.db.delete(sourceMaps).where(and(eq(sourceMaps.projectId, projectId), eq(sourceMaps.release, release)))
  }
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}
