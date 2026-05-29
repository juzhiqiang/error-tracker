'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Copy, Plus } from 'lucide-react'

export default function SettingsPage() {
  const [projects, setProjects] = useState<{ id: string; name: string; slug: string; dsnToken: string }[]>([])
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')

  useEffect(() => {
    api.projects.list().then((p) => setProjects(p as never)).catch(() => {})
  }, [])

  async function createProject() {
    if (!newName || !newSlug) return
    await api.projects.create({ name: newName, slug: newSlug })
    setNewName('')
    setNewSlug('')
    api.projects.list().then((p) => setProjects(p as never))
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">项目设置</h1>
      <section className="bg-surface border border-slate-800 rounded-xl p-5 mb-4">
        <h2 className="font-semibold text-slate-200 mb-3">创建新项目</h2>
        <div className="flex gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="项目名称"
            className="flex-1 bg-background border border-slate-700 rounded-lg px-3 py-2 text-slate-100 min-h-[44px]"
          />
          <input
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="slug（如 utils-plane）"
            className="flex-1 bg-background border border-slate-700 rounded-lg px-3 py-2 text-slate-100 min-h-[44px]"
          />
          <button
            onClick={createProject}
            className="flex items-center gap-2 px-4 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> 创建
          </button>
        </div>
      </section>
      <div className="space-y-3">
        {projects.map((p) => {
          const dsn = `${process.env.NEXT_PUBLIC_API_URL}/ingest/${p.id}/${p.dsnToken}`
          return (
            <div key={p.id} className="bg-surface border border-slate-800 rounded-xl p-5">
              <div className="flex items-baseline gap-3 mb-3">
                <h3 className="font-semibold text-slate-100">{p.name}</h3>
                <span className="text-slate-500 text-xs font-mono">{p.slug}</span>
              </div>
              <label className="block">
                <span className="text-sm text-slate-400 mb-1.5 block">DSN</span>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={dsn}
                    className="flex-1 bg-background border border-slate-700 rounded-lg px-3 py-2 text-slate-300 font-mono text-xs min-h-[44px]"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(dsn)}
                    className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg min-h-[44px]"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
