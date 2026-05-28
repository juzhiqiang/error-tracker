import { record } from 'rrweb'
import type { Integration } from '../../types'
import type { ErrorTrackerClient } from '../../core/client'
import { CircularBuffer } from './circular-buffer'
import { uploadReplay } from './upload'

export interface ReplayPluginOptions {
  bufferSeconds?: number
  sampleRate?: number
}

export class ReplayPlugin implements Integration {
  name = 'Replay'
  private buffer: CircularBuffer
  private stopFn?: () => void
  private dsnBase = ''
  private readonly sampleRate: number

  constructor(private readonly opts: ReplayPluginOptions = {}) {
    this.buffer = new CircularBuffer((opts.bufferSeconds ?? 30) * 1000)
    this.sampleRate = opts.sampleRate ?? 1.0
  }

  setup(client: ErrorTrackerClient): void {
    if (Math.random() > this.sampleRate) return

    const dsn = (client as unknown as { options: { dsn: string } }).options?.dsn ?? ''
    const parts = dsn.split('/')
    this.dsnBase = parts.slice(0, -1).join('/')

    this.stopFn = record({
      emit: (event) => this.buffer.push(event as { timestamp: number; type: number; data: unknown }),
      maskAllInputs: true,
      maskTextSelector: '[data-sensitive]',
    })

    const origCapture = client.captureException.bind(client)
    client.captureException = (error: Error, extra?: Record<string, unknown>) => {
      origCapture(error, extra)
      const events = this.buffer.drain()
      if (events.length > 0) {
        const eventId = (extra?.eventId as string | undefined) ?? Date.now().toString()
        uploadReplay(this.dsnBase, eventId, events)
      }
    }
  }

  teardown(): void {
    this.stopFn?.()
  }
}
