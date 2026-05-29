import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../db/schema'

// 直接创建 db 实例（Better-Auth 需要在模块初始化前就能用）
const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client, { schema })

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET!,
  // auth handler 挂在 API（3002）上，baseURL 用 API 地址；web（3003）作为可信来源跨域调用
  baseURL: process.env.BETTER_AUTH_API_URL ?? 'http://localhost:3002',
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://localhost:3003'],
})
