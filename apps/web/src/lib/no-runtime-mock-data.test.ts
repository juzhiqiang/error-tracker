import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

function readSource(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
}

const dashboardRuntimeSource = [
  '../app/(dashboard)/page.tsx',
  '../app/(dashboard)/performance/page.tsx',
  '../app/(dashboard)/operations/page.tsx',
  '../app/(dashboard)/issues/[id]/page.tsx',
].map(readSource).join('\n')

const productSurfaceSource = [
  '../app/(dashboard)/docs/page.tsx',
  '../components/welcome-content.tsx',
  './welcome-tour.ts',
  './i18n.tsx',
].map(readSource).join('\n')

const webOnboardingSource = [
  '../app/(dashboard)/page.tsx',
  '../app/(dashboard)/settings/page.tsx',
  '../app/(dashboard)/issues/[id]/page.tsx',
  './i18n.tsx',
].map(readSource).join('\n')

describe('runtime telemetry surfaces', () => {
  it('does not turn failed API calls into empty fake telemetry', () => {
    const forbiddenFallbacks = [
      'catch(() => [])',
      'catch(() => null)',
      'catch(() => emptyFacets)',
      '?? emptySnapshot',
      'const emptySnapshot',
    ]

    for (const value of forbiddenFallbacks) {
      expect(dashboardRuntimeSource).not.toContain(value)
    }
  })

  it('does not present fabricated dashboard telemetry on product surfaces', () => {
    const forbiddenTelemetry = [
      '<strong>24</strong>',
      '<strong>118</strong>',
      '<strong>2.9.4</strong>',
      'welcomePreviewRows',
      'CheckoutButton',
      'cdn.payments.js',
      '12 events',
      '12 \u4e2a\u4e8b\u4ef6',
      '520 ms',
      'on-call-web',
      'frontend-platform',
      'checkout-team',
      '\u6a21\u62df\u6570\u636e',
      '\u5047\u6570\u636e',
      '\u6f14\u793a\u6570\u636e',
      '\u9002\u5408\u6f14\u793a',
      ' for demos ',
    ]

    for (const value of forbiddenTelemetry) {
      expect(productSurfaceSource).not.toContain(value)
    }
  })

  it('keeps Web SDK onboarding visible across setup and verification surfaces', () => {
    const requiredSignals = [
      'settings.webSetup.title',
      'settings.webSetup.copyEnv',
      'settings.webSetup.copySmoke',
      'overview.webSetup.title',
      'overview.webSetup.issueStep',
      'detail.verify.sourcemap',
      'detail.verify.release',
    ]

    for (const value of requiredSignals) {
      expect(webOnboardingSource).toContain(value)
    }
  })
})
