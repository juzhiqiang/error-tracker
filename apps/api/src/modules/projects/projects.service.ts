import { Injectable, Inject } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { projects } from '../../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

@Injectable()
export class ProjectsService {
  constructor(@Inject(DB) private db: PostgresJsDatabase<typeof schema>) {}

  list() {
    return this.db.select().from(projects).orderBy(projects.createdAt)
  }

  create(body: { name: string; slug: string }) {
    const dsnToken = randomBytes(20).toString('hex')
    return this.db.insert(projects).values({ name: body.name, slug: body.slug, dsnToken }).returning()
  }

  rotateToken(projectId: string) {
    const dsnToken = randomBytes(20).toString('hex')
    return this.db.update(projects).set({ dsnToken }).where(eq(projects.id, projectId)).returning()
  }
}
