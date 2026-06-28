'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Radar, ShieldCheck, UserPlus } from 'lucide-react'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { authClient } from '@/lib/auth-client'
import { useI18n } from '@/lib/i18n'

export default function SignupPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const { error: signUpError } = await authClient.signUp.email({
      name: name.trim() || email.split('@')[0] || email,
      email,
      password,
    })
    setLoading(false)
    if (signUpError) {
      setError(signUpError.message ?? t('signup.error'))
      return
    }
    router.push('/settings')
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
              <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-tight text-slate-50">{t('signup.hero')}</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">{t('signup.description')}</p>
            </div>
            <div className="grid gap-3 text-sm text-slate-300">
              {['signup.feature.owner', 'signup.feature.project', 'signup.feature.invite'].map((item) => (
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
              <UserPlus className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-50">{t('signup.title')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{t('signup.subtitle')}</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">{t('signup.name')}</span>
              <input value={name} onChange={(event) => setName(event.target.value)} className="app-control w-full px-3 text-sm" autoComplete="name" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">{t('login.email')}</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="app-control w-full px-3 text-sm" required autoComplete="email" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">{t('login.password')}</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="app-control w-full px-3 text-sm" required autoComplete="new-password" />
            </label>
          </div>

          <button type="submit" disabled={loading} className="app-button mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary px-4 font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
            <UserPlus className="h-4 w-4" />
            {loading ? t('signup.submitting') : t('signup.submit')}
          </button>

          <p className="mt-5 text-center text-sm text-slate-400">
            {t('signup.haveAccount')}{' '}
            <Link href="/login" className="font-medium text-indigo-300 hover:text-indigo-200">
              {t('signup.signIn')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
