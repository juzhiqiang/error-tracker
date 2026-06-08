'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Code2,
  Fingerprint,
  GitBranch,
  MousePointerClick,
  RadioTower,
  ShieldCheck,
  Terminal,
  Users,
  Zap,
} from 'lucide-react'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { useI18n } from '@/lib/i18n'
import {
  getSessionDisplayName,
  getSessionInitials,
  getWelcomePrimaryAction,
  type SessionUserSummary,
} from '@/lib/session-ui'
import {
  welcomeCapabilities,
  welcomeHeroStats,
  welcomePreviewRows,
  welcomeWorkflowSteps,
} from '@/lib/welcome-tour'

const capabilityIcons = [RadioTower, Fingerprint, MousePointerClick, GitBranch] as const
const workflowIcons = [BellRing, AlertTriangle, Users, CheckCircle2, Zap] as const

const severityClasses = {
  fatal: 'welcome-severity-fatal',
  error: 'welcome-severity-error',
  warning: 'welcome-severity-warning',
} as const

const stackKeys = [
  'welcome.stack.errors',
  'welcome.stack.breadcrumbs',
  'welcome.stack.replay',
  'welcome.stack.vitals',
  'welcome.stack.release',
  'welcome.stack.workflow',
  'welcome.stack.privacy',
]

export function WelcomeContent({ user }: { user?: SessionUserSummary | null }) {
  const { t } = useI18n()
  const primaryAction = getWelcomePrimaryAction(user)
  const displayName = getSessionDisplayName(user, t('app.signedInUser'))
  const initials = getSessionInitials(user)
  const email = user?.email ?? ''

  return (
    <main className="welcome-page min-h-screen overflow-hidden bg-background text-slate-100">
      <nav className="welcome-nav">
        <Link href="/welcome" className="welcome-brand">
          <span className="welcome-brand-mark">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="welcome-brand-text">Error Tracker</span>
        </Link>
        <div className="welcome-nav-links">
          <a href="#capabilities">{t('welcome.nav.signals')}</a>
          <a href="#workflow">{t('welcome.nav.workflow')}</a>
          <a href="#start">{t('welcome.nav.setup')}</a>
        </div>
        <div className="welcome-nav-actions">
          <div className="welcome-nav-tools">
            <LanguageToggle compact className="welcome-icon-button" />
            <ThemeToggle compact className="welcome-icon-button" />
          </div>
          {user && (
            <div className="welcome-user-chip">
              <span className="welcome-user-avatar">{initials}</span>
              <span className="welcome-user-meta">
                <span>{t('welcome.nav.signedIn')}</span>
                <strong>{displayName}</strong>
                {email && email !== displayName && <em>{email}</em>}
              </span>
            </div>
          )}
          <Link href={primaryAction.href} className="welcome-nav-cta app-button inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold">
            {t(primaryAction.labelKey)}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      <section className="welcome-hero welcome-flagship-hero">
        <div className="welcome-orbit-field" aria-hidden="true">
          <span className="welcome-orbit welcome-orbit-one" />
          <span className="welcome-orbit welcome-orbit-two" />
          <span className="welcome-orbit welcome-orbit-three" />
          <span className="welcome-beam welcome-beam-one" />
          <span className="welcome-beam welcome-beam-two" />
        </div>

        <div className="welcome-hero-copy">
          <div className="welcome-kicker">
            <span />
            {t('welcome.hero.kicker')}
          </div>
          <h1>{t('welcome.hero.title')}</h1>
          <p>{t('welcome.hero.description')}</p>
          <div className="welcome-hero-actions">
            <Link href={primaryAction.href} className="welcome-primary-action app-button inline-flex items-center justify-center gap-2 px-5 text-sm font-semibold text-white">
              {t(primaryAction.labelKey)}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/docs" className="welcome-secondary-action app-button inline-flex items-center justify-center gap-2 px-5 text-sm font-semibold">
              {t('welcome.hero.secondary')}
              <Code2 className="h-4 w-4" />
            </Link>
          </div>
          <div className="welcome-stack-strip" aria-label={t('welcome.hero.live')}>
            {stackKeys.map((key) => (
              <span key={key}>{t(key)}</span>
            ))}
          </div>
        </div>

        <div className="welcome-hero-stats" aria-label={t('welcome.hero.statsLabel')}>
          {welcomeHeroStats.map((item) => (
            <div key={item.labelKey}>
              <strong>{item.value}</strong>
              <span>{t(item.labelKey)}</span>
            </div>
          ))}
        </div>

        <div className="welcome-hero-stage">
          <DashboardPreview />
        </div>
      </section>

      <section id="capabilities" className="welcome-section welcome-capabilities">
        <div className="welcome-section-heading">
          <h2>{t('welcome.runtime.title')}</h2>
          <p>{t('welcome.runtime.description')}</p>
        </div>
        <div className="welcome-capability-list">
          {welcomeCapabilities.map((item, index) => {
            const Icon = capabilityIcons[index] ?? RadioTower
            return (
              <article key={item.titleKey} className="welcome-capability">
                <div className="welcome-capability-icon">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h3>{t(item.titleKey)}</h3>
                  <p>{t(item.bodyKey)}</p>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section id="workflow" className="welcome-section welcome-workflow-section">
        <div className="welcome-section-heading">
          <h2>{t('welcome.workflow.title')}</h2>
          <p>{t('welcome.workflow.description')}</p>
        </div>
        <div className="welcome-workflow">
          {welcomeWorkflowSteps.map((step, index) => {
            const Icon = workflowIcons[index] ?? BellRing
            return (
              <article key={step.labelKey} className="welcome-workflow-step">
                <div className="welcome-workflow-index">{String(index + 1).padStart(2, '0')}</div>
                <div className="welcome-workflow-icon">
                  <Icon className="h-4 w-4" />
                </div>
                <h3>{t(step.labelKey)}</h3>
                <p>{t(step.detailKey)}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section id="start" className="welcome-section welcome-start">
        <div className="welcome-start-copy">
          <h2>{t('welcome.start.title')}</h2>
          <p>{t('welcome.start.description')}</p>
          <div className="welcome-steps">
            {[t('welcome.start.install'), t('welcome.start.init'), t('welcome.start.verify')].map((step, index) => (
              <div key={step} className="welcome-step">
                <span>{index + 1}</span>
                {step}
              </div>
            ))}
          </div>
          <Link href={primaryAction.href} className="welcome-primary-action app-button inline-flex items-center justify-center gap-2 px-5 text-sm font-semibold text-white">
            {t(primaryAction.labelKey)}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="welcome-code-panel">
          <div className="welcome-code-title">
            <Terminal className="h-4 w-4" />
            {t('welcome.start.codeTitle')}
          </div>
          <pre>{`import { init } from '@error-tracker/sdk'

init({
  dsn: process.env.ERROR_TRACKER_DSN,
  token: process.env.ERROR_TRACKER_TOKEN,
  environment: 'production',
  release: 'web@2.9.3',
  integrations: {
    performance: true,
    replay: true,
    blankScreen: true,
  },
})`}</pre>
        </div>
      </section>

      <footer className="welcome-footer">
        <span>Error Tracker</span>
        <span>{t('welcome.footer')}</span>
      </footer>
    </main>
  )
}

function DashboardPreview() {
  const { t } = useI18n()

  return (
    <div className="welcome-dashboard-preview" aria-label={t('welcome.preview.label')}>
      <div className="welcome-preview-chrome" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="welcome-preview-topbar">
        <div>
          <span>{t('welcome.preview.project')}</span>
          <strong>{t('welcome.preview.title')}</strong>
        </div>
        <span className="welcome-preview-live">
          <span />
          {t('welcome.preview.live')}
        </span>
      </div>

      <div className="welcome-preview-metrics">
        <div>
          <span>{t('welcome.preview.metric.issues')}</span>
          <strong>24</strong>
        </div>
        <div>
          <span>{t('welcome.preview.metric.users')}</span>
          <strong>118</strong>
        </div>
        <div>
          <span>{t('welcome.preview.metric.release')}</span>
          <strong>2.9.4</strong>
        </div>
      </div>

      <div className="welcome-preview-table">
        {welcomePreviewRows.map((row) => (
          <div key={row.titleKey} className="welcome-preview-row">
            <span className={`welcome-severity ${severityClasses[row.severity]}`}>{row.severity}</span>
            <div className="welcome-preview-row-main">
              <strong>{t(row.titleKey)}</strong>
              <span>{t(row.metaKey)}</span>
            </div>
            <span className="welcome-preview-owner">{row.owner}</span>
            <span className="welcome-preview-status">{t(row.statusKey)}</span>
          </div>
        ))}
      </div>

      <div className="welcome-preview-evidence">
        <div>
          <span>{t('welcome.preview.evidence.stack')}</span>
          <code>CheckoutButton.tsx:84</code>
        </div>
        <div>
          <span>{t('welcome.preview.evidence.replay')}</span>
          <code>{t('welcome.preview.evidence.replayValue')}</code>
        </div>
        <div>
          <span>{t('welcome.preview.evidence.alert')}</span>
          <code>{t('welcome.preview.evidence.alertValue')}</code>
        </div>
      </div>
    </div>
  )
}
