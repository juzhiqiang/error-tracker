import { afterEach, describe, expect, it, mock } from 'bun:test'
import { ErrorTrackerClient } from '../core/client'
import { NodeErrorsIntegration } from '../integrations/node-errors'

describe('NodeErrorsIntegration', () => {
  const cleanupListeners: Array<() => void> = []

  afterEach(() => {
    for (const cleanup of cleanupListeners.splice(0)) cleanup()
    delete (globalThis as unknown as { fetch?: unknown }).fetch
  })

  it('flushes captured unhandled rejections immediately', async () => {
    const fetchMock = mock(async () => new Response(null, { status: 202 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const before = new Set(process.listeners('unhandledRejection'))

    const client = new ErrorTrackerClient({ dsn: 'http://localhost:3002/ingest/project/token' })
    const integration = new NodeErrorsIntegration()
    integration.setup(client)
    const added = process.listeners('unhandledRejection').filter((listener) => !before.has(listener))
    cleanupListeners.push(() => {
      for (const listener of added) {
        process.removeListener('unhandledRejection', listener)
      }
    })

    process.emit('unhandledRejection', new Error('node sdk flush'), Promise.resolve())
    await new Promise((resolve) => setTimeout(resolve, 25))

    expect(fetchMock.mock.calls).toHaveLength(1)
  })
})
