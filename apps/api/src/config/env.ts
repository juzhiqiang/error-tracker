import { join, normalize } from 'path'

const REQUIRED_API_ENV = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'CORS_ORIGIN',
  'REDIS_HOST',
  'REDIS_PORT',
  'MINIO_ENDPOINT',
  'MINIO_PORT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET',
] as const

export type ApiEnv = Record<string, string | undefined>

export function resolveLocalEnvPath(cwd = process.cwd()): string {
  const normalized = normalize(cwd)
  return normalized.endsWith(normalize('apps/api')) || normalized.endsWith('api')
    ? join(normalized, '../../.env.local')
    : join(normalized, '.env.local')
}

export function loadLocalEnv(cwd = process.cwd()): void {
  try {
    process.loadEnvFile(resolveLocalEnvPath(cwd))
  } catch {
    // .env.local is optional in production where env vars are injected by the platform.
  }
}

export function validateApiEnv(env: ApiEnv = process.env): void {
  const missing = REQUIRED_API_ENV.filter((key) => !env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required API environment variables: ${missing.join(', ')}`)
  }

  for (const key of ['REDIS_PORT', 'MINIO_PORT']) {
    const value = Number(env[key])
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Invalid API environment variable: ${key} must be a positive integer`)
    }
  }
}

export function loadAndValidateApiEnv(cwd = process.cwd(), env: ApiEnv = process.env): void {
  loadLocalEnv(cwd)
  validateApiEnv(env)
}
