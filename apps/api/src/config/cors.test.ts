import { describe, expect, it } from 'bun:test'
import { createCorsDelegate, createCorsOriginOption } from './cors'

describe('API CORS config', () => {
  it('allows only configured dashboard origins for authenticated APIs', () => {
    const origin = createCorsOriginOption('http://localhost:3003')

    origin('http://localhost:3003', (error, allow) => {
      expect(error).toBeNull()
      expect(allow).toBe(true)
    })

    origin('http://localhost:3013', (error) => {
      expect(error?.message).toBe('CORS origin is not allowed')
    })
  })

  it('allows browser SDK ingest from customer application origins', () => {
    const delegate = createCorsDelegate('http://localhost:3003')

    delegate({ originalUrl: '/ingest/project/token' }, (error, options) => {
      expect(error).toBeNull()
      expect(options).toEqual({ origin: true, credentials: false })
    })
  })

  it('allows CI sourcemap uploads without dashboard credentials', () => {
    const delegate = createCorsDelegate('http://localhost:3003')

    delegate({ originalUrl: '/api/sourcemaps/project/release/ci' }, (error, options) => {
      expect(error).toBeNull()
      expect(options).toEqual({ origin: true, credentials: false })
    })
  })
})
