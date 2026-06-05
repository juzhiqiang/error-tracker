'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Code2,
  Database,
  Fingerprint,
  Gauge,
  GitBranch,
  MousePointerClick,
  Play,
  RadioTower,
  ShieldCheck,
  Terminal,
  Zap,
} from 'lucide-react'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { useI18n } from '@/lib/i18n'

const signalRows = [
  { icon: AlertTriangle, titleKey: 'welcome.signal.exception.title', metaKey: 'welcome.signal.exception.meta', tone: 'danger' },
  { icon: Play, titleKey: 'welcome.signal.replay.title', metaKey: 'welcome.signal.replay.meta', tone: 'primary' },
  { icon: Gauge, titleKey: 'welcome.signal.vital.title', metaKey: 'welcome.signal.vital.meta', tone: 'warning' },
  { icon: GitBranch, titleKey: 'welcome.signal.deploy.title', metaKey: 'welcome.signal.deploy.meta', tone: 'success' },
] as const

const runtimeCards = [
  { icon: Terminal, titleKey: 'welcome.runtime.sdk.title', bodyKey: 'welcome.runtime.sdk.body' },
  { icon: Fingerprint, titleKey: 'welcome.runtime.queue.title', bodyKey: 'welcome.runtime.queue.body' },
  { icon: MousePointerClick, titleKey: 'welcome.runtime.replay.title', bodyKey: 'welcome.runtime.replay.body' },
  { icon: Activity, titleKey: 'welcome.runtime.vitals.title', bodyKey: 'welcome.runtime.vitals.body' },
] as const

const contextCards = [
  { icon: RadioTower, titleKey: 'welcome.context.card1.title', bodyKey: 'welcome.context.card1.body' },
  { icon: Database, titleKey: 'welcome.context.card2.title', bodyKey: 'welcome.context.card2.body' },
  { icon: Zap, titleKey: 'welcome.context.card3.title', bodyKey: 'welcome.context.card3.body' },
] as const

const connectedNodes = [
  { key: 'welcome.connected.issue', x: 50, y: 12 },
  { key: 'welcome.connected.breadcrumb', x: 18, y: 36 },
  { key: 'welcome.connected.stack', x: 80, y: 36 },
  { key: 'welcome.connected.replay', x: 28, y: 72 },
  { key: 'welcome.connected.vitals', x: 72, y: 72 },
  { key: 'welcome.connected.release', x: 50, y: 90 },
] as const

const stackKeys = [
  'welcome.stack.errors',
  'welcome.stack.breadcrumbs',
  'welcome.stack.replay',
  'welcome.stack.vitals',
  'welcome.stack.release',
]

const consoleKeys = [
  'welcome.console.intake',
  'welcome.console.grouped',
  'welcome.console.replay',
  'welcome.console.context',
]

export default function WelcomePage() {
  const { t } = useI18n()
  const [activeSignal, setActiveSignal] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSignal((current) => (current + 1) % signalRows.length)
    }, 2600)
    return () => window.clearInterval(timer)
  }, [])

  function moveScene(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    event.currentTarget.style.setProperty('--mx', `${x}%`)
    event.currentTarget.style.setProperty('--my', `${y}%`)
    event.currentTarget.style.setProperty('--tilt-x', `${(50 - y) / 28}deg`)
    event.currentTarget.style.setProperty('--tilt-y', `${(x - 50) / 24}deg`)
  }

  return (
    <main className="welcome-page min-h-screen overflow-hidden bg-background text-slate-100">
      <nav className="welcome-nav">
        <Link href="/welcome" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-white shadow-lg shadow-primary/25">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold text-slate-50">Error Tracker</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
          <a href="#signals" className="hover:text-slate-100">{t('welcome.nav.signals')}</a>
          <a href="#context" className="hover:text-slate-100">{t('welcome.nav.context')}</a>
          <a href="#start" className="hover:text-slate-100">{t('welcome.nav.setup')}</a>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle compact />
          <ThemeToggle compact />
          <Link href="/login" className="app-button hidden items-center gap-2 border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-900 sm:inline-flex">
            {t('welcome.nav.signIn')}
          </Link>
        </div>
      </nav>

      <section className="welcome-hero" onPointerMove={moveScene}>
        <SignalScene activeSignal={activeSignal} />
        <div className="welcome-hero-copy">
          <div className="welcome-kicker">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(28,232,158,0.75)]" />
            {t('welcome.hero.kicker')}
          </div>
          <h1>{t('welcome.hero.title')}</h1>
          <p>{t('welcome.hero.description')}</p>
          <div className="welcome-hero-actions">
            <Link href="/login" className="app-button welcome-primary-action inline-flex items-center justify-center gap-2 px-5 text-sm font-semibold text-white">
              {t('welcome.hero.primary')}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#start" className="app-button inline-flex items-center justify-center gap-2 border border-slate-700 px-5 text-sm font-semibold text-slate-200 hover:bg-slate-900">
              {t('welcome.hero.secondary')}
            </a>
          </div>
          <div className="welcome-stack-strip" aria-label={t('welcome.hero.live')}>
            {stackKeys.map((key) => (
              <span key={key}>{t(key)}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="signals" className="welcome-section welcome-section-tight">
        <div className="welcome-section-heading">
          <h2>{t('welcome.runtime.title')}</h2>
          <p>{t('welcome.runtime.description')}</p>
        </div>
        <div className="welcome-runtime-grid">
          {runtimeCards.map((card) => {
            const Icon = card.icon
            return (
              <article key={card.titleKey} className="welcome-feature">
                <div className="welcome-feature-icon"><Icon className="h-4 w-4" /></div>
                <h3>{t(card.titleKey)}</h3>
                <p>{t(card.bodyKey)}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="welcome-section welcome-connected">
        <div className="welcome-section-heading">
          <h2>{t('welcome.connected.title')}</h2>
          <p>{t('welcome.connected.description')}</p>
        </div>
        <div className="welcome-map">
          <div className="welcome-map-lines" />
          {connectedNodes.map((node) => (
            <div key={node.key} className="welcome-node" style={{ left: `${node.x}%`, top: `${node.y}%` }}>
              {t(node.key)}
            </div>
          ))}
          <div className="welcome-root-view">
            <div className="flex items-center gap-2 text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              {t('welcome.connected.fixTitle')}
            </div>
            <p>{t('welcome.connected.fixBody')}</p>
          </div>
        </div>
      </section>

      <section id="context" className="welcome-section">
        <div className="welcome-context-layout">
          <div className="welcome-section-heading">
            <h2>{t('welcome.context.title')}</h2>
            <p>{t('welcome.context.description')}</p>
          </div>
          <div className="welcome-context-cards">
            {contextCards.map((card) => {
              const Icon = card.icon
              return (
                <article key={card.titleKey} className="welcome-context-card">
                  <Icon className="h-5 w-5 text-indigo-300" />
                  <div>
                    <h3>{t(card.titleKey)}</h3>
                    <p>{t(card.bodyKey)}</p>
                  </div>
                </article>
              )
            })}
          </div>
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
          <Link href="/login" className="app-button welcome-primary-action inline-flex items-center justify-center gap-2 px-5 text-sm font-semibold text-white">
            {t('welcome.start.cta')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="welcome-code-panel">
          <div className="welcome-code-title">
            <Code2 className="h-4 w-4" />
            {t('welcome.start.codeTitle')}
          </div>
          <pre>{`import { init } from '@error-tracker/sdk'

init({
  dsn: 'https://api.example.com/ingest/project/token',
  environment: 'production',
  release: 'web@2.8.1',
  integrations: {
    console: true,
    performance: true,
    replay: true,
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

function SignalScene({ activeSignal }: { activeSignal: number }) {
  const { t } = useI18n()
  return (
    <div className="welcome-scene" aria-hidden="true">
      <div className="welcome-grid-plane" />
      <div className="welcome-scanline" />
      <div className="welcome-command">
        <div className="welcome-command-header">
          <span>{t('welcome.hero.live')}</span>
          <Clock3 className="h-4 w-4" />
        </div>
        <div className="space-y-3">
          {signalRows.map((row, index) => {
            const Icon = row.icon
            return (
              <div key={row.titleKey} className={`welcome-signal-row ${row.tone} ${activeSignal === index ? 'active' : ''}`}>
                <div className="welcome-signal-icon"><Icon className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-100">{t(row.titleKey)}</div>
                  <div className="mt-1 truncate font-mono text-xs text-slate-500">{t(row.metaKey)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="welcome-terminal">
        <Terminal className="h-4 w-4 text-emerald-300" />
        <div>
          {consoleKeys.map((key, index) => (
            <div key={key} style={{ animationDelay: `${index * 420}ms` }}>
              <span>0{index + 1}</span> {t(key)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
