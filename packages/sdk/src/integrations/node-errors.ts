import type { Integration } from '../types'
import type { ErrorTrackerClient } from '../core/client'

export class NodeErrorsIntegration implements Integration {
  name = 'NodeErrors'

  setup(client: ErrorTrackerClient): void {
    process.on('uncaughtException', (error: Error) => {
      client.captureException(error)
      setTimeout(() => process.exit(1), 100)
    })

    process.on('unhandledRejection', (reason: unknown) => {
      const error = reason instanceof Error ? reason : new Error(String(reason))
      client.captureException(error)
    })
  }
}
