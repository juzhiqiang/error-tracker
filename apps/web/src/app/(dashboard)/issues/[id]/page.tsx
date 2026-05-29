'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import Link from 'next/link'
import { Play } from 'lucide-react'

interface Issue {
  id: string
  title: string
  status: string
  count: number
  firstSeen: string
  lastSeen: string
}
interface EventRow {
  id: string
  message: string
  stacktrace: { function: string; filename: string; lineno: number }[] | null
  breadcrumbs: { timestamp: number; type: string; message?: string }[] | null
  user: Record<string, string> | null
  environment: string | null
  release: string | null
  timestamp: string
}

export default function IssuePage() {
  const params = useParams<{ id: string }>()
  const [issue, setIssue] = useState<Issue | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])

  useEffect(() => {
    if (!params.id) return
    api.issues.get(params.id).then((i) => setIssue(i as Issue)).catch(() => {})
    api.issues.events(params.id).then((e) => setEvents(e as EventRow[])).catch(() => {})
  }, [params.id])

  if (!issue) return <div className="text-slate-500">加载中...</div>
  const latest = events[0]

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold font-mono text-slate-100 break-all">{issue.title}</h1>
          <p className="text-slate-400 text-sm mt-2 font-mono">
            首次: {new Date(issue.firstSeen).toLocaleString('zh')} · 最近:{' '}
            {new Date(issue.lastSeen).toLocaleString('zh')} ·<span className="text-slate-200"> {issue.count} 次</span>
          </p>
        </div>
        <Link
          href={`/issues/${params.id}/replay`}
          className="flex items-center gap-2 px-4 py-2 bg-surface border border-slate-700 rounded-lg text-slate-200 hover:bg-slate-800 text-sm font-medium min-h-[44px] shrink-0"
        >
          <Play className="w-4 h-4" /> 查看录屏
        </Link>
      </div>

      {latest && (
        <>
          <section className="bg-surface border border-slate-800 rounded-xl p-5">
            <h2 className="font-semibold text-slate-200 mb-3">Stack Trace</h2>
            <pre className="font-mono text-xs bg-background border border-slate-800 rounded-lg p-4 overflow-x-auto text-slate-300 leading-relaxed">
              {latest.stacktrace?.map((f) => `  at ${f.function} (${f.filename}:${f.lineno})`).join('\n')}
            </pre>
          </section>

          <section className="bg-surface border border-slate-800 rounded-xl p-5">
            <h2 className="font-semibold text-slate-200 mb-3">Breadcrumbs</h2>
            <div className="space-y-2 border-l-2 border-slate-700 pl-4">
              {latest.breadcrumbs?.map((b, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-slate-500 font-mono w-20 shrink-0">
                    {new Date(b.timestamp).toLocaleTimeString('zh')}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-xs h-fit">{b.type}</span>
                  <span className="text-slate-200">{b.message}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-surface border border-slate-800 rounded-xl p-5">
            <h2 className="font-semibold text-slate-200 mb-3">环境信息</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Environment</dt>
                <dd className="font-mono text-slate-200">{latest.environment}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Release</dt>
                <dd className="font-mono text-slate-200">{latest.release}</dd>
              </div>
            </dl>
          </section>
        </>
      )}
    </div>
  )
}
