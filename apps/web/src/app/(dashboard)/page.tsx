'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { AlertTriangle, Users, TrendingUp } from 'lucide-react'

export default function OverviewPage() {
  const [stats, setStats] = useState({ totalIssues: 0, affectedUsers: 0, trend: 0 })

  useEffect(() => {
    api.projects
      .list()
      .then((projects) => {
        const first = projects[0] as { id: string } | undefined
        if (first)
          api.stats.issues(first.id).then((data) => {
            setStats({
              totalIssues: (data as unknown[]).length,
              affectedUsers: 0,
              trend: 0,
            })
          })
      })
      .catch(() => {})
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">概览</h1>
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<AlertTriangle className="w-5 h-5 text-danger" />} label="错误总数" value={stats.totalIssues} />
        <StatCard icon={<Users className="w-5 h-5 text-warning" />} label="影响用户" value={stats.affectedUsers} />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-success" />}
          label="过去 24h 趋势"
          value={`${stats.trend > 0 ? '+' : ''}${stats.trend}%`}
        />
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-surface border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-3xl font-bold text-slate-100 font-mono">{value}</div>
    </div>
  )
}
