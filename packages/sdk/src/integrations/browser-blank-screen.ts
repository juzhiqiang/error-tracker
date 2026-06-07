import type { ErrorTrackerClient } from '../core/client'
import type { BlankScreenOptions, Integration } from '../types'

interface BrowserBlankScreenDependencies {
  document?: Document
  window?: Window
}

const DEFAULT_SAMPLE_POINT_COUNT = 9
const DEFAULT_THRESHOLD = 0.8
const DEFAULT_DELAY_MS = 3000
const DEFAULT_BLANK_SELECTORS = ['html', 'body', '#root', '#__next', '#app']
const IGNORED_TAGS = new Set(['html', 'body', 'script', 'style', 'meta', 'link', 'title'])

export class BrowserBlankScreenIntegration implements Integration {
  name = 'BrowserBlankScreen'
  private timer?: ReturnType<typeof setTimeout>
  private reported = false

  constructor(private readonly options: BlankScreenOptions = {}) {}

  setup(client: ErrorTrackerClient, deps: BrowserBlankScreenDependencies = {}): void {
    const doc = deps.document ?? globalThis.document
    const win = deps.window ?? globalThis.window
    if (!doc || !win || typeof doc.elementsFromPoint !== 'function') return

    const delayMs = finiteNumber(this.options.delayMs, DEFAULT_DELAY_MS)
    this.timer = setTimeout(() => {
      if (this.reported || doc.visibilityState === 'hidden') return
      const result = inspectBlankScreen(doc, win, this.options)
      if (!result.isBlank) return
      this.reported = true
      client.captureMessage('Blank screen detected', 'warning', {
        fingerprint: 'blank-screen',
        tags: {
          mechanism: 'blank-screen',
          blankPoints: String(result.blankPoints),
          samplePoints: String(result.samplePoints),
          threshold: String(result.threshold),
        },
      })
    }, Math.max(0, delayMs))
  }

  teardown(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
  }
}

export function inspectBlankScreen(
  doc: Pick<Document, 'elementsFromPoint'>,
  win: Pick<Window, 'innerWidth' | 'innerHeight'>,
  options: BlankScreenOptions = {},
): { isBlank: boolean; blankPoints: number; samplePoints: number; threshold: number } {
  const samplePointCount = positiveInteger(options.samplePointCount, DEFAULT_SAMPLE_POINT_COUNT)
  const threshold = clamp(finiteNumber(options.threshold, DEFAULT_THRESHOLD), 0, 1)
  const points = createSamplePoints(win.innerWidth, win.innerHeight, samplePointCount)
  if (points.length === 0) {
    return { isBlank: false, blankPoints: 0, samplePoints: 0, threshold }
  }

  const blankSelectors = options.blankSelectors?.length ? options.blankSelectors : DEFAULT_BLANK_SELECTORS
  const blankPoints = points.filter(([x, y]) => isBlankPoint(doc.elementsFromPoint(x, y), blankSelectors)).length

  return {
    isBlank: blankPoints / points.length >= threshold,
    blankPoints,
    samplePoints: points.length,
    threshold,
  }
}

function createSamplePoints(width: number, height: number, samplePointCount: number): Array<[number, number]> {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return []

  const columns = Math.ceil(Math.sqrt(samplePointCount))
  const rows = Math.ceil(samplePointCount / columns)
  const points: Array<[number, number]> = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if (points.length >= samplePointCount) return points
      points.push([
        Math.round(((column + 1) * width) / (columns + 1)),
        Math.round(((row + 1) * height) / (rows + 1)),
      ])
    }
  }
  return points
}

function isBlankPoint(elements: Element[], blankSelectors: string[]): boolean {
  if (elements.length === 0) return true
  return !elements.some((element) => !isBlankElement(element, blankSelectors))
}

function isBlankElement(element: Element, blankSelectors: string[]): boolean {
  const tagName = element.tagName.toLowerCase()
  if (IGNORED_TAGS.has(tagName)) return true
  return blankSelectors.some((selector) => safeMatches(element, selector))
}

function safeMatches(element: Element, selector: string): boolean {
  try {
    return element.matches(selector)
  } catch {
    return false
  }
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
