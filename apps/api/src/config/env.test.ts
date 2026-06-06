import { describe, expect, it } from 'bun:test'
import { resolveLocalEnvPath, validateApiEnv } from './env'

const validEnv = {
  DATABASE_URL: 'postgresql://tracker:tracker@localhost:5434/error_tracker',
  BETTER_AUTH_SECRET: 'a-secure-secret-with-more-than-32-characters',
  BETTER_AUTH_URL: 'https://tracker.example.com',
  CORS_ORIGIN: 'https://tracker.example.com',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6380',
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: '9011',
  MINIO_ACCESS_KEY: 'tracker',
  MINIO_SECRET_KEY: 'tracker123',
  MINIO_BUCKET: 'error-tracker',
}

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

describe('production env security', () => {
  it('rejects non-https cors origins in production', () => {
    expect(() =>
      validateApiEnv({
        ...validEnv,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://tracker.example.com,http://admin.example.com',
      }),
    ).toThrow('CORS_ORIGIN must use https in production')
  })

  it('rejects wildcard cors in production', () => {
    expect(() =>
      validateApiEnv({
        ...validEnv,
        NODE_ENV: 'production',
        CORS_ORIGIN: '*',
      }),
    ).toThrow('CORS_ORIGIN cannot be wildcard in production')
  })

  it('rejects non-https auth url in production', () => {
    expect(() =>
      validateApiEnv({
        ...validEnv,
        NODE_ENV: 'production',
        BETTER_AUTH_URL: 'http://tracker.example.com',
      }),
    ).toThrow('BETTER_AUTH_URL must use https in production')
  })

  it('rejects default production auth secrets', () => {
    expect(() =>
      validateApiEnv({
        ...validEnv,
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: 'change-me-use-openssl-rand-base64-32',
      }),
    ).toThrow('BETTER_AUTH_SECRET cannot use a default value in production')
  })

  it('rejects short production auth secrets', () => {
    expect(() =>
      validateApiEnv({
        ...validEnv,
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: 'change-me',
      }),
    ).toThrow('BETTER_AUTH_SECRET must be at least 32 characters in production')
  })
})
