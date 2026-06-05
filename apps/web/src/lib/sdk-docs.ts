export interface SdkSetupStep {
  labelKey: string
  href: string
  stepKey: string
  anchor: string
}

export interface SdkDocsSection {
  id: string
  titleKey: string
  descriptionKey: string
}

export const sdkSetupGuide: SdkSetupStep[] = [
  { labelKey: 'settings.step.install', href: '/docs#install-sdk', stepKey: 'settings.step', anchor: 'install-sdk' },
  { labelKey: 'settings.step.init', href: '/docs#init-dsn', stepKey: 'settings.step', anchor: 'init-dsn' },
  { labelKey: 'settings.step.sourcemap', href: '/docs#upload-sourcemap', stepKey: 'settings.step', anchor: 'upload-sourcemap' },
  { labelKey: 'settings.step.webhook', href: '/docs#alert-webhook', stepKey: 'settings.step', anchor: 'alert-webhook' },
]

export const sdkDocsSections: SdkDocsSection[] = [
  { id: 'quick-start', titleKey: 'docs.section.quick.title', descriptionKey: 'docs.section.quick.description' },
  { id: 'install-sdk', titleKey: 'docs.section.install.title', descriptionKey: 'docs.section.install.description' },
  { id: 'init-dsn', titleKey: 'docs.section.init.title', descriptionKey: 'docs.section.init.description' },
  { id: 'capture-context', titleKey: 'docs.section.context.title', descriptionKey: 'docs.section.context.description' },
  { id: 'upload-sourcemap', titleKey: 'docs.section.sourcemap.title', descriptionKey: 'docs.section.sourcemap.description' },
  { id: 'alert-webhook', titleKey: 'docs.section.webhook.title', descriptionKey: 'docs.section.webhook.description' },
  { id: 'verify-ingestion', titleKey: 'docs.section.verify.title', descriptionKey: 'docs.section.verify.description' },
  { id: 'troubleshooting', titleKey: 'docs.section.troubleshooting.title', descriptionKey: 'docs.section.troubleshooting.description' },
]
