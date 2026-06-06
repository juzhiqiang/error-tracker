import { parseCorsOrigins } from './env'

export function createCorsOriginOption(originEnv: string | undefined) {
  const dashboardOrigins = parseCorsOrigins(originEnv)

  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || dashboardOrigins.includes(origin)) {
      callback(null, true)
      return
    }

    callback(new Error('CORS origin is not allowed'))
  }
}

export function createCorsDelegate(originEnv: string | undefined) {
  const dashboardOrigin = createCorsOriginOption(originEnv)

  return (
    req: { path?: string; url?: string; originalUrl?: string },
    callback: (error: Error | null, options: { origin: boolean | string | typeof dashboardOrigin; credentials: boolean }) => void,
  ) => {
    const path = req.originalUrl ?? req.url ?? req.path ?? ''
    if (path.startsWith('/ingest') || path.startsWith('/api/sourcemaps')) {
      callback(null, { origin: true, credentials: false })
      return
    }

    callback(null, { origin: dashboardOrigin, credentials: true })
  }
}
