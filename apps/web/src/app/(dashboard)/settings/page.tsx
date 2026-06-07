'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clipboard,
  Clock3,
  Copy,
  FileCode2,
  KeyRound,
  Link2,
  Plus,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  Webhook,
  XCircle,
} from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { PageHeader, Panel } from '@/components/panel'
import { API_BASE, api, type Project, type ProjectInvitation, type ProjectMember, type ProjectRole } from '@/lib/api'
import { formatFullDateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { sdkSetupGuide } from '@/lib/sdk-docs'
import { buildSourcemapUploadFormData, validateSourcemapUpload } from '@/lib/sourcemap-upload'

const roleOptions: ProjectRole[] = ['owner', 'admin', 'member', 'viewer']
type SettingsTab = 'access' | 'members'

export default function SettingsPage() {
  const { t } = useI18n()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [updatingAi, setUpdatingAi] = useState(false)
  const [updatingAlerts, setUpdatingAlerts] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<SettingsTab>('access')
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([])
  const [invitationsLoading, setInvitationsLoading] = useState(false)
  const [latestInviteUrl, setLatestInviteUrl] = useState('')
  const [latestInviteDelivery, setLatestInviteDelivery] = useState<ProjectInvitation['emailDelivery'] | null>(null)
  const [memberEmail, setMemberEmail] = useState('')
  const [memberRole, setMemberRole] = useState<ProjectRole>('member')
  const [inviting, setInviting] = useState(false)
  const [updatingMemberId, setUpdatingMemberId] = useState('')
  const [updatingInvitationId, setUpdatingInvitationId] = useState('')
  const [sourcemapRelease, setSourcemapRelease] = useState('')
  const [sourcemapFiles, setSourcemapFiles] = useState<File[]>([])
  const [sourcemapUploading, setSourcemapUploading] = useState(false)
  const [sourcemapInputKey, setSourcemapInputKey] = useState(0)
  const [alertWebhookUrl, setAlertWebhookUrl] = useState('')
  const [alertThreshold, setAlertThreshold] = useState('50')
  const [alertUserThreshold, setAlertUserThreshold] = useState('10')

  useEffect(() => {
    refreshProjects()
  }, [])

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[projects.length - 1],
    [projects, selectedProjectId],
  )
  const ingestUrl = selectedProject ? `${API_BASE}/ingest/${selectedProject.id}` : ''
  const projectToken = selectedProject?.dsnToken ?? ''

  useEffect(() => {
    if (!selectedProject || activeTab !== 'members') return
    refreshMembers(selectedProject.id)
    refreshInvitations(selectedProject.id)
  }, [selectedProject?.id, activeTab])

  useEffect(() => {
    setLatestInviteUrl('')
    setLatestInviteDelivery(null)
    setSourcemapRelease('')
    setSourcemapFiles([])
    setSourcemapInputKey((current) => current + 1)
    setAlertWebhookUrl(selectedProject?.webhookUrl ?? '')
    setAlertThreshold(String(selectedProject?.alertThreshold ?? 50))
    setAlertUserThreshold(String(selectedProject?.alertUserThreshold ?? 10))
  }, [selectedProject?.id])

  async function refreshProjects() {
    setLoading(true)
    try {
      const items = await api.projects.list()
      setProjects(items)
      setSelectedProjectId((current) => current || items[items.length - 1]?.id || '')
      setError('')
    } catch {
      setError(t('common.projectListError'))
    } finally {
      setLoading(false)
    }
  }

  async function createProject() {
    if (!newName.trim() || !newSlug.trim()) {
      toast.error(t('settings.toast.createMissing'))
      return
    }
    setCreating(true)
    try {
      const created = await api.projects.create({ name: newName.trim(), slug: normalizeSlug(newSlug) })
      const project = created[0]
      setNewName('')
      setNewSlug('')
      await refreshProjects()
      if (project?.id) setSelectedProjectId(project.id)
      toast.success(t('settings.toast.created'))
    } catch {
      toast.error(t('settings.toast.createFailed'))
    } finally {
      setCreating(false)
    }
  }

  async function rotateToken() {
    if (!selectedProject) return
    setRotating(true)
    try {
      const updated = await api.projects.rotateToken(selectedProject.id)
      const project = updated[0]
      if (project) {
        setProjects((current) => current.map((item) => (item.id === project.id ? project : item)))
        setSelectedProjectId(project.id)
      }
      toast.success(t('settings.toast.rotated'))
    } catch {
      toast.error(t('settings.toast.rotateFailed'))
    } finally {
      setRotating(false)
    }
  }

  async function updateAiAnalysis(enabled: boolean) {
    if (!selectedProject) return
    setUpdatingAi(true)
    try {
      const updated = await api.projects.updateAiAnalysis(selectedProject.id, enabled)
      const project = updated[0]
      if (project) {
        setProjects((current) => current.map((item) => (item.id === project.id ? project : item)))
        setSelectedProjectId(project.id)
      }
      toast.success(t('settings.toast.aiUpdated'))
    } catch {
      toast.error(t('settings.toast.aiUpdateFailed'))
    } finally {
      setUpdatingAi(false)
    }
  }

  async function updateAlertSettings() {
    if (!selectedProject) return
    setUpdatingAlerts(true)
    try {
      const updated = await api.projects.updateAlertSettings(selectedProject.id, {
        webhookUrl: alertWebhookUrl.trim() || null,
        alertThreshold: positiveInt(alertThreshold, 50),
        alertUserThreshold: positiveInt(alertUserThreshold, 10),
      })
      const project = updated[0]
      if (project) {
        setProjects((current) => current.map((item) => (item.id === project.id ? project : item)))
        setSelectedProjectId(project.id)
      }
      toast.success(t('settings.toast.alertsUpdated'))
    } catch {
      toast.error(t('settings.toast.alertsUpdateFailed'))
    } finally {
      setUpdatingAlerts(false)
    }
  }

  async function refreshMembers(projectId: string) {
    setMembersLoading(true)
    try {
      setMembers(await api.projects.members(projectId))
    } catch {
      toast.error(t('settings.members.loadError'))
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }

  async function refreshInvitations(projectId: string) {
    setInvitationsLoading(true)
    try {
      setInvitations(await api.projects.invitations(projectId))
    } catch {
      toast.error(t('settings.invitations.loadError'))
      setInvitations([])
    } finally {
      setInvitationsLoading(false)
    }
  }

  async function inviteMember() {
    if (!selectedProject) return
    if (!memberEmail.trim()) {
      toast.error(t('settings.toast.memberEmailMissing'))
      return
    }
    setInviting(true)
    try {
      const invitation = await api.projects.createInvitation(selectedProject.id, { email: memberEmail.trim(), role: memberRole })
      setInvitations((current) => [invitation, ...current.filter((item) => item.id !== invitation.id)])
      setLatestInviteUrl(invitation.inviteUrl ?? '')
      setLatestInviteDelivery(invitation.emailDelivery ?? null)
      setMemberEmail('')
      setMemberRole('member')
      showInvitationDeliveryToast(invitation.emailDelivery)
    } catch {
      toast.error(t('settings.toast.invitationCreateFailed'))
    } finally {
      setInviting(false)
    }
  }

  async function updateMemberRole(userId: string, role: ProjectRole) {
    if (!selectedProject) return
    setUpdatingMemberId(userId)
    try {
      const updated = await api.projects.updateMemberRole(selectedProject.id, userId, role)
      setMembers((current) => current.map((item) => (item.userId === userId ? updated : item)))
      toast.success(t('settings.toast.memberRoleUpdated'))
    } catch {
      toast.error(t('settings.members.updateFailed'))
    } finally {
      setUpdatingMemberId('')
    }
  }

  async function removeMember(userId: string) {
    if (!selectedProject) return
    setUpdatingMemberId(userId)
    try {
      await api.projects.removeMember(selectedProject.id, userId)
      setMembers((current) => current.filter((item) => item.userId !== userId))
      toast.success(t('settings.toast.memberRemoved'))
    } catch {
      toast.error(t('settings.members.removeFailed'))
    } finally {
      setUpdatingMemberId('')
    }
  }

  async function resendInvitation(invitationId: string) {
    if (!selectedProject) return
    setUpdatingInvitationId(invitationId)
    try {
      const invitation = await api.projects.resendInvitation(selectedProject.id, invitationId)
      setInvitations((current) => current.map((item) => (item.id === invitation.id ? invitation : item)))
      setLatestInviteUrl(invitation.inviteUrl ?? '')
      setLatestInviteDelivery(invitation.emailDelivery ?? null)
      showInvitationDeliveryToast(invitation.emailDelivery)
    } catch {
      toast.error(t('settings.invitations.resendFailed'))
    } finally {
      setUpdatingInvitationId('')
    }
  }

  async function revokeInvitation(invitationId: string) {
    if (!selectedProject) return
    setUpdatingInvitationId(invitationId)
    try {
      await api.projects.revokeInvitation(selectedProject.id, invitationId)
      setInvitations((current) =>
        current.map((item) =>
          item.id === invitationId ? { ...item, status: 'revoked', revokedAt: new Date().toISOString() } : item,
        ),
      )
      toast.success(t('settings.toast.invitationRevoked'))
    } catch {
      toast.error(t('settings.invitations.revokeFailed'))
    } finally {
      setUpdatingInvitationId('')
    }
  }

  async function uploadSourcemaps() {
    if (!selectedProject) return
    const release = sourcemapRelease.trim()
    const validation = validateSourcemapUpload(release, sourcemapFiles)
    if (!validation.ok) {
      toast.error(t(validation.messageKey))
      return
    }

    setSourcemapUploading(true)
    try {
      const result = await api.sourcemaps.upload(selectedProject.id, release, buildSourcemapUploadFormData(sourcemapFiles))
      toast.success(t('settings.toast.sourcemapUploaded', { count: result.uploaded }))
      setSourcemapFiles([])
      setSourcemapInputKey((current) => current + 1)
    } catch {
      toast.error(t('settings.toast.sourcemapUploadFailed'))
    } finally {
      setSourcemapUploading(false)
    }
  }

  async function copy(value: string, messageKey: string) {
    await navigator.clipboard.writeText(value)
    toast.success(t(messageKey))
  }

  function showInvitationDeliveryToast(delivery: ProjectInvitation['emailDelivery']) {
    if (delivery?.status === 'sent') {
      toast.success(t('settings.toast.invitationEmailSent'))
      return
    }
    if (delivery?.status === 'not_configured') {
      toast.warning(t('settings.toast.invitationEmailNotConfigured'))
      return
    }
    if (delivery?.status === 'failed') {
      toast.warning(t('settings.toast.invitationEmailFailed'))
      return
    }
    toast.success(t('settings.toast.invitationCreated'))
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
        description={t('settings.description')}
      />

      {error && (
        <div className="rounded-md border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Panel title={t('settings.create.title')} description={t('settings.create.description')}>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">{t('settings.projectName')}</span>
                <input
                  value={newName}
                  onChange={(event) => {
                    setNewName(event.target.value)
                    if (!newSlug) setNewSlug(normalizeSlug(event.target.value))
                  }}
                  placeholder="Utils Plane Web"
                  className="app-control w-full px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">{t('settings.slug')}</span>
                <input
                  value={newSlug}
                  onChange={(event) => setNewSlug(normalizeSlug(event.target.value))}
                  placeholder="utils-plane-web"
                  className="app-control w-full px-3 font-mono text-sm"
                />
              </label>
              <button
                onClick={createProject}
                disabled={creating}
                className="app-button inline-flex w-full items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {creating ? t('settings.create.creating') : t('settings.create.button')}
              </button>
            </div>
          </Panel>

          <Panel title={t('settings.projects.title')} description={t('settings.projects.description')} bodyClassName="p-3">
            <div className="max-h-[460px] space-y-2 overflow-auto">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-md bg-slate-800/70" />)
              ) : projects.length === 0 ? (
                <EmptyState title={t('settings.projects.emptyTitle')} description={t('settings.projects.emptyDescription')} />
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`w-full rounded-md border p-3 text-left transition ${
                      selectedProject?.id === project.id ? 'border-primary/50 bg-primary/10' : 'border-line bg-slate-950/35 hover:bg-slate-800/55'
                    }`}
                  >
                    <div className="truncate text-sm font-semibold text-slate-100">{project.name}</div>
                    <div className="mt-1 truncate font-mono text-xs text-slate-500">{project.slug}</div>
                  </button>
                ))
              )}
            </div>
          </Panel>
        </aside>

        <main className="space-y-4">
          {!selectedProject ? (
            <EmptyState title={t('settings.select.emptyTitle')} description={t('settings.select.emptyDescription')} />
          ) : (
            <>
              <div className="app-panel-muted inline-flex flex-wrap gap-1 p-1">
                {(['access', 'members'] as SettingsTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`app-button inline-flex items-center gap-2 px-3 text-sm font-medium ${
                      activeTab === tab ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                    }`}
                  >
                    {tab === 'members' && <Users className="h-4 w-4" />}
                    {t(tab === 'access' ? 'settings.tab.access' : 'settings.tab.members')}
                  </button>
                ))}
              </div>

              {activeTab === 'access' ? (
                <>
              <Panel
                title={selectedProject.name}
                description={selectedProject.id}
                action={
                  <button
                    onClick={rotateToken}
                    disabled={rotating}
                    className="app-button inline-flex items-center gap-2 border border-danger/35 bg-danger/10 px-3 text-sm text-red-200 hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {rotating ? t('settings.rotating') : t('settings.rotate')}
                  </button>
                }
              >
                <div className="space-y-5">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
                      <KeyRound className="h-4 w-4 text-indigo-300" />
                      Ingest URL
                    </div>
                    <div className="flex gap-2">
                      <input readOnly value={ingestUrl} className="app-control min-w-0 flex-1 px-3 font-mono text-xs text-slate-300" />
                      <button
                        onClick={() => copy(ingestUrl, 'settings.toast.dsnCopied')}
                        className="app-button inline-flex items-center gap-2 border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-800"
                      >
                        <Copy className="h-4 w-4" />
                        {t('common.copy')}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
                      <ShieldCheck className="h-4 w-4 text-emerald-300" />
                      Token
                    </div>
                    <div className="flex gap-2">
                      <input readOnly value={projectToken} className="app-control min-w-0 flex-1 px-3 font-mono text-xs text-slate-300" />
                      <button
                        onClick={() => copy(projectToken, 'settings.toast.tokenCopied')}
                        className="app-button inline-flex items-center gap-2 border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-800"
                      >
                        <Copy className="h-4 w-4" />
                        {t('common.copy')}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <ProjectFact icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />} label={t('settings.retention')} value={t('settings.days', { count: selectedProject.retentionDays ?? 30 })} />
                    <ProjectFact icon={<Webhook className="h-4 w-4 text-indigo-300" />} label={t('settings.alertThreshold')} value={t('settings.events', { count: selectedProject.alertThreshold ?? 50 })} />
                    <ProjectFact icon={<Rocket className="h-4 w-4 text-amber-300" />} label={t('settings.created')} value={formatFullDateTime(selectedProject.createdAt)} />
                  </div>

                  <ProjectFact
                    icon={<Webhook className="h-4 w-4 text-indigo-300" />}
                    label={t('settings.webhook')}
                    value={selectedProject.webhookUrl || t('settings.webhook.empty')}
                  />

                  <div className="app-panel-muted p-4">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                          <Webhook className="h-4 w-4 text-indigo-300" />
                          {t('settings.alerts.title')}
                        </div>
                        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{t('settings.alerts.description')}</p>
                      </div>
                      <button
                        onClick={updateAlertSettings}
                        disabled={updatingAlerts}
                        className="app-button inline-flex items-center gap-2 border border-primary/40 bg-primary/10 px-3 text-sm text-indigo-200 hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Webhook className="h-4 w-4" />
                        {updatingAlerts ? t('settings.alerts.saving') : t('settings.alerts.save')}
                      </button>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px]">
                      <label className="grid gap-2">
                        <span className="text-xs font-medium text-slate-400">{t('settings.alerts.webhookUrl')}</span>
                        <input
                          value={alertWebhookUrl}
                          onChange={(event) => setAlertWebhookUrl(event.target.value)}
                          placeholder={t('settings.alerts.webhookPlaceholder')}
                          className="app-control w-full px-3 font-mono text-xs"
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-xs font-medium text-slate-400">{t('settings.alerts.eventThreshold')}</span>
                        <input
                          value={alertThreshold}
                          onChange={(event) => setAlertThreshold(event.target.value)}
                          inputMode="numeric"
                          className="app-control w-full px-3 font-mono text-sm"
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-xs font-medium text-slate-400">{t('settings.alerts.userThreshold')}</span>
                        <input
                          value={alertUserThreshold}
                          onChange={(event) => setAlertUserThreshold(event.target.value)}
                          inputMode="numeric"
                          className="app-control w-full px-3 font-mono text-sm"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-md border border-line bg-slate-950/30 px-2 py-1">Slack</span>
                      <span className="rounded-md border border-line bg-slate-950/30 px-2 py-1">Feishu / Lark</span>
                      <span className="rounded-md border border-line bg-slate-950/30 px-2 py-1">DingTalk</span>
                      <span className="rounded-md border border-line bg-slate-950/30 px-2 py-1">WeCom</span>
                    </div>
                  </div>

                  <div className="app-panel-muted flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-indigo-200">
                        <BrainCircuit className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-100">{t('settings.ai.title')}</div>
                        <div className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{t('settings.ai.description')}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => updateAiAnalysis(!(selectedProject.aiAnalysisEnabled ?? false))}
                      disabled={updatingAi}
                      aria-pressed={selectedProject.aiAnalysisEnabled ?? false}
                      className={`app-button inline-flex min-h-[44px] min-w-[112px] items-center justify-center gap-2 border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                        selectedProject.aiAnalysisEnabled
                          ? 'border-success/35 bg-success/10 text-emerald-200 hover:bg-success/15'
                          : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {selectedProject.aiAnalysisEnabled ? t('settings.ai.enabled') : t('settings.ai.disabled')}
                    </button>
                  </div>
                </div>
              </Panel>

              <Panel
                title={t('settings.sdk.title')}
                description={t('settings.sdk.description')}
                action={
                  <button
                    onClick={() => copy(sdkSnippet(ingestUrl, projectToken), 'settings.toast.snippetCopied')}
                    className="app-button inline-flex items-center gap-2 border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    <Clipboard className="h-4 w-4" />
                    {t('settings.sdk.copy')}
                  </button>
                }
                bodyClassName="p-0"
              >
                <pre className="app-code overflow-x-auto rounded-none border-0 p-5 text-xs text-slate-300">{sdkSnippet(ingestUrl, projectToken)}</pre>
              </Panel>

              <SourcemapFallbackUploader
                release={sourcemapRelease}
                files={sourcemapFiles}
                uploading={sourcemapUploading}
                inputKey={sourcemapInputKey}
                onReleaseChange={setSourcemapRelease}
                onFilesChange={setSourcemapFiles}
                onUpload={uploadSourcemaps}
              />

              <section className="grid gap-3 md:grid-cols-2">
                {sdkSetupGuide.map((item, index) => (
                  <Link key={item.href} href={item.href} className="app-panel flex min-h-[64px] items-center gap-3 p-4 no-underline hover:-translate-y-0.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md border border-success/35 bg-success/10 text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-100">{t(item.labelKey)}</div>
                      <div className="mt-1 text-xs text-slate-500">{t(item.stepKey, { index: index + 1 })}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-500" />
                  </Link>
                ))}
              </section>
                </>
              ) : (
                <MembersView
                  members={members}
                  loading={membersLoading}
                  invitations={invitations}
                  invitationsLoading={invitationsLoading}
                  latestInviteUrl={latestInviteUrl}
                  latestInviteDelivery={latestInviteDelivery}
                  email={memberEmail}
                  role={memberRole}
                  inviting={inviting}
                  updatingMemberId={updatingMemberId}
                  updatingInvitationId={updatingInvitationId}
                  onEmailChange={setMemberEmail}
                  onRoleChange={setMemberRole}
                  onInvite={inviteMember}
                  onRoleUpdate={updateMemberRole}
                  onRemove={removeMember}
                  onResendInvitation={resendInvitation}
                  onRevokeInvitation={revokeInvitation}
                  onCopy={copy}
                />
              )}
            </>
          )}
        </main>
      </section>
    </div>
  )
}

function SourcemapFallbackUploader({
  release,
  files,
  uploading,
  inputKey,
  onReleaseChange,
  onFilesChange,
  onUpload,
}: {
  release: string
  files: File[]
  uploading: boolean
  inputKey: number
  onReleaseChange: (release: string) => void
  onFilesChange: (files: File[]) => void
  onUpload: () => void
}) {
  const { t } = useI18n()
  const selectedFileNames = files.map((file) => file.name).join(', ')

  return (
    <Panel
      title={t('settings.sourcemap.title')}
      description={t('settings.sourcemap.description')}
      action={
        <Link
          href="/docs#upload-sourcemap"
          className="app-button inline-flex items-center justify-center gap-2 border border-primary/35 bg-primary/10 px-3 text-sm text-indigo-200 hover:bg-primary/15"
        >
          <FileCode2 className="h-4 w-4" />
          {t('settings.sourcemap.docs')}
        </Link>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.42fr)]">
        <div className="grid gap-3 md:grid-cols-[minmax(180px,0.8fr)_minmax(220px,1fr)]">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-sm text-slate-300">{t('settings.sourcemap.release')}</span>
            <input
              value={release}
              onChange={(event) => onReleaseChange(event.target.value)}
              placeholder="web@2.8.1"
              className="app-control w-full px-3 font-mono text-sm"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-sm text-slate-300">{t('settings.sourcemap.files')}</span>
            <input
              key={inputKey}
              type="file"
              multiple
              accept=".map,.json,application/json"
              onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))}
              className="app-control w-full cursor-pointer px-3 py-2 text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-primary/20 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-100"
            />
          </label>
        </div>

        <div className="app-panel-muted flex min-h-[96px] items-center gap-3 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-info/30 bg-cyan-500/10 text-cyan-200">
            <FileCode2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-100">
              {files.length > 0 ? t('settings.sourcemap.selectedFiles', { count: files.length }) : t('settings.sourcemap.noFiles')}
            </div>
            <div className="mt-1 truncate font-mono text-xs text-slate-500">
              {selectedFileNames || t('settings.sourcemap.fileTypes')}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="inline-flex min-h-8 items-center gap-2 rounded-md border border-warning/35 bg-warning/10 px-2.5 text-xs font-medium text-amber-200">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t('settings.sourcemap.ownerAdmin')}
        </div>
        <button
          onClick={onUpload}
          disabled={uploading}
          className="app-button inline-flex items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UploadCloud className="h-4 w-4" />
          {uploading ? t('settings.sourcemap.uploading') : t('settings.sourcemap.upload')}
        </button>
      </div>
    </Panel>
  )
}

function ProjectFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="app-panel-muted p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 break-words font-mono text-sm text-slate-200">{value}</div>
    </div>
  )
}

function MembersView({
  members,
  loading,
  invitations,
  invitationsLoading,
  latestInviteUrl,
  latestInviteDelivery,
  email,
  role,
  inviting,
  updatingMemberId,
  updatingInvitationId,
  onEmailChange,
  onRoleChange,
  onInvite,
  onRoleUpdate,
  onRemove,
  onResendInvitation,
  onRevokeInvitation,
  onCopy,
}: {
  members: ProjectMember[]
  loading: boolean
  invitations: ProjectInvitation[]
  invitationsLoading: boolean
  latestInviteUrl: string
  latestInviteDelivery: ProjectInvitation['emailDelivery'] | null
  email: string
  role: ProjectRole
  inviting: boolean
  updatingMemberId: string
  updatingInvitationId: string
  onEmailChange: (email: string) => void
  onRoleChange: (role: ProjectRole) => void
  onInvite: () => void
  onRoleUpdate: (userId: string, role: ProjectRole) => void
  onRemove: (userId: string) => void
  onResendInvitation: (invitationId: string) => void
  onRevokeInvitation: (invitationId: string) => void
  onCopy: (value: string, messageKey: string) => void
}) {
  const { t } = useI18n()
  return (
    <Panel title={t('settings.members.title')} description={t('settings.members.description')}>
      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-sm text-slate-300">{t('settings.members.email')}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="teammate@example.com"
              className="app-control w-full px-3 text-sm"
            />
            <span className="mt-1.5 block text-xs text-slate-500">{t('settings.invitations.emailHint')}</span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">{t('settings.members.role')}</span>
            <select value={role} onChange={(event) => onRoleChange(event.target.value as ProjectRole)} className="app-control w-full px-3 text-sm">
              {roleOptions.map((item) => (
                <option key={item} value={item}>
                  {t(`role.${item}`)}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={onInvite}
            disabled={inviting}
            className="app-button mt-0 inline-flex items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 lg:mt-[30px]"
          >
            <UserPlus className="h-4 w-4" />
            {inviting ? t('settings.members.inviting') : t('settings.invitations.create')}
          </button>
        </div>

        {latestInviteUrl && (
          <div className="app-panel-muted grid gap-3 p-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-indigo-300">
              <Link2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-medium text-slate-100">{t('settings.invitations.latestLink')}</div>
                <InvitationEmailDeliveryBadge delivery={latestInviteDelivery} />
              </div>
              <div className="mt-1 truncate font-mono text-xs text-slate-500">{latestInviteUrl}</div>
            </div>
            <button
              onClick={() => onCopy(latestInviteUrl, 'settings.toast.invitationLinkCopied')}
              className="app-button inline-flex items-center justify-center gap-2 border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-800"
            >
              <Copy className="h-4 w-4" />
              {t('settings.invitations.copyLink')}
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md bg-slate-800/70" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <EmptyState title={t('settings.members.emptyTitle')} description={t('settings.members.emptyDescription')} />
        ) : (
          <div className="overflow-x-auto rounded-md border border-line">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[minmax(0,1fr)_160px_180px_120px] gap-3 border-b border-line bg-slate-950/45 px-4 py-2.5 text-xs font-medium text-slate-500">
                <span>{t('settings.members.member')}</span>
                <span>{t('settings.members.role')}</span>
                <span>{t('settings.members.joined')}</span>
                <span className="text-right">{t('settings.members.remove')}</span>
              </div>
              <div className="divide-y divide-line">
                {members.map((member) => (
                  <div key={member.userId} className="grid min-h-[68px] grid-cols-[minmax(0,1fr)_160px_180px_120px] items-center gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-100">{member.name || member.email}</div>
                      <div className="mt-1 truncate font-mono text-xs text-slate-500">{member.email}</div>
                    </div>
                    <select
                      value={member.role}
                      disabled={updatingMemberId === member.userId}
                      onChange={(event) => onRoleUpdate(member.userId, event.target.value as ProjectRole)}
                      className="app-control min-h-9 px-2 text-sm"
                    >
                      {roleOptions.map((item) => (
                        <option key={item} value={item}>
                          {t(`role.${item}`)}
                        </option>
                      ))}
                    </select>
                    <span className="font-mono text-xs text-slate-500">{formatFullDateTime(member.createdAt)}</span>
                    <button
                      onClick={() => onRemove(member.userId)}
                      disabled={updatingMemberId === member.userId}
                      className="app-button ml-auto inline-flex items-center justify-center gap-2 border border-danger/35 bg-danger/10 px-3 text-sm text-red-200 hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('settings.members.remove')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-line pt-4">
          <div className="mb-3">
            <div className="text-sm font-semibold text-slate-100">{t('settings.invitations.title')}</div>
            <div className="mt-1 text-xs text-slate-500">{t('settings.invitations.description')}</div>
          </div>
          {invitationsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-md bg-slate-800/70" />
              ))}
            </div>
          ) : invitations.length === 0 ? (
            <EmptyState title={t('settings.invitations.emptyTitle')} description={t('settings.invitations.emptyDescription')} />
          ) : (
            <div className="overflow-x-auto rounded-md border border-line">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[minmax(0,1fr)_120px_130px_180px_170px] gap-3 border-b border-line bg-slate-950/45 px-4 py-2.5 text-xs font-medium text-slate-500">
                  <span>{t('settings.invitations.email')}</span>
                  <span>{t('settings.members.role')}</span>
                  <span>{t('settings.invitations.status')}</span>
                  <span>{t('settings.invitations.expires')}</span>
                  <span className="text-right">{t('settings.invitations.actions')}</span>
                </div>
                <div className="divide-y divide-line">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="grid min-h-[64px] grid-cols-[minmax(0,1fr)_120px_130px_180px_170px] items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">{invitation.email}</div>
                        <div className="mt-1 truncate font-mono text-xs text-slate-500">
                          {invitation.inviterEmail ? t('settings.invitations.invitedBy', { email: invitation.inviterEmail }) : invitation.id}
                        </div>
                        {invitation.emailDelivery && (
                          <div className="mt-2">
                            <InvitationEmailDeliveryBadge delivery={invitation.emailDelivery} />
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-slate-300">{t(`role.${invitation.role}`)}</span>
                      <InvitationStatusBadge status={invitation.status} />
                      <span className="font-mono text-xs text-slate-500">{formatFullDateTime(invitation.expiresAt)}</span>
                      <div className="flex justify-end gap-2">
                        {invitation.inviteUrl && (
                          <button
                            onClick={() => onCopy(invitation.inviteUrl!, 'settings.toast.invitationLinkCopied')}
                            className="app-button inline-flex items-center justify-center border border-slate-700 px-2 text-slate-200 hover:bg-slate-800"
                            title={t('settings.invitations.copyLink')}
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        )}
                        {(invitation.status === 'pending' || invitation.status === 'expired') && (
                          <button
                            onClick={() => onResendInvitation(invitation.id)}
                            disabled={updatingInvitationId === invitation.id}
                            className="app-button inline-flex items-center justify-center border border-slate-700 px-2 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            title={t('settings.invitations.resend')}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}
                        {invitation.status === 'pending' && (
                          <button
                            onClick={() => onRevokeInvitation(invitation.id)}
                            disabled={updatingInvitationId === invitation.id}
                            className="app-button inline-flex items-center justify-center border border-danger/35 bg-danger/10 px-2 text-red-200 hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-50"
                            title={t('settings.invitations.revoke')}
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  )
}

function InvitationStatusBadge({ status }: { status: ProjectInvitation['status'] }) {
  const { t } = useI18n()
  const className =
    status === 'pending'
      ? 'border-warning/40 bg-warning/10 text-amber-200'
      : status === 'accepted'
        ? 'border-success/35 bg-success/10 text-emerald-200'
        : 'border-slate-700 bg-slate-800 text-slate-300'
  const Icon = status === 'pending' ? Clock3 : status === 'accepted' ? CheckCircle2 : XCircle
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {t(`invitation.status.${status}`)}
    </span>
  )
}

function InvitationEmailDeliveryBadge({ delivery }: { delivery: ProjectInvitation['emailDelivery'] | null | undefined }) {
  const { t } = useI18n()
  if (!delivery) return null

  const className =
    delivery.status === 'sent'
      ? 'border-success/40 bg-success/10 text-emerald-200'
      : delivery.status === 'not_configured'
        ? 'border-warning/40 bg-warning/10 text-amber-200'
        : 'border-danger/40 bg-danger/10 text-red-200'
  const Icon = delivery.status === 'sent' ? CheckCircle2 : delivery.status === 'not_configured' ? Clock3 : XCircle

  return (
    <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-medium ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {t(`invitation.emailDelivery.${delivery.status}`)}
    </span>
  )
}

function sdkSnippet(dsn: string, token: string): string {
  return `import { init } from '@error-tracker/sdk'

init({
  dsn: '${dsn}',
  token: '${token}',
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_RELEASE,
  integrations: {
    console: true,
    performance: true,
    replay: true,
  },
})`
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function positiveInt(value: string, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return Math.min(100_000, Math.max(1, Math.round(numeric)))
}
