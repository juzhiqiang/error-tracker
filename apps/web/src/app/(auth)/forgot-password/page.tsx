'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, CheckCircle2, Mail, Radar } from 'lucide-react'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { authClient } from '@/lib/auth-client'
import { useI18n } from '@/lib/i18n'

export default function ForgotPasswordPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const redirectTo = `${window.location.origin}/reset-password`
    const { error: resetError } = await authClient.requestPasswordReset({ email, redirectTo })
    setLoading(false)
    if (resetError) {
      setError(resetError.message ?? t('forgot.error'))
      return
    }
    setSent(true)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute left-4 top-4">
        <Link href="/login" className="app-button inline-flex items-center gap-2 border border-slate-700 bg-slate-950/70 px-3 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-slate-50">
          <ArrowLeft className="h-4 w-4" />
          {t('forgot.back')}
        </Link>
      </div>
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageToggle compact />
        <ThemeToggle compact />
      </div>

      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_420px]">
        <section className="hidden min-h-[520px] rounded-md border border-line bg-slate-950/70 p-8 shadow-2xl shadow-black/30 lg:block">
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-white shadow-lg shadow-primary/20">
                <Radar className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-indigo-300">Error Tracker</p>
              <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-tight text-slate-50">{t('forgot.hero')}</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">{t('forgot.description')}</p>
            </div>
            <div className="rounded-md border border-line bg-slate-900/70 p-4 text-sm leading-6 text-slate-300">{t('forgot.note')}</div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="w-full rounded-md border border-line bg-slate-900/92 p-7 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
          <div className="mb-7">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-white shadow-lg shadow-primary/20">
              <Mail className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-50">{t('forgot.title')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{t('forgot.subtitle')}</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {sent && (
            <div className="mb-5 flex items-center gap-2 rounded-md border border-success/35 bg-success/10 px-3 py-2 text-sm text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{t('forgot.success')}</span>
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">{t('login.email')}</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="app-control w-full px-3 text-sm" required autoComplete="email" />
          </label>

          <button type="submit" disabled={loading} className="app-button mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary px-4 font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
            <Mail className="h-4 w-4" />
            {loading ? t('forgot.submitting') : t('forgot.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
