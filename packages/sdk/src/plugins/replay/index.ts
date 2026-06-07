import { record } from 'rrweb'
import type { Integration } from '../../types'
import type { ErrorTrackerClient } from '../../core/client'
import { CircularBuffer } from './circular-buffer'
import { uploadReplay } from './upload'

type ReplayRecordOptions = Parameters<typeof record>[0] & {
  maskAllText?: boolean
  blockSelector?: string
}

export interface ReplayPluginOptions {
  bufferSeconds?: number
  sampleRate?: number
  maskAllText?: boolean
  maskTextSelector?: string
  blockSelector?: string
}

export class ReplayPlugin implements Integration {
  name = 'Replay'
  private buffer: CircularBuffer
  private stopFn?: () => void
  private replayDsn = ''
  private replayToken?: string
  private readonly sampleRate: number

  constructor(private readonly opts: ReplayPluginOptions = {}) {
    this.buffer = new CircularBuffer((opts.bufferSeconds ?? 30) * 1000)
    this.sampleRate = opts.sampleRate ?? 1.0
  }

  setup(client: ErrorTrackerClient): void {
    if (Math.random() > this.sampleRate) return

    const options = (client as unknown as { options: { dsn: string; token?: string } }).options
    this.replayDsn = options?.dsn ?? ''
    this.replayToken = options?.token

    const recordOptions: ReplayRecordOptions = {
      emit: (event) => this.buffer.push(event as { timestamp: number; type: number; data: unknown }),
      maskAllInputs: true,
      maskAllText: this.opts.maskAllText ?? true,
      maskTextSelector: this.opts.maskTextSelector ?? '[data-sensitive]',
      blockSelector: this.opts.blockSelector ?? '[data-sensitive-block],[data-private],[data-privacy="block"]',
    }

    this.stopFn = record(recordOptions)

    const origCapture = client.captureException.bind(client)
    client.captureException = (error: Error, extra?: Record<string, unknown>) => {
      const eventId = origCapture(error, extra)
      const events = this.buffer.drain()
      if (eventId && events.length > 0) {
        uploadReplay(this.replayDsn, eventId, events, this.replayToken)
      }
      return eventId
    }
  }

  teardown(): void {
    this.stopFn?.()
  }
}
