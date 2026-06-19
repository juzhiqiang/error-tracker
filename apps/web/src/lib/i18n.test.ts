import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

type Locale = 'en' | 'zh'

const technicalSharedDetailKeys = new Set([
  'detail.workflow.releasePlaceholder',
  'detail.env.rtt',
  'detail.env.indexedDB',
  'detail.env.url',
])

describe('issue detail i18n coverage', () => {
  it('keeps Chinese translations for every issue detail key', () => {
    const { en, zh } = readDictionaries()
    const missing = detailKeys(en).filter((key) => !zh.has(key))

    expect(missing).toEqual([])
  })

  it('does not fall back to English strings for issue detail copy', () => {
    const { en, zh } = readDictionaries()
    const untranslated = detailKeys(en).filter(
      (key) => zh.has(key) && zh.get(key) === en.get(key) && !technicalSharedDetailKeys.has(key),
    )

    expect(untranslated).toEqual([])
  })
})

function readDictionaries() {
  const source = readFileSync(new URL('./i18n.tsx', import.meta.url), 'utf8')
  return {
    en: extractEntries(findLocaleBlock(source, 'en')),
    zh: extractEntries(findLocaleBlock(source, 'zh')),
  }
}

function detailKeys(entries: Map<string, string>) {
  return [...entries.keys()].filter((key) => key.startsWith('detail.')).sort()
}

function extractEntries(block: string) {
  const entries = new Map<string, string>()
  const entryPattern = /'([^']+)':\s*'((?:\\'|[^'])*)'/g
  let match: RegExpExecArray | null

  while ((match = entryPattern.exec(block))) {
    entries.set(match[1], match[2])
  }

  return entries
}

function findLocaleBlock(source: string, locale: Locale) {
  const localeStart = source.indexOf(`  ${locale}: {`)
  if (localeStart === -1) throw new Error(`Could not find ${locale} dictionary`)

  const blockStart = source.indexOf('{', localeStart)
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = blockStart; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === "'") {
        inString = false
      }
      continue
    }

    if (char === "'") {
      inString = true
    } else if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(blockStart, index + 1)
    }
  }

  throw new Error(`Could not parse ${locale} dictionary`)
}
