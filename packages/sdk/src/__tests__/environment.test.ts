import { describe, expect, it } from 'bun:test'
import type { ErrorTrackerClient } from '../core/client'
import { EnvironmentCollector } from '../core/environment'
import { Scope } from '../core/scope'
import { BrowserEnvironmentIntegration } from '../integrations/browser-environment'

describe('EnvironmentCollector', () => {
  it('collects detailed browser device and network context', () => {
    const snapshot = EnvironmentCollector.collect({
      navigator: {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        platform: 'Win32',
        language: 'en-US',
        languages: ['en-US', 'zh-CN'],
        cookieEnabled: true,
        hardwareConcurrency: 12,
        deviceMemory: 16,
        maxTouchPoints: 0,
        onLine: true,
        connection: {
          effectiveType: '4g',
          downlink: 24,
          rtt: 35,
          saveData: false,
        },
        storage: {
          persisted: () => Promise.resolve(true),
        },
      },
      window: {
        innerWidth: 1440,
        innerHeight: 900,
        devicePixelRatio: 2,
        localStorage: {},
        sessionStorage: {},
        indexedDB: {},
        screen: {
          width: 2880,
          height: 1800,
          availWidth: 2880,
          availHeight: 1700,
          colorDepth: 30,
          orientation: { type: 'landscape-primary' },
        },
      },
      document: {
        referrer: 'https://example.com/docs',
        visibilityState: 'visible',
      },
      location: {
        href: 'https://app.example.com/issues/1',
      },
      storageEstimate: {
        quota: 128_000_000_000,
        usage: 8_000_000_000,
      },
      storagePersisted: true,
      now: () => 1_700_000_000_000,
      timezone: 'Asia/Shanghai',
      timezoneOffset: -480,
    })

    expect(snapshot.userAgent.browser.name).toBe('Chrome')
    expect(snapshot.userAgent.os.name).toBe('Windows')
    expect(snapshot.userAgent.device.type).toBe('desktop')
    expect(snapshot.device.cpuCores).toBe(12)
    expect(snapshot.device.memoryGb).toBe(16)
    expect(snapshot.device.screen?.width).toBe(2880)
    expect(snapshot.device.viewport?.width).toBe(1440)
    expect(snapshot.network.effectiveType).toBe('4g')
    expect(snapshot.network.quality).toBe('excellent')
    expect(snapshot.performance.tier).toBe('high')
    expect(snapshot.storage.localStorage).toBe(true)
    expect(snapshot.storage.sessionStorage).toBe(true)
    expect(snapshot.storage.indexedDB).toBe(true)
    expect(snapshot.storage.quotaBytes).toBe(128_000_000_000)
    expect(snapshot.storage.usageBytes).toBe(8_000_000_000)
    expect(snapshot.storage.usageRatio).toBe(0.0625)
    expect(snapshot.storage.persisted).toBe(true)
    expect(snapshot.locale.timezone).toBe('Asia/Shanghai')
    expect(snapshot.page.url).toBe('https://app.example.com/issues/1')
  })

  it('classifies constrained devices and weak networks', () => {
    const snapshot = EnvironmentCollector.collect({
      navigator: {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        platform: 'iPhone',
        language: 'zh-CN',
        languages: ['zh-CN'],
        cookieEnabled: false,
        hardwareConcurrency: 2,
        deviceMemory: 2,
        maxTouchPoints: 5,
        onLine: true,
        connection: {
          effectiveType: '2g',
          downlink: 0.3,
          rtt: 900,
          saveData: true,
        },
      },
      window: {},
      document: {},
      location: {},
      now: () => 1_700_000_000_000,
    })

    expect(snapshot.userAgent.browser.name).toBe('Safari')
    expect(snapshot.userAgent.os.name).toBe('iOS')
    expect(snapshot.userAgent.device.type).toBe('mobile')
    expect(snapshot.network.quality).toBe('poor')
    expect(snapshot.performance.tier).toBe('low')
    expect(snapshot.storage.cookies).toBe(false)
  })

  it('falls back safely outside browser environments', () => {
    const snapshot = EnvironmentCollector.collect({
      useGlobals: false,
      now: () => 1_700_000_000_000,
    })

    expect(snapshot.userAgent.raw).toBe('')
    expect(snapshot.userAgent.browser.name).toBe('Unknown')
    expect(snapshot.network.quality).toBe('unknown')
    expect(snapshot.performance.tier).toBe('unknown')
    expect(snapshot.storage.localStorage).toBe(false)
  })
})

describe('BrowserEnvironmentIntegration', () => {
  it('injects compact device and network tags into the client scope', () => {
    const scope = new Scope()
    const context: Record<string, unknown> = {}
    const client = {
      scope,
      setContext: (key: string, value: unknown) => {
        context[key] = value
      },
    } as unknown as ErrorTrackerClient

    new BrowserEnvironmentIntegration().setup(client, {
      navigator: {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        platform: 'Win32',
        hardwareConcurrency: 8,
        deviceMemory: 8,
        onLine: true,
        connection: {
          effectiveType: '4g',
          downlink: 20,
          rtt: 40,
        },
      },
      window: {
        innerWidth: 1440,
        innerHeight: 900,
      },
      document: {
        visibilityState: 'visible',
      },
      now: () => 1_700_000_000_000,
    })

    expect(context.environment).toBeDefined()
    expect(scope.getTags()).toMatchObject({
      'browser.name': 'Chrome',
      'os.name': 'Windows',
      'device.type': 'desktop',
      'network.effectiveType': '4g',
      'network.quality': 'excellent',
      'performance.tier': 'high',
    })
    expect(scope.getTags()['userAgent.raw']).toBeUndefined()
  })
})
