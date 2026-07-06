'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity,
  BookOpen,
  Bug,
  CircleDot,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  ShieldCheck,
  UserRound,
  Workflow,
} from 'lucide-react'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { authClient } from '@/lib/auth-client'
import { useI18n } from '@/lib/i18n'
import {
  dashboardTopbarActions,
  getSessionDisplayName,
  getSessionInitials,
  type SessionUserSummary,
} from '@/lib/session-ui'

const navItems = [
  { href: '/', labelKey: 'nav.overview', icon: LayoutDashboard },
  { href: '/issues', labelKey: 'nav.issues', icon: Bug },
  { href: '/performance', labelKey: 'nav.performance', icon: Activity },
  { href: '/operations', labelKey: 'nav.operations', icon: Workflow },
  { href: '/audit', labelKey: 'nav.audit', icon: ScrollText },
  { href: '/settings', labelKey: 'nav.settings', icon: Settings },
  { href: '/account', labelKey: 'nav.account', icon: UserRound },
]

export function DashboardShell({ user, children }: { user?: SessionUserSummary | null; children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useI18n()
  const [signingOut, setSigningOut] = useState(false)
  const displayName = getSessionDisplayName(user, t('app.signedInUser'))
  const initials = getSessionInitials(user)
  const email = user?.email ?? t('app.signedInUser')

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await authClient.signOut()
      router.push('/login')
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-line bg-slate-950/88 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col">
          <div className="border-b border-line px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-white shadow-lg shadow-primary/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-50">Error Tracker</div>
                <div className="text-xs text-slate-500">{t('app.console')}</div>
              </div>
            </div>
          </div>

          <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-3 lg:block lg:space-y-1 lg:overflow-visible">
            {navItems.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`app-button flex min-h-[44px] shrink-0 items-center gap-3 px-3 text-sm font-medium lg:w-full ${
                    active
                      ? 'border border-primary/35 bg-primary/15 text-indigo-100'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t(item.labelKey)}</span>
                </Link>
              )
            })}
          </nav>

          <div className="mt-auto hidden border-t border-line p-4 lg:block">
            <div className="app-panel-muted space-y-3 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-200">
                <CircleDot className="h-3.5 w-3.5 fill-emerald-400 text-emerald-400" />
                {t('app.liveIngestion')}
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <Link
                  href="/account"
                  title={t('nav.account')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-200 hover:border-primary/50 hover:bg-primary/10"
                >
                  {initials}
                </Link>
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-slate-200">{displayName}</div>
                  <div className="truncate text-xs text-slate-500">{email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="app-button inline-flex min-h-[40px] w-full items-center justify-center gap-2 border border-slate-700 px-3 text-sm text-slate-300 hover:bg-slate-900 hover:text-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                {signingOut ? t('nav.signingOut') : t('nav.signOut')}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 border-b border-line bg-slate-950/72 px-4 py-3 shadow-lg shadow-black/20 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">{t('app.topbar')}</div>
            <div className="flex items-center gap-3">
              {dashboardTopbarActions.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  title={t(item.labelKey)}
                  className="app-button inline-flex items-center justify-center gap-2 border border-slate-700 bg-slate-950/70 px-3 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-slate-50"
                >
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">{t(item.labelKey)}</span>
                </Link>
              ))}
              <LanguageToggle compact />
              <ThemeToggle compact />
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {t('app.apiConnected')}
              </div>
              <Link
                href="/account"
                title={t('nav.account')}
                className="hidden min-w-0 items-center gap-2 rounded-md border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 hover:border-primary/50 hover:bg-primary/10 md:flex"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-800 text-[11px] font-semibold text-slate-200">
                  {initials}
                </span>
                <span className="max-w-40 truncate text-xs font-medium text-slate-300">{displayName}</span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                title={t('nav.signOut')}
                className="app-button inline-flex items-center justify-center gap-2 border border-slate-700 bg-slate-950/70 px-3 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">{signingOut ? t('nav.signingOut') : t('nav.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">{children}</div>
      </main>
    </div>
  )
}
