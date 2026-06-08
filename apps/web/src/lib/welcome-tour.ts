export const welcomeCapabilities = [
  {
    titleKey: 'welcome.capability.capture.title',
    bodyKey: 'welcome.capability.capture.body',
  },
  {
    titleKey: 'welcome.capability.group.title',
    bodyKey: 'welcome.capability.group.body',
  },
  {
    titleKey: 'welcome.capability.replay.title',
    bodyKey: 'welcome.capability.replay.body',
  },
  {
    titleKey: 'welcome.capability.release.title',
    bodyKey: 'welcome.capability.release.body',
  },
] as const

export const welcomeWorkflowSteps = [
  { labelKey: 'welcome.workflow.alert', detailKey: 'welcome.workflow.alertDetail' },
  { labelKey: 'welcome.workflow.triage', detailKey: 'welcome.workflow.triageDetail' },
  { labelKey: 'welcome.workflow.owner', detailKey: 'welcome.workflow.ownerDetail' },
  { labelKey: 'welcome.workflow.fix', detailKey: 'welcome.workflow.fixDetail' },
  { labelKey: 'welcome.workflow.regression', detailKey: 'welcome.workflow.regressionDetail' },
] as const

export const welcomePreviewRows = [
  {
    titleKey: 'welcome.preview.row.checkout',
    metaKey: 'welcome.preview.row.checkoutMeta',
    severity: 'fatal',
    owner: 'on-call-web',
    statusKey: 'welcome.preview.status.regressed',
  },
  {
    titleKey: 'welcome.preview.row.resource',
    metaKey: 'welcome.preview.row.resourceMeta',
    severity: 'error',
    owner: 'frontend-platform',
    statusKey: 'welcome.preview.status.new',
  },
  {
    titleKey: 'welcome.preview.row.inp',
    metaKey: 'welcome.preview.row.inpMeta',
    severity: 'warning',
    owner: 'checkout-team',
    statusKey: 'welcome.preview.status.triage',
  },
] as const
