'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'

interface EventRow {
  id: string
}

export default function ReplayPage() {
  const params = useParams<{ id: string }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Loading replay...')

  useEffect(() => {
    if (!params.id) return
    let cancelled = false
    setStatus('Loading replay...')

    async function loadReplay() {
      const issueEvents = (await api.issues.events(params.id)) as EventRow[]
      const latestEventId = issueEvents[0]?.id
      if (!latestEventId) {
        setStatus('No events found for this issue.')
        return
      }

      const [{ default: Replayer }, replay] = await Promise.all([import('rrweb-player'), api.events.replay(latestEventId)])
      if (cancelled || !containerRef.current) return
      if (!replay.events.length) {
        setStatus('No replay is available for this event.')
        return
      }

      containerRef.current.innerHTML = ''
      const ReplayerCtor = Replayer as unknown as new (config: {
        target: HTMLElement
        props: { events: unknown[]; width: number; height: number }
      }) => void
      new ReplayerCtor({
        target: containerRef.current,
        props: { events: replay.events, width: 1024, height: 576 },
      })
      setStatus('')
    }

    loadReplay().catch(() => {
      if (!cancelled) setStatus('Replay could not be loaded.')
    })

    return () => {
      cancelled = true
    }
  }, [params.id])

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Replay</h1>
      <div ref={containerRef} className="bg-surface border border-slate-800 rounded-xl p-4 min-h-[600px]">
        {status && <div className="text-slate-500 text-sm">{status}</div>}
      </div>
    </div>
  )
}
