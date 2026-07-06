'use client'

import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, KeyRound, Save, ShieldCheck, UserRound } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { useI18n } from '@/lib/i18n'

export default function AccountPage() {
  const { t } = useI18n()
  const session = authClient.useSession()
  const [name, setName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    setName(session.data?.user?.name ?? '')
  }, [session.data?.user?.name])

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileSaving(true)
    setProfileError('')
    setProfileMessage('')
    const { error } = await authClient.updateUser({ name: name.trim() })
    setProfileSaving(false)
    if (error) {
      setProfileError(error.message ?? t('account.profile.error'))
      return
    }
    setProfileMessage(t('account.profile.success'))
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')
    if (newPassword !== confirmPassword) {
      setPasswordError(t('account.security.mismatch'))
      return
    }

    setPasswordSaving(true)
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    setPasswordSaving(false)
    if (error) {
      setPasswordError(error.message ?? t('account.security.error'))
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordMessage(t('account.security.success'))
  }

  const email = session.data?.user?.email ?? t('app.signedInUser')

  return (
    <div className="space-y-5">
      <section className="app-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-300">{t('account.eyebrow')}</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-50">{t('account.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{t('account.description')}</p>
          </div>
          <div className="flex min-h-[44px] items-center gap-2 rounded-md border border-line bg-slate-950/60 px-3 text-sm text-slate-300">
            <UserRound className="h-4 w-4 text-indigo-300" />
            <span className="max-w-[260px] truncate">{email}</span>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <form onSubmit={updateProfile} className="app-panel p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-indigo-200">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-50">{t('account.profile.title')}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">{t('account.profile.description')}</p>
            </div>
          </div>

          <StatusMessage error={profileError} success={profileMessage} />

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">{t('account.profile.name')}</span>
              <input value={name} onChange={(event) => setName(event.target.value)} className="app-control w-full px-3 text-sm" autoComplete="name" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">{t('account.profile.email')}</span>
              <input value={email} readOnly className="app-control w-full px-3 text-sm text-slate-500" />
            </label>
          </div>

          <button
            type="submit"
            disabled={profileSaving}
            className="app-button mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-2 bg-primary px-4 font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {profileSaving ? t('account.profile.saving') : t('account.profile.submit')}
          </button>
        </form>

        <form onSubmit={updatePassword} className="app-panel p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md border border-success/35 bg-success/10 text-emerald-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-50">{t('account.security.title')}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">{t('account.security.description')}</p>
            </div>
          </div>

          <StatusMessage error={passwordError} success={passwordMessage} />

          <div className="space-y-4">
            <PasswordInput label={t('account.security.current')} value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
            <PasswordInput label={t('account.security.new')} value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
            <PasswordInput label={t('account.security.confirm')} value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
          </div>

          <button
            type="submit"
            disabled={passwordSaving}
            className="app-button mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-2 bg-primary px-4 font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {passwordSaving ? t('account.security.saving') : t('account.security.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}

function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-300">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="app-control w-full px-3 text-sm"
        autoComplete={autoComplete}
      />
    </label>
  )
}

function StatusMessage({ error, success }: { error: string; success: string }) {
  if (!error && !success) return null
  return (
    <div
      className={`mb-5 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
        error ? 'border-danger/35 bg-danger/10 text-red-200' : 'border-success/35 bg-success/10 text-emerald-200'
      }`}
    >
      {error ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
      <span>{error || success}</span>
    </div>
  )
}
