export interface WebSelfMonitoringEnv {
  NEXT_PUBLIC_ERROR_TRACKER_DSN?: string
  NEXT_PUBLIC_ERROR_TRACKER_SELF_MONITORING_ENABLED?: string
  NEXT_PUBLIC_ERROR_TRACKER_ENVIRONMENT?: string
  NEXT_PUBLIC_ERROR_TRACKER_RELEASE?: string
}

export type WebSelfMonitoringOptions =
  | { enabled: false }
  | {
      enabled: true
      dsn: string
      environment?: string
      release?: string
      tags: Record<string, string>
    }

export function getWebSelfMonitoringOptions(env: WebSelfMonitoringEnv): WebSelfMonitoringOptions {
  const dsn = env.NEXT_PUBLIC_ERROR_TRACKER_DSN?.trim()
  if (!dsn || isExplicitlyDisabled(env.NEXT_PUBLIC_ERROR_TRACKER_SELF_MONITORING_ENABLED)) {
    return { enabled: false }
  }

  const options: WebSelfMonitoringOptions = {
    enabled: true,
    dsn,
    tags: { service: 'web', source: 'self-monitoring' },
  }

  const environment = env.NEXT_PUBLIC_ERROR_TRACKER_ENVIRONMENT?.trim()
  const release = env.NEXT_PUBLIC_ERROR_TRACKER_RELEASE?.trim()
  if (environment) options.environment = environment
  if (release) options.release = release

  return options
}

function isExplicitlyDisabled(value: string | undefined): boolean {
  return ['0', 'false', 'no', 'off'].includes(value?.trim().toLowerCase() ?? '')
}
