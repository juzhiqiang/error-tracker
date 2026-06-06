import { describe, expect, it } from 'bun:test'
import { sdkDocsSections, sdkSetupGuide } from './sdk-docs'

describe('SDK docs navigation', () => {
  it('links every settings setup step to the docs route anchors', () => {
    expect(sdkSetupGuide).toEqual([
      { labelKey: 'settings.step.install', href: '/docs#install-sdk', stepKey: 'settings.step', anchor: 'install-sdk' },
      { labelKey: 'settings.step.init', href: '/docs#init-dsn', stepKey: 'settings.step', anchor: 'init-dsn' },
      { labelKey: 'settings.step.sourcemap', href: '/docs#upload-sourcemap', stepKey: 'settings.step', anchor: 'upload-sourcemap' },
      { labelKey: 'settings.step.webhook', href: '/docs#alert-webhook', stepKey: 'settings.step', anchor: 'alert-webhook' },
    ])
  })

  it('keeps docs sections addressable from the setup guide', () => {
    const sectionIds = new Set(sdkDocsSections.map((section) => section.id))

    for (const step of sdkSetupGuide) {
      expect(sectionIds.has(step.anchor)).toBe(true)
    }

    expect(sectionIds.has('verify-ingestion')).toBe(true)
    expect(sectionIds.has('self-monitoring')).toBe(true)
    expect(sectionIds.has('ai-advisor')).toBe(true)
    expect(sectionIds.has('troubleshooting')).toBe(true)
  })
})
