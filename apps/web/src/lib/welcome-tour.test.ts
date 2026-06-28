import { describe, expect, it } from 'bun:test'
import {
  welcomeCapabilities,
  welcomeHeroStats,
  welcomeWorkflowSteps,
} from './welcome-tour'

describe('welcome product tour content', () => {
  it('leads the flagship hero with three operational proof points', () => {
    expect(welcomeHeroStats.map((item) => item.labelKey)).toEqual([
      'welcome.hero.stat.capture',
      'welcome.hero.stat.route',
      'welcome.hero.stat.regression',
    ])
  })

  it('keeps the tour focused on core investigation capabilities', () => {
    expect(welcomeCapabilities.map((item) => item.titleKey)).toEqual([
      'welcome.capability.capture.title',
      'welcome.capability.group.title',
      'welcome.capability.replay.title',
      'welcome.capability.release.title',
    ])
  })

  it('presents the incident workflow as a closed loop', () => {
    expect(welcomeWorkflowSteps.map((step) => step.labelKey)).toEqual([
      'welcome.workflow.alert',
      'welcome.workflow.triage',
      'welcome.workflow.owner',
      'welcome.workflow.fix',
      'welcome.workflow.regression',
    ])
  })

  it('does not export fabricated dashboard preview rows', async () => {
    const tour = await import('./welcome-tour')

    expect('welcomePreviewRows' in tour).toBe(false)
  })
})
