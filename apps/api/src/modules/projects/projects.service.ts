import { Injectable, Inject } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { projectMembers, projects } from '../../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

@Injectable()
export class ProjectsService {
  constructor(@Inject(DB) private db: PostgresJsDatabase<typeof schema>) {}

  list() {
    return this.db.select().from(projects).orderBy(projects.createdAt)
  }

  async create(body: { name: string; slug: string }, ownerUserId?: string) {
    const dsnToken = randomBytes(20).toString('hex')
    const created = await this.db.insert(projects).values({ name: body.name, slug: body.slug, dsnToken }).returning()
    if (ownerUserId && created[0]?.id) {
      await this.db
        .insert(projectMembers)
        .values({ projectId: created[0].id, userId: ownerUserId, role: 'owner' })
        .onConflictDoNothing()
    }
    return created
  }

  rotateToken(projectId: string) {
    const dsnToken = randomBytes(20).toString('hex')
    return this.db.update(projects).set({ dsnToken }).where(eq(projects.id, projectId)).returning()
  }
}
