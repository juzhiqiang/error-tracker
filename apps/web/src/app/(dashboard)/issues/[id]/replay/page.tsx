'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Camera, Clock3, Film, MousePointerClick, Play, ServerCrash } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { LevelBadge, StatusBadge } from '@/components/status-badge'
import { api, type EventRow, type Issue } from '@/lib/api'
import { formatFullDateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'

export default function ReplayPage() {
  const { t } = useI18n()
  const params = useParams<{ id: string }>()
  const issueId = params.id
  const containerRef = useRef<HTMLDivElement>(null)
  const [issue, setIssue] = useState<Issue | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [statusKey, setStatusKey] = useState('replay.loadingContext')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!issueId) return
    setLoading(true)
    Promise.all([api.issues.get(issueId), api.issues.events(issueId)])
      .then(([issueResult, eventResult]) => {
        const ordered = [...eventResult].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setIssue(issueResult)
        setEvents(ordered)
        setSelectedEventId((current) => current || ordered[0]?.id || '')
      })
      .catch(() => setStatusKey('replay.contextError'))
      .finally(() => setLoading(false))
  }, [issueId])

  useEffect(() => {
    if (!selectedEventId) return
    let cancelled = false
    setStatusKey('replay.loadingData')

    async function loadReplay() {
      const [{ default: Replayer }, replay] = await Promise.all([import('rrweb-player'), api.events.replay(selectedEventId)])
      if (cancelled || !containerRef.current) return
      if (!replay.events.length) {
        containerRef.current.innerHTML = ''
        setStatusKey('replay.noReplay')
        return
      }

      const width = Math.max(720, Math.min(1120, containerRef.current.clientWidth - 32))
      containerRef.current.innerHTML = ''
      const ReplayerCtor = Replayer as unknown as new (config: {
        target: HTMLElement
        props: { events: unknown[]; width: number; height: number; autoPlay: boolean }
      }) => void
      new ReplayerCtor({
        target: containerRef.current,
        props: { events: replay.events, width, height: Math.round(width * 0.5625), autoPlay: false },
      })
      setStatusKey('')
    }

    loadReplay().catch(() => {
      if (!cancelled) setStatusKey('replay.loadError')
    })

    return () => {
      cancelled = true
    }
  }, [selectedEventId])

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? events[0],
    [events, selectedEventId],
  )
  const status = statusKey ? t(statusKey) : ''

  return (
    <div className="space-y-5">
      <header className="space-y-4">
        <Link href={`/issues/${issueId}`} className="app-button inline-flex items-center gap-2 px-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100">
          <ArrowLeft className="h-4 w-4" />
          {t('common.backToIssue')}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-300">{t('replay.eyebrow')}</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50 sm:text-[28px]">{t('replay.title')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              {t('replay.description')}
            </p>
          </div>
          {issue && (
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={issue.status} />
              <LevelBadge level={issue.level} />
            </div>
          )}
        </div>
      </header>

      {issue && (
        <section className="app-panel p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <div className="break-words font-mono text-lg font-semibold text-slate-50">{issue.title}</div>
              <div className="mt-2 break-all font-mono text-xs text-slate-500">{issue.fingerprint}</div>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-500">{t('replay.eventSample')}</span>
              <select
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                className="app-control w-full px-3 text-sm"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {formatFullDateTime(event.timestamp)} / {event.environment || t('common.unknown')}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="app-panel overflow-hidden">
          <div className="app-panel-header flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{t('replay.player.title')}</h2>
              <p className="mt-1 text-xs text-slate-400">{t('replay.player.description')}</p>
            </div>
            <div className="app-button inline-flex items-center gap-2 border border-slate-700 px-3 text-sm text-slate-300">
              <Film className="h-4 w-4" />
              rrweb
            </div>
          </div>
          <div className="min-h-[520px] overflow-x-auto p-4">
            {status && (
              <EmptyState
                title={status}
                description={loading ? t('replay.emptyLoading') : t('replay.emptyMissing')}
              />
            )}
            <div ref={containerRef} />
          </div>
        </div>

        <aside className="space-y-4">
          <InfoCard icon={<Camera className="h-4 w-4 text-indigo-300" />} label={t('replay.info.eventTime')} value={selectedEvent ? formatFullDateTime(selectedEvent.timestamp) : '-'} />
          <InfoCard icon={<ServerCrash className="h-4 w-4 text-red-300" />} label={t('replay.info.environmentRelease')} value={`${selectedEvent?.environment || '-'} / ${selectedEvent?.release || '-'}`} />
          <InfoCard icon={<Clock3 className="h-4 w-4 text-amber-300" />} label={t('replay.info.samples')} value={`${events.length}`} />
          <InfoCard icon={<MousePointerClick className="h-4 w-4 text-emerald-300" />} label={t('replay.info.hint')} value={t('replay.info.hintValue')} />
          <Link
            href={`/issues/${issueId}`}
            className="app-button inline-flex w-full items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <Play className="h-4 w-4" />
            {t('replay.openEvidence')}
          </Link>
        </aside>
      </section>
    </div>
  )
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="app-panel p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 break-words font-mono text-sm text-slate-100">{value}</div>
    </div>
  )
}
