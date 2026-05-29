'use client'
import { useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

export default function ReplayPage() {
  const params = useParams<{ id: string }>()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!params.id) return
    let cancelled = false
    import('rrweb-player')
      .then(({ default: Replayer }) => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${params.id}/replay`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : { events: [] }))
          .then(({ events }) => {
            if (cancelled || !containerRef.current || !events?.length) return
            const ReplayerCtor = Replayer as unknown as new (config: {
              target: HTMLElement
              props: { events: unknown[]; width: number; height: number }
            }) => void
            new ReplayerCtor({
              target: containerRef.current,
              props: { events, width: 1024, height: 576 },
            })
          })
          .catch(() => {})
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [params.id])

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">录屏回放</h1>
      <div ref={containerRef} className="bg-surface border border-slate-800 rounded-xl p-4 min-h-[600px]" />
    </div>
  )
}
