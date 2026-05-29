import { Module, Global } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export const DB = Symbol('DB')

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: () => {
        const client = postgres(process.env.DATABASE_URL!)
        return drizzle(client, { schema })
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
