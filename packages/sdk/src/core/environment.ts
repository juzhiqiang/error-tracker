export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline' | 'unknown'
export type PerformanceTier = 'high' | 'medium' | 'low' | 'unknown'

interface ConnectionLike {
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
}

interface NavigatorLike {
  userAgent?: string
  platform?: string
  language?: string
  languages?: readonly string[]
  cookieEnabled?: boolean
  hardwareConcurrency?: number
  deviceMemory?: number
  maxTouchPoints?: number
  onLine?: boolean
  connection?: ConnectionLike
  storage?: {
    estimate?: () => Promise<StorageEstimateLike>
    persisted?: () => Promise<boolean>
  }
}

interface ScreenLike {
  width?: number
  height?: number
  availWidth?: number
  availHeight?: number
  colorDepth?: number
  orientation?: { type?: string }
}

interface WindowLike {
  innerWidth?: number
  innerHeight?: number
  devicePixelRatio?: number
  screen?: ScreenLike
  localStorage?: unknown
  sessionStorage?: unknown
  indexedDB?: unknown
}

interface DocumentLike {
  referrer?: string
  visibilityState?: string
}

interface LocationLike {
  href?: string
}

interface StorageEstimateLike {
  quota?: number
  usage?: number
}

export interface EnvironmentSources {
  useGlobals?: boolean
  navigator?: NavigatorLike
  window?: WindowLike
  document?: DocumentLike
  location?: LocationLike
  storageEstimate?: StorageEstimateLike
  storagePersisted?: boolean
  now?: () => number
  timezone?: string
  timezoneOffset?: number
}

export interface EnvironmentSnapshot {
  collectedAt: number
  userAgent: {
    raw: string
    browser: { name: string; version?: string }
    os: { name: string; version?: string }
    device: { type: DeviceType; vendor?: string; model?: string }
    engine: { name: string; version?: string }
  }
  device: {
    platform?: string
    cpuCores?: number
    memoryGb?: number
    touchPoints?: number
    screen?: {
      width?: number
      height?: number
      availWidth?: number
      availHeight?: number
      pixelRatio?: number
      colorDepth?: number
      orientation?: string
    }
    viewport?: {
      width?: number
      height?: number
    }
  }
  network: {
    online?: boolean
    effectiveType?: string
    downlinkMbps?: number
    rttMs?: number
    saveData?: boolean
    quality: NetworkQuality
  }
  performance: {
    tier: PerformanceTier
    score?: number
    reasons: string[]
  }
  storage: {
    cookies: boolean
    localStorage: boolean
    sessionStorage: boolean
    indexedDB: boolean
    persisted?: boolean
    quotaBytes?: number
    usageBytes?: number
    usageRatio?: number
  }
  locale: {
    language?: string
    languages: string[]
    timezone?: string
    timezoneOffsetMinutes?: number
  }
  page: {
    url?: string
    referrer?: string
    visibilityState?: string
  }
}

export class EnvironmentCollector {
  static collect(sources: EnvironmentSources = {}): EnvironmentSnapshot {
    sources = { ...(sources.useGlobals === false ? {} : readGlobalSources()), ...sources }
    const nav = sources.navigator
    const win = sources.window
    const ua = nav?.userAgent ?? ''
    const network = collectNetwork(nav?.connection, nav?.onLine)
    const performance = classifyPerformance(nav?.hardwareConcurrency, nav?.deviceMemory, network.quality)

    return {
      collectedAt: sources.now?.() ?? Date.now(),
      userAgent: parseUserAgent(ua, nav?.platform, nav?.maxTouchPoints),
      device: {
        platform: nav?.platform,
        cpuCores: finiteNumber(nav?.hardwareConcurrency),
        memoryGb: finiteNumber(nav?.deviceMemory),
        touchPoints: finiteNumber(nav?.maxTouchPoints),
        screen: collectScreen(win),
        viewport: collectViewport(win),
      },
      network,
      performance,
      storage: {
        cookies: nav?.cookieEnabled === true,
        localStorage: hasStorage(win, 'localStorage'),
        sessionStorage: hasStorage(win, 'sessionStorage'),
        indexedDB: hasStorage(win, 'indexedDB'),
        persisted: typeof sources.storagePersisted === 'boolean' ? sources.storagePersisted : undefined,
        quotaBytes: finiteNumber(sources.storageEstimate?.quota),
        usageBytes: finiteNumber(sources.storageEstimate?.usage),
        usageRatio: calculateUsageRatio(sources.storageEstimate),
      },
      locale: {
        language: nav?.language,
        languages: Array.from(nav?.languages ?? []),
        timezone: sources.timezone ?? safeTimezone(),
        timezoneOffsetMinutes: finiteNumber(sources.timezoneOffset ?? new Date().getTimezoneOffset()),
      },
      page: {
        url: sources.location?.href,
        referrer: sources.document?.referrer,
        visibilityState: sources.document?.visibilityState,
      },
    }
  }
}

function readGlobalSources(): EnvironmentSources {
  const globalWindow = typeof window !== 'undefined' ? window : undefined
  const globalNavigator = typeof navigator !== 'undefined' ? navigator : undefined
  const globalDocument = typeof document !== 'undefined' ? document : undefined
  const globalLocation = typeof location !== 'undefined' ? location : undefined

  return {
    navigator: globalNavigator as NavigatorLike | undefined,
    window: globalWindow as WindowLike | undefined,
    document: globalDocument as DocumentLike | undefined,
    location: globalLocation as LocationLike | undefined,
  }
}

function parseUserAgent(raw: string, platform?: string, touchPoints = 0): EnvironmentSnapshot['userAgent'] {
  return {
    raw,
    browser: parseBrowser(raw),
    os: parseOs(raw, platform),
    device: parseDevice(raw, platform, touchPoints),
    engine: parseEngine(raw),
  }
}

function parseBrowser(ua: string): { name: string; version?: string } {
  const edge = matchVersion(ua, /Edg\/([\d.]+)/)
  if (edge) return { name: 'Edge', version: edge }
  const chrome = matchVersion(ua, /Chrome\/([\d.]+)/)
  if (chrome && !/Chromium|OPR\//.test(ua)) return { name: 'Chrome', version: chrome }
  const firefox = matchVersion(ua, /Firefox\/([\d.]+)/)
  if (firefox) return { name: 'Firefox', version: firefox }
  const safari = matchVersion(ua, /Version\/([\d.]+).*Safari\//)
  if (safari) return { name: 'Safari', version: safari }
  const opera = matchVersion(ua, /OPR\/([\d.]+)/)
  if (opera) return { name: 'Opera', version: opera }
  return { name: 'Unknown' }
}

function parseOs(ua: string, platform?: string): { name: string; version?: string } {
  const windows = matchVersion(ua, /Windows NT ([\d.]+)/)
  if (windows) return { name: 'Windows', version: windows }
  const ios = matchVersion(ua, /OS ([\d_]+) like Mac OS X/)
  if (/iPhone|iPad|iPod/.test(ua) && ios) return { name: 'iOS', version: ios.replace(/_/g, '.') }
  const android = matchVersion(ua, /Android ([\d.]+)/)
  if (android) return { name: 'Android', version: android }
  const mac = matchVersion(ua, /Mac OS X ([\d_]+)/)
  if (mac) return { name: 'macOS', version: mac.replace(/_/g, '.') }
  if (/Linux/.test(ua) || /Linux/.test(platform ?? '')) return { name: 'Linux' }
  return { name: 'Unknown' }
}

function parseDevice(ua: string, platform?: string, touchPoints = 0): EnvironmentSnapshot['userAgent']['device'] {
  if (/bot|crawler|spider|crawling/i.test(ua)) return { type: 'bot' }
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return { type: 'tablet', vendor: vendorFromUa(ua) }
  if (/iPhone|iPod|Mobile|Android/i.test(ua)) return { type: 'mobile', vendor: vendorFromUa(ua) }
  if (/Mac/.test(platform ?? '') && touchPoints > 1) return { type: 'tablet', vendor: 'Apple', model: 'iPad' }
  if (ua || platform) return { type: 'desktop', vendor: vendorFromUa(ua) }
  return { type: 'unknown' }
}

function parseEngine(ua: string): { name: string; version?: string } {
  const webkit = matchVersion(ua, /AppleWebKit\/([\d.]+)/)
  if (webkit) return { name: 'WebKit', version: webkit }
  const gecko = matchVersion(ua, /Gecko\/([\d.]+)/)
  if (gecko && /Firefox\//.test(ua)) return { name: 'Gecko', version: gecko }
  return { name: 'Unknown' }
}

function collectNetwork(connection?: ConnectionLike, online?: boolean): EnvironmentSnapshot['network'] {
  const quality = classifyNetwork(connection, online)
  return {
    online,
    effectiveType: connection?.effectiveType,
    downlinkMbps: finiteNumber(connection?.downlink),
    rttMs: finiteNumber(connection?.rtt),
    saveData: connection?.saveData,
    quality,
  }
}

function classifyNetwork(connection?: ConnectionLike, online?: boolean): NetworkQuality {
  if (online === false) return 'offline'
  if (!connection) return 'unknown'

  const effectiveType = connection.effectiveType?.toLowerCase()
  const downlink = connection.downlink
  const rtt = connection.rtt

  if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'poor'
  if ((rtt !== undefined && rtt >= 700) || (downlink !== undefined && downlink < 0.8)) return 'poor'
  if (effectiveType === '3g' || (rtt !== undefined && rtt >= 300) || (downlink !== undefined && downlink < 2)) return 'fair'
  if (effectiveType === '4g' && (downlink ?? 0) >= 10 && (rtt ?? 999) <= 100) return 'excellent'
  if ((downlink !== undefined && downlink >= 2) || effectiveType === '4g') return 'good'
  return 'unknown'
}

function classifyPerformance(cpuCores?: number, memoryGb?: number, networkQuality?: NetworkQuality): EnvironmentSnapshot['performance'] {
  const reasons: string[] = []
  let score = 0
  let signals = 0

  if (cpuCores !== undefined) {
    signals += 1
    if (cpuCores >= 8) score += 2
    else if (cpuCores >= 4) score += 1
    else reasons.push('low_cpu')
  }

  if (memoryGb !== undefined) {
    signals += 1
    if (memoryGb >= 8) score += 2
    else if (memoryGb >= 4) score += 1
    else reasons.push('low_memory')
  }

  if (networkQuality && networkQuality !== 'unknown') {
    signals += 1
    if (networkQuality === 'excellent' || networkQuality === 'good') score += 1
    if (networkQuality === 'poor' || networkQuality === 'offline') reasons.push(`network_${networkQuality}`)
  }

  if (signals === 0) return { tier: 'unknown', reasons }
  if (reasons.length > 0 && score <= 2) return { tier: 'low', score, reasons }
  if (score >= 5) return { tier: 'high', score, reasons }
  return { tier: 'medium', score, reasons }
}

function collectScreen(win?: WindowLike): EnvironmentSnapshot['device']['screen'] | undefined {
  const screen = win?.screen
  if (!screen) return undefined
  return {
    width: finiteNumber(screen.width),
    height: finiteNumber(screen.height),
    availWidth: finiteNumber(screen.availWidth),
    availHeight: finiteNumber(screen.availHeight),
    pixelRatio: finiteNumber(win?.devicePixelRatio),
    colorDepth: finiteNumber(screen.colorDepth),
    orientation: screen.orientation?.type,
  }
}

function collectViewport(win?: WindowLike): EnvironmentSnapshot['device']['viewport'] | undefined {
  if (win?.innerWidth === undefined && win?.innerHeight === undefined) return undefined
  return {
    width: finiteNumber(win.innerWidth),
    height: finiteNumber(win.innerHeight),
  }
}

function hasStorage(win: WindowLike | undefined, key: 'localStorage' | 'sessionStorage' | 'indexedDB'): boolean {
  try {
    return win?.[key] !== undefined && win?.[key] !== null
  } catch {
    return false
  }
}

function matchVersion(ua: string, pattern: RegExp): string | undefined {
  return pattern.exec(ua)?.[1]
}

function vendorFromUa(ua: string): string | undefined {
  if (/iPhone|iPad|iPod|Macintosh/.test(ua)) return 'Apple'
  if (/Samsung/i.test(ua)) return 'Samsung'
  if (/Huawei/i.test(ua)) return 'Huawei'
  if (/Pixel/i.test(ua)) return 'Google'
  return undefined
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function calculateUsageRatio(estimate?: StorageEstimateLike): number | undefined {
  const quota = finiteNumber(estimate?.quota)
  const usage = finiteNumber(estimate?.usage)
  if (quota === undefined || quota <= 0 || usage === undefined || usage < 0) return undefined
  return usage / quota
}

function safeTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}
