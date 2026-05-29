'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import Link from 'next/link'
import { Search, AlertCircle, CheckCircle2, MinusCircle } from 'lucide-react'

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  unresolved: {
    color: 'text-danger bg-danger/10 border-danger/30',
    icon: <AlertCircle className="w-3 h-3" />,
    label: '未解决',
  },
  resolved: {
    color: 'text-success bg-success/10 border-success/30',
    icon: <CheckCircle2 className="w-3 h-3" />,
    label: '已解决',
  },
  ignored: {
    color: 'text-slate-500 bg-slate-800 border-slate-700',
    icon: <MinusCircle className="w-3 h-3" />,
    label: '已忽略',
  },
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<
    { id: string; title: string; count: number; status: string; lastSeen: string }[]
  >([])
  const [q, setQ] = useState('')
  const [timeRange, setTimeRange] = useState('24h')
  const [status, setStatus] = useState('')

  useEffect(() => {
    api.projects
      .list()
      .then((projects) => {
        const first = projects[0] as { id: string } | undefined
        if (!first) return
        const params: Record<string, string> = { timeRange, projectId: first.id }
        if (q) params.q = q
        if (status) params.status = status
        api.issues.list(params).then((r) => setIssues(r.rows as never))
      })
      .catch(() => {})
  }, [q, timeRange, status])

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">错误</h1>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索错误..."
            className="w-full bg-surface border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-slate-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
          />
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="bg-surface border border-slate-700 rounded-lg px-3 py-2 text-slate-100 min-h-[44px]"
        >
          <option value="1h">最近 1 小时</option>
          <option value="24h">最近 24 小时</option>
          <option value="7d">最近 7 天</option>
          <option value="30d">最近 30 天</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-surface border border-slate-700 rounded-lg px-3 py-2 text-slate-100 min-h-[44px]"
        >
          <option value="">全部状态</option>
          <option value="unresolved">未解决</option>
          <option value="resolved">已解决</option>
          <option value="ignored">已忽略</option>
        </select>
      </div>
      <div className="bg-surface border border-slate-800 rounded-xl overflow-hidden">
        {issues.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">暂无错误</div>
        ) : (
          issues.map((issue) => {
            const cfg = statusConfig[issue.status] ?? statusConfig.unresolved
            return (
              <Link
                key={issue.id}
                href={`/issues/${issue.id}`}
                className="flex items-center px-4 py-3 border-b border-slate-800 last:border-b-0 hover:bg-slate-800/50 gap-4 transition min-h-[60px]"
              >
                <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${cfg.color}`}>
                  {cfg.icon} {cfg.label}
                </span>
                <span className="flex-1 font-mono text-sm text-slate-200 truncate">{issue.title}</span>
                <span className="text-slate-500 text-sm font-mono tabular-nums">{issue.count} 次</span>
                <span className="text-slate-500 text-xs w-32 text-right">
                  {new Date(issue.lastSeen).toLocaleString('zh')}
                </span>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
