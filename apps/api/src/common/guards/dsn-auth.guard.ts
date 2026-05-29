import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { projects } from '../../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

@Injectable()
export class DsnAuthGuard implements CanActivate {
  constructor(@Inject(DB) private db: PostgresJsDatabase<typeof schema>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const token = req.params.token as string
    const projectId = req.params.projectId as string

    const [project] = await this.db.select().from(projects).where(eq(projects.dsnToken, token)).limit(1)

    if (!project || project.id !== projectId) {
      throw new UnauthorizedException('Invalid DSN token')
    }

    req.project = project
    return true
  }
}
