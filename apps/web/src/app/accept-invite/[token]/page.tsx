'use client'

import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, KeyRound, Loader2, ShieldCheck, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { authClient } from '@/lib/auth-client'
import { api, type ProjectInvitation } from '@/lib/api'
import { formatFullDateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'

type AuthMode = 'sign-in' | 'sign-up'

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const { t } = useI18n()
  const router = useRouter()
  const session = authClient.useSession()
  const [invitation, setInvitation] = useState<ProjectInvitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    api.invitations
      .detail(token)
      .then((data) => {
        setInvitation(data)
        setName(data.email.split('@')[0] ?? '')
        setError('')
      })
      .catch(() => setError(t('invite.loadError')))
      .finally(() => setLoading(false))
  }, [token, t])

  async function acceptInvitation() {
    if (!token) return
    setAccepting(true)
    setError('')
    try {
      await api.invitations.accept(token)
      toast.success(t('invite.success'))
      router.push('/settings')
      router.refresh()
    } catch (acceptError) {
      const message = acceptError instanceof Error && acceptError.message.includes('403') ? t('invite.emailMismatch') : t('invite.acceptError')
      setError(message)
    } finally {
      setAccepting(false)
    }
  }

  async function authenticateAndAccept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!invitation) return
    setAccepting(true)
    setError('')
    const response =
      authMode === 'sign-in'
        ? await authClient.signIn.email({ email: invitation.email, password })
        : await authClient.signUp.email({ email: invitation.email, password, name: name.trim() || invitation.email.split('@')[0] })
    if (response.error) {
      setAccepting(false)
      setError(response.error.message ?? t('invite.authError'))
      return
    }
    setAccepting(false)
    await acceptInvitation()
  }

  const unavailable = invitation && invitation.status !== 'pending'
  const signedInEmail = session.data?.user?.email ?? ''

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute left-4 top-4">
        <Link href="/welcome" className="app-button inline-flex items-center border border-slate-700 bg-slate-950/70 px-3 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-slate-50">
          Error Tracker
        </Link>
      </div>
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageToggle compact />
        <ThemeToggle compact />
      </div>

      <main className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_430px]">
        <section className="app-panel hidden min-h-[520px] p-8 lg:block">
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-white shadow-lg shadow-primary/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-indigo-300">Error Tracker</p>
              <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-tight text-slate-50">{t('invite.title')}</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
                {invitation
                  ? t('invite.description', {
                      email: invitation.email,
                      project: invitation.projectName,
                      role: t(`role.${invitation.role}`),
                    })
                  : t('invite.loading')}
              </p>
            </div>
            <div className="grid gap-3 text-sm text-slate-300">
              <InviteFact label={t('settings.projects.title')} value={invitation?.projectName ?? '...'} />
              <InviteFact label={t('settings.members.role')} value={invitation ? t(`role.${invitation.role}`) : '...'} />
              <InviteFact label={t('settings.invitations.expires')} value={invitation ? formatFullDateTime(invitation.expiresAt) : '...'} />
            </div>
          </div>
        </section>

        <section className="app-panel p-7 sm:p-8">
          <div className="mb-7">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-white shadow-lg shadow-primary/20">
              <UserPlus className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-50">{t('invite.title')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {invitation ? invitation.email : t('invite.loading')}
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('invite.loading')}
            </div>
          ) : error && !invitation ? (
            <InviteAlert message={error} />
          ) : unavailable ? (
            <InviteAlert message={t('invite.expired')} />
          ) : invitation ? (
            <div className="space-y-5">
              {error && <InviteAlert message={error} />}

              {signedInEmail ? (
                <div className="space-y-3">
                  <InviteFact label={t('invite.signedInAs')} value={signedInEmail} />
                  <button
                    type="button"
                    onClick={acceptInvitation}
                    disabled={accepting}
                    className="app-button inline-flex w-full items-center justify-center gap-2 bg-primary px-4 font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {accepting ? t('invite.accepting') : t('invite.acceptSignedIn')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAuthMode('sign-in')}
                      className={`app-button border px-3 text-sm ${authMode === 'sign-in' ? 'border-primary/45 bg-primary/15 text-indigo-100' : 'border-slate-700 text-slate-300 hover:bg-slate-900'}`}
                    >
                      {t('invite.haveAccount')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('sign-up')}
                      className={`app-button border px-3 text-sm ${authMode === 'sign-up' ? 'border-primary/45 bg-primary/15 text-indigo-100' : 'border-slate-700 text-slate-300 hover:bg-slate-900'}`}
                    >
                      {t('invite.createAccount')}
                    </button>
                  </div>

                  <form onSubmit={authenticateAndAccept} className="space-y-4">
                    {authMode === 'sign-up' && (
                      <label className="block">
                        <span className="mb-1.5 block text-sm text-slate-300">{t('invite.name')}</span>
                        <input value={name} onChange={(event) => setName(event.target.value)} className="app-control w-full px-3 text-sm" />
                      </label>
                    )}
                    <label className="block">
                      <span className="mb-1.5 block text-sm text-slate-300">{t('login.email')}</span>
                      <input value={invitation.email} readOnly className="app-control w-full px-3 text-sm" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm text-slate-300">{t('invite.password')}</span>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="app-control w-full px-3 text-sm"
                        required
                        autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={accepting}
                      className="app-button inline-flex w-full items-center justify-center gap-2 border border-slate-700 px-4 font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <KeyRound className="h-4 w-4" />
                      {accepting ? t('invite.accepting') : authMode === 'sign-in' ? t('invite.signIn') : t('invite.signUp')}
                    </button>
                  </form>
                </>
              )}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  )
}

function InviteFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-slate-900/70 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-slate-200">{value}</div>
    </div>
  )
}

function InviteAlert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-red-200">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
