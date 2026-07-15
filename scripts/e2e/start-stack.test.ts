import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

const script = readFileSync(new URL('./start-stack.ps1', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

describe('E2E stack log routing', () => {
  it('creates and uses the root logs directory for process output', () => {
    expect(script).toContain('$logsRoot = Join-Path $root "logs"')
    expect(script).toContain('New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null')

    for (const target of [
      'e2e-api.out.log',
      'e2e-api.err.log',
      'e2e-web.out.log',
      'e2e-web.err.log',
    ]) {
      expect(script).toContain(`Join-Path $logsRoot "${target}"`)
    }

    expect(script).not.toMatch(/Join-Path \$root "apps\/(?:api|web)\/e2e\.(?:out|err)\.log"/)
  })
})
