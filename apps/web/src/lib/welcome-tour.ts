export const welcomeHeroStats = [
  { valueKey: 'welcome.hero.stat.capture.value', labelKey: 'welcome.hero.stat.capture' },
  { valueKey: 'welcome.hero.stat.route.value', labelKey: 'welcome.hero.stat.route' },
  { valueKey: 'welcome.hero.stat.regression.value', labelKey: 'welcome.hero.stat.regression' },
] as const

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
