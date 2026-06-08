import { describe, expect, it } from 'bun:test'
import { welcomeCapabilities, welcomeWorkflowSteps, welcomePreviewRows } from './welcome-tour'

describe('welcome product tour content', () => {
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

  it('uses dashboard preview rows with severity, status, and owner context', () => {
    expect(welcomePreviewRows).toHaveLength(3)
    expect(welcomePreviewRows[0]).toEqual({
      titleKey: 'welcome.preview.row.checkout',
      metaKey: 'welcome.preview.row.checkoutMeta',
      severity: 'fatal',
      owner: 'on-call-web',
      statusKey: 'welcome.preview.status.regressed',
    })
  })
})
