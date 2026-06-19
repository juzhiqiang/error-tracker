const DEFAULT_SENSITIVE_FIELD_PATTERNS = ['password', 'token', 'secret', 'authorization', 'cookie']
const FILTERED_VALUE = '[Filtered]'
type SensitiveValuePattern = [RegExp, string]
const DEFAULT_SENSITIVE_VALUE_PATTERNS: SensitiveValuePattern[] = [
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[Email]'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+\b/g, '[BearerToken]'],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[Jwt]'],
  [/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{10,}\b/g, '[SecretKey]'],
  [/\b(?:\d[ -]*?){13,19}\b/g, '[CardNumber]'],
  [/([?&](?:password|token|secret|authorization|cookie)=)[^&#]*/gi, '$1[Filtered]'],
]

export interface PiiScrubberOptions {
  sensitiveFields?: string[]
  sensitiveValuePatterns?: SensitiveValuePattern[]
}

export function scrubPii<T>(value: T, optionsOrSensitiveFields: string[] | PiiScrubberOptions = {}): T {
  const options = Array.isArray(optionsOrSensitiveFields)
    ? { sensitiveFields: optionsOrSensitiveFields }
    : optionsOrSensitiveFields
  return scrubValue(value, options.sensitiveFields ?? DEFAULT_SENSITIVE_FIELD_PATTERNS, [
    ...DEFAULT_SENSITIVE_VALUE_PATTERNS,
    ...(options.sensitiveValuePatterns ?? []),
  ]) as T
}

function scrubValue(value: unknown, sensitiveFields: string[], sensitiveValuePatterns: SensitiveValuePattern[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, sensitiveFields, sensitiveValuePatterns))
  }

  if (typeof value === 'string') {
    return scrubText(value, sensitiveValuePatterns)
  }

  if (!isRecord(value)) {
    return value
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      isSensitiveField(key, sensitiveFields) ? FILTERED_VALUE : scrubValue(child, sensitiveFields, sensitiveValuePatterns),
    ]),
  )
}

export function scrubText(value: string, patterns: SensitiveValuePattern[] = DEFAULT_SENSITIVE_VALUE_PATTERNS): string {
  return patterns.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
}

function isSensitiveField(key: string, sensitiveFields: string[]): boolean {
  const normalized = key.toLowerCase()
  return sensitiveFields.some((field) => normalized.includes(field.toLowerCase()))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
