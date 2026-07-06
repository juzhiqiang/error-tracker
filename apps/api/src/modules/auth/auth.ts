import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { loadAndValidateApiEnv, parseCorsOrigins } from '../../config/env'
import * as schema from '../../db/schema'
import { sendPasswordResetEmail } from './password-reset-email'

loadAndValidateApiEnv()

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client, { schema })
const trustedOrigins = Array.from(
  new Set([process.env.BETTER_AUTH_URL, ...parseCorsOrigins(process.env.CORS_ORIGIN)].filter(Boolean)),
) as string[]

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const delivery = await sendPasswordResetEmail({ user, url })
      if (delivery.status === 'failed') {
        console.error(`Password reset email failed: ${delivery.error}`)
      }
      if (delivery.status === 'not_configured') {
        console.warn('Password reset email skipped because SMTP is not configured.')
      }
    },
    revokeSessionsOnPasswordReset: true,
  },
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_API_URL ?? 'http://localhost:3002',
  trustedOrigins,
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
})
