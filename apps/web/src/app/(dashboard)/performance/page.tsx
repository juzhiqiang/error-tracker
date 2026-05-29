'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '@/lib/api'

const ratingColor: Record<string, string> = {
  good: '#22c55e',
  'needs-improvement': '#f59e0b',
  poor: '#ef4444',
}
const ratingLabel: Record<string, string> = { good: '良好', 'needs-improvement': '需改进', poor: '差' }

export default function PerformancePage() {
  const [data, setData] = useState<{ name: string; rating: string; count: number; avg_value: number }[]>([])

  useEffect(() => {
    api.projects
      .list()
      .then((projects) => {
        const first = projects[0] as { id: string } | undefined
        if (first) api.stats.performance(first.id).then((r) => setData(r as never))
      })
      .catch(() => {})
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">性能概览</h1>
      <p className="text-slate-400 text-sm mb-6">过去 24 小时 Web Vitals 分布</p>
      <div className="grid grid-cols-2 gap-4">
        {['LCP', 'CLS', 'INP', 'TTFB'].map((metric) => {
          const rows = data.filter((d) => d.name === metric)
          return (
            <div key={metric} className="bg-surface border border-slate-800 rounded-xl p-5">
              <h2 className="font-semibold text-slate-200 mb-3">{metric}</h2>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={rows.map((r) => ({ ...r, ratingLabel: ratingLabel[r.rating] }))}>
                  <XAxis dataKey="ratingLabel" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Bar dataKey="count">
                    {rows.map((r, i) => (
                      <Cell key={i} fill={ratingColor[r.rating] ?? '#64748b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        })}
      </div>
    </div>
  )
}
