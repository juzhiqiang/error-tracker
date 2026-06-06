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

const DEFAULT_AUTH_SECRETS = new Set(['change-me', 'change-me-use-openssl-rand-base64-32'])

export function resolveLocalEnvPath(cwd = process.cwd()): string {
  const normalized = normalize(cwd)
  return normalized.endsWith(normalize('apps/api')) || normalized.endsWith('api')
    ? join(normalized, '../../.env.local')
    : join(normalized, '.env.local')
}

export function parseCorsOrigins(origin: string | undefined): string[] {
  return (origin ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
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

  if (env.NODE_ENV !== 'production') {
    return
  }

  const corsOrigins = parseCorsOrigins(env.CORS_ORIGIN)
  if (corsOrigins.includes('*')) {
    throw new Error('CORS_ORIGIN cannot be wildcard in production')
  }
  if (corsOrigins.some((origin) => !origin.startsWith('https://'))) {
    throw new Error('CORS_ORIGIN must use https in production')
  }
  if (!env.BETTER_AUTH_URL?.startsWith('https://')) {
    throw new Error('BETTER_AUTH_URL must use https in production')
  }
  if ((env.BETTER_AUTH_SECRET ?? '').length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be at least 32 characters in production')
  }
  if (DEFAULT_AUTH_SECRETS.has(env.BETTER_AUTH_SECRET ?? '')) {
    throw new Error('BETTER_AUTH_SECRET cannot use a default value in production')
  }
}

export function loadAndValidateApiEnv(cwd = process.cwd(), env: ApiEnv = process.env): void {
  loadLocalEnv(cwd)
  validateApiEnv(env)
}
