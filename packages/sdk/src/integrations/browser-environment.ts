import type { Integration } from '../types'
import type { ErrorTrackerClient } from '../core/client'
import { EnvironmentCollector } from '../core/environment'

export class BrowserEnvironmentIntegration implements Integration {
  name = 'BrowserEnvironment'

  setup(client: ErrorTrackerClient): void {
    client.setContext('environment', EnvironmentCollector.collect())

    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
    if (storage?.estimate || storage?.persisted) {
      Promise.all([
        storage.estimate?.().catch(() => undefined) ?? Promise.resolve(undefined),
        storage.persisted?.().catch(() => undefined) ?? Promise.resolve(undefined),
      ])
        .then(([storageEstimate, storagePersisted]) => {
          client.setContext('environment', EnvironmentCollector.collect({ storageEstimate, storagePersisted }))
        })
        .catch(() => {
          // Storage details are opportunistic; missing quota data should not block event capture.
        })
    }
  }
}
