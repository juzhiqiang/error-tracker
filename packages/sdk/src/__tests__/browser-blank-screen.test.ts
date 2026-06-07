import { describe, expect, it } from 'bun:test'
import { BrowserBlankScreenIntegration } from '../integrations/browser-blank-screen'
import type { ErrorTrackerClient } from '../core/client'

describe('BrowserBlankScreenIntegration', () => {
  it('reports a blank screen when at least 80 percent of the default 9 sample points are blank', async () => {
    const elementsFromPointCalls: Array<[number, number]> = []
    const rootElement = fakeElement('div', 'root')
    const contentElement = fakeElement('main')
    const documentStub = {
      elementsFromPoint: (x: number, y: number) => {
        elementsFromPointCalls.push([x, y])
        return elementsFromPointCalls.length <= 8 ? [rootElement] : [contentElement]
      },
    }
    const windowStub = { innerWidth: 900, innerHeight: 600 }
    const messages: Array<{ message: string; level: string; options?: Record<string, unknown> }> = []
    const client = {
      captureMessage: (message: string, level: string, options?: Record<string, unknown>) => {
        messages.push({ message, level, options })
      },
    } as unknown as ErrorTrackerClient

    new BrowserBlankScreenIntegration({ delayMs: 0 }).setup(client, {
      document: documentStub as unknown as Document,
      window: windowStub as unknown as Window,
    })
    await nextTick()

    expect(elementsFromPointCalls).toHaveLength(9)
    expect(messages).toEqual([
      {
        message: 'Blank screen detected',
        level: 'warning',
        options: {
          fingerprint: 'blank-screen',
          tags: {
            mechanism: 'blank-screen',
            blankPoints: '8',
            samplePoints: '9',
            threshold: '0.8',
          },
        },
      },
    ])
  })

  it('does not report when fewer than 80 percent of sample points are blank', async () => {
    const elementsFromPointCalls: Array<[number, number]> = []
    const rootElement = fakeElement('div', 'root')
    const contentElement = fakeElement('main')
    const documentStub = {
      elementsFromPoint: (x: number, y: number) => {
        elementsFromPointCalls.push([x, y])
        return elementsFromPointCalls.length <= 7 ? [rootElement] : [contentElement]
      },
    }
    const windowStub = { innerWidth: 900, innerHeight: 600 }
    const messages: Array<{ message: string; level: string }> = []
    const client = {
      captureMessage: (message: string, level: string) => {
        messages.push({ message, level })
      },
    } as unknown as ErrorTrackerClient

    new BrowserBlankScreenIntegration({ delayMs: 0 }).setup(client, {
      document: documentStub as unknown as Document,
      window: windowStub as unknown as Window,
    })
    await nextTick()

    expect(elementsFromPointCalls).toHaveLength(9)
    expect(messages).toEqual([])
  })
})

function fakeElement(tagName: string, id = ''): Element {
  return {
    tagName: tagName.toUpperCase(),
    id,
    matches: (selector: string) => {
      if (selector === 'html') return tagName.toLowerCase() === 'html'
      if (selector === 'body') return tagName.toLowerCase() === 'body'
      if (!id || !selector.startsWith('#')) return false
      return selector
        .split(',')
        .map((part) => part.trim())
        .includes(`#${id}`)
    },
  } as unknown as Element
}

async function nextTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}
