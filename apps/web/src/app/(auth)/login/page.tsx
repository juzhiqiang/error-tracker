'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, LockKeyhole, Radar, ShieldCheck } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { useI18n } from '@/lib/i18n'

const featureKeys = [
  'login.feature.errors',
  'login.feature.performance',
  'login.feature.dsn',
  'login.feature.replay',
]

export default function LoginPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const { error: signInError } = await authClient.signIn.email({ email, password })
    setLoading(false)
    if (signInError) {
      setError(signInError.message ?? t('login.error'))
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute left-4 top-4">
        <Link href="/welcome" className="app-button inline-flex items-center border border-slate-700 bg-slate-950/70 px-3 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-slate-50">
          {t('login.productTour')}
        </Link>
      </div>
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageToggle compact />
        <ThemeToggle compact />
      </div>
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_420px]">
        <section className="hidden min-h-[560px] rounded-md border border-line bg-slate-950/70 p-8 shadow-2xl shadow-black/30 lg:block">
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-white shadow-lg shadow-primary/20">
                <Radar className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-indigo-300">Error Tracker</p>
              <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-tight text-slate-50">
                {t('login.hero')}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
                {t('login.description')}
              </p>
            </div>
            <div className="grid gap-3 text-sm text-slate-300">
              {featureKeys.map((item) => (
                <div key={item} className="flex min-h-[44px] items-center gap-3 rounded-md border border-line bg-slate-900/70 px-4">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  {t(item)}
                </div>
              ))}
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="w-full rounded-md border border-line bg-slate-900/92 p-7 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
          <div className="mb-7">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-white shadow-lg shadow-primary/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-50">{t('login.title')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{t('login.subtitle')}</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">{t('login.email')}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="app-control w-full px-3 text-sm"
                required
                autoComplete="email"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">{t('login.password')}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="app-control w-full px-3 text-sm"
                required
                autoComplete="current-password"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="app-button mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary px-4 font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LockKeyhole className="h-4 w-4" />
            {loading ? t('login.submitting') : t('login.submit')}
          </button>

          <div className="mt-4 text-center">
            <Link href="/forgot-password" className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
              {t('login.forgotPassword')}
            </Link>
          </div>

          <p className="mt-5 text-center text-sm text-slate-400">
            {t('login.noAccount')}{' '}
            <Link href="/signup" className="font-medium text-indigo-300 hover:text-indigo-200">
              {t('login.createAccount')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
