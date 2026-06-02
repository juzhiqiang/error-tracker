const DEFAULT_SENSITIVE_FIELD_PATTERNS = ['password', 'token', 'secret', 'authorization', 'cookie']
const FILTERED_VALUE = '[Filtered]'

export function scrubPii<T>(value: T, sensitiveFields = DEFAULT_SENSITIVE_FIELD_PATTERNS): T {
  return scrubValue(value, sensitiveFields) as T
}

function scrubValue(value: unknown, sensitiveFields: string[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, sensitiveFields))
  }

  if (!isRecord(value)) {
    return value
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      isSensitiveField(key, sensitiveFields) ? FILTERED_VALUE : scrubValue(child, sensitiveFields),
    ]),
  )
}

function isSensitiveField(key: string, sensitiveFields: string[]): boolean {
  const normalized = key.toLowerCase()
  return sensitiveFields.some((field) => normalized.includes(field.toLowerCase()))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
