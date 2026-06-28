import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

function read(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
}

describe('production docker packaging', () => {
  it('defines full and api image targets with matching startup scripts', () => {
    const dockerfile = read('Dockerfile')

    expect(dockerfile).toContain('AS full')
    expect(dockerfile).toContain('AS api')
    expect(dockerfile).toContain('AS api-runtime')
    expect(dockerfile).toContain('AS full-runtime')
    expect(dockerfile).toContain('ARG NEXT_PUBLIC_API_URL=')
    expect(dockerfile).not.toContain('bun --cwd')
    expect(dockerfile).toContain('scripts/docker/start-full.sh')
    expect(dockerfile).toContain('scripts/docker/start-api.sh')
  })

  it('keeps the api target free of web build artifacts', () => {
    const dockerfile = read('Dockerfile')
    const apiTarget = dockerfile.slice(dockerfile.indexOf('FROM api-runtime AS api'), dockerfile.indexOf('FROM full-runtime AS full'))

    expect(apiTarget).not.toContain('apps/web/.next')
    expect(apiTarget).not.toContain('start-full.sh')
  })

  it('ships a production compose file for dependencies and both app profiles', () => {
    const compose = read('docker-compose.prod.yml')

    for (const service of ['postgres:', 'redis:', 'minio:', 'app-full:', 'api:']) {
      expect(compose).toContain(service)
    }

    expect(compose).toContain('target: full')
    expect(compose).toContain('target: api')
    expect(compose).toContain('NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}')
    expect(compose).toContain('error-tracker-prod')
    expect(compose).toContain('error-tracker-api-prod')
  })

  it('documents required runtime environment for production containers', () => {
    const env = read('.env.production.example')

    for (const key of [
      'DATABASE_URL=',
      'REDIS_HOST=',
      'MINIO_ENDPOINT=',
      'NEXT_PUBLIC_API_URL=',
      'BETTER_AUTH_URL=',
      'BETTER_AUTH_SECRET=',
      'CORS_ORIGIN=',
    ]) {
      expect(env).toContain(key)
    }
  })
})
