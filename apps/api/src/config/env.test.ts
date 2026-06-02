import { describe, expect, it } from 'bun:test'
import { resolveLocalEnvPath, validateApiEnv } from './env'

describe('API env config', () => {
  it('resolves the repository .env.local from root or apps/api cwd', () => {
    expect(resolveLocalEnvPath('D:/myProject/error-tracker')).toBe('D:\\myProject\\error-tracker\\.env.local')
    expect(resolveLocalEnvPath('D:/myProject/error-tracker/apps/api')).toBe('D:\\myProject\\error-tracker\\.env.local')
  })

  it('throws missing required variable names', () => {
    expect(() => validateApiEnv({ DATABASE_URL: 'postgres://localhost/db' })).toThrow(
      /BETTER_AUTH_SECRET.*BETTER_AUTH_URL.*CORS_ORIGIN.*REDIS_HOST.*REDIS_PORT.*MINIO_ENDPOINT.*MINIO_PORT.*MINIO_ACCESS_KEY.*MINIO_SECRET_KEY.*MINIO_BUCKET/,
    )
  })
})
