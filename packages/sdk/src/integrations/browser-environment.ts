import type { Integration } from '../types'
import type { ErrorTrackerClient } from '../core/client'
import { EnvironmentCollector } from '../core/environment'
import type { EnvironmentSnapshot, EnvironmentSources } from '../core/environment'

export class BrowserEnvironmentIntegration implements Integration {
  name = 'BrowserEnvironment'

  setup(client: ErrorTrackerClient, sources: EnvironmentSources = {}): void {
    applyEnvironment(client, EnvironmentCollector.collect(sources))

    const storage = sources.navigator?.storage ?? (typeof navigator !== 'undefined' ? navigator.storage : undefined)
    if (storage?.estimate || storage?.persisted) {
      Promise.all([
        storage.estimate?.().catch(() => undefined) ?? Promise.resolve(undefined),
        storage.persisted?.().catch(() => undefined) ?? Promise.resolve(undefined),
      ])
        .then(([storageEstimate, storagePersisted]) => {
          applyEnvironment(client, EnvironmentCollector.collect({ ...sources, storageEstimate, storagePersisted }))
        })
        .catch(() => {
          // Storage details are opportunistic; missing quota data should not block event capture.
        })
    }
  }
}

function applyEnvironment(client: ErrorTrackerClient, snapshot: EnvironmentSnapshot): void {
  client.setContext('environment', snapshot)
  for (const [key, value] of Object.entries(environmentTags(snapshot))) {
    client.scope.setTag(key, value)
  }
}

export function environmentTags(snapshot: EnvironmentSnapshot): Record<string, string> {
  return compactTags({
    'browser.name': snapshot.userAgent.browser.name,
    'os.name': snapshot.userAgent.os.name,
    'device.type': snapshot.userAgent.device.type,
    'network.effectiveType': snapshot.network.effectiveType,
    'network.quality': snapshot.network.quality,
    'performance.tier': snapshot.performance.tier,
  })
}

function compactTags(tags: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tags).filter(([, value]) => value !== undefined && value !== '' && value !== 'Unknown' && value !== 'unknown'),
  ) as Record<string, string>
}
