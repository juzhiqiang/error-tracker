'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { authClient } from '@/lib/auth-client'
import { useI18n } from '@/lib/i18n'

export function ResetPasswordForm() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(token ? '' : t('reset.invalidToken'))
  const [success, setSuccess] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!token) {
      setError(t('reset.invalidToken'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('reset.mismatch'))
      return
    }

    setLoading(true)
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token })
    setLoading(false)
    if (resetError) {
      setError(resetError.message ?? t('reset.error'))
      return
    }
    setPassword('')
    setConfirmPassword('')
    setSuccess(t('reset.success'))
    window.setTimeout(() => router.push('/login'), 1200)
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

      <form onSubmit={handleSubmit} className="w-full max-w-[440px] rounded-md border border-line bg-slate-900/92 p-7 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
        <div className="mb-7">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-white shadow-lg shadow-primary/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-50">{t('reset.title')}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">{t('reset.subtitle')}</p>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-5 flex items-center gap-2 rounded-md border border-success/35 bg-success/10 px-3 py-2 text-sm text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">{t('reset.password')}</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="app-control w-full px-3 text-sm" required autoComplete="new-password" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">{t('reset.confirm')}</span>
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="app-control w-full px-3 text-sm" required autoComplete="new-password" />
          </label>
        </div>

        <button type="submit" disabled={loading || !token} className="app-button mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary px-4 font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
          <KeyRound className="h-4 w-4" />
          {loading ? t('reset.submitting') : t('reset.submit')}
        </button>
      </form>
    </div>
  )
}
