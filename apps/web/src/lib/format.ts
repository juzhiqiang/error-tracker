export function formatDateTime(value?: string | number | Date | null): string {
  const date = toDate(value)
  if (!date) return '-'
  return date.toLocaleString(formatLocale(), {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatFullDateTime(value?: string | number | Date | null): string {
  const date = toDate(value)
  if (!date) return '-'
  return date.toLocaleString(formatLocale(), {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function formatTime(value?: string | number | Date | null): string {
  const date = toDate(value)
  if (!date) return '-'
  return date.toLocaleTimeString(formatLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function compactNumber(value: number | string | undefined | null): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '0'
  return new Intl.NumberFormat(formatLocale(), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

export function toNumber(value: number | string | undefined | null): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function levelLabel(level?: string): string {
  return (
    {
      fatal: 'Fatal',
      error: 'Error',
      warning: 'Warning',
      info: 'Info',
    }[level ?? ''] ?? 'Unknown'
  )
}

export function statusLabel(status?: string): string {
  return (
    {
      unresolved: 'Unresolved',
      resolved: 'Resolved',
      ignored: 'Ignored',
    }[status ?? ''] ?? 'Unknown'
  )
}

export function ratingLabel(rating?: string): string {
  return (
    {
      good: 'Good',
      'needs-improvement': 'Needs work',
      poor: 'Poor',
    }[rating ?? ''] ?? 'Unknown'
  )
}

export function formatMetricValue(name: string, value: number | string | undefined | null): string {
  const n = toNumber(value)
  if (name === 'CLS') return (n > 10 ? n / 1000 : n).toFixed(3)
  return `${Math.round(n)} ms`
}

export function stringifyRecord(value: unknown): string {
  if (!value) return '-'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function toDate(value?: string | number | Date | null): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatLocale(): string {
  if (typeof window === 'undefined') return 'en-US'
  return localStorage.getItem('error-tracker-locale') === 'zh' ? 'zh-CN' : 'en-US'
}
