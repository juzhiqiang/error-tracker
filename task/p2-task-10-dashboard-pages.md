# Task P2-10: Dashboard 所有页面

**计划：** Plan 2  
**依赖：** Task P2-09  
**可并行：** 否  
**预计时间：** 30 min

---

## 目标

实现 Dashboard 所有页面：登录、概览、错误列表/详情/录屏、性能、设置。
使用深色专业风格（dark professional）+ shadcn/ui 组件。

## 设计规范

- **背景**：`#0f172a`（slate-950），卡片 `#1e293b`（slate-800）
- **主色**：`#6366f1`（Indigo），错误 `#ef4444`，成功 `#22c55e`
- **字体**：Inter（UI）+ JetBrains Mono（代码/Stack Trace）
- **触摸目标**：最小 44×44px
- **状态颜色不能只靠颜色**：必须有图标或文字标签

## 需要创建的文件

- `apps/web/src/lib/api.ts`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(dashboard)/layout.tsx`
- `apps/web/src/app/(dashboard)/page.tsx`
- `apps/web/src/app/(dashboard)/issues/page.tsx`
- `apps/web/src/app/(dashboard)/issues/[id]/page.tsx`
- `apps/web/src/app/(dashboard)/issues/[id]/replay/page.tsx`
- `apps/web/src/app/(dashboard)/performance/page.tsx`
- `apps/web/src/app/(dashboard)/settings/page.tsx`

## 步骤

- [ ] **Step 1: 创建 src/lib/api.ts**

```typescript
// apps/web/src/lib/api.ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json()
}

export const api = {
  issues: {
    list: (params: Record<string, string>) =>
      apiFetch<{ rows: unknown[]; total: number }>(`/api/issues?${new URLSearchParams(params)}`),
    get: (id: string) => apiFetch<unknown>(`/api/issues/${id}`),
    update: (id: string, body: { status: string }) =>
      apiFetch(`/api/issues/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  events: {
    get: (id: string) => apiFetch<unknown>(`/api/events/${id}`),
    listByIssue: (issueId: string) => apiFetch<unknown[]>(`/api/issues/${issueId}/events`),
  },
  stats: {
    issues: (projectId: string) => apiFetch<unknown[]>(`/api/stats/issues?projectId=${projectId}`),
    performance: (projectId: string) => apiFetch<unknown[]>(`/api/stats/performance?projectId=${projectId}`),
  },
  projects: {
    list: () => apiFetch<unknown[]>('/api/projects'),
    create: (body: { name: string; slug: string }) =>
      apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  },
}
```

- [ ] **Step 2: 创建 app/layout.tsx**

```typescript
// apps/web/src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'Error Tracker' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className="dark">
      <body className="bg-background text-slate-200 antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: 创建登录页**

```typescript
// apps/web/src/app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error: err } = await authClient.signIn.email({ email, password })
    setLoading(false)
    if (err) { setError(err.message ?? '登录失败'); return }
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="bg-surface border border-slate-700 p-8 rounded-2xl shadow-2xl w-full max-w-sm space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Error Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">登录以查看错误监控数据</p>
        </div>
        {error && (
          <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-slate-300 mb-1.5 block">邮箱</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-background border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
              required autoComplete="email" />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300 mb-1.5 block">密码</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-background border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
              required autoComplete="current-password" />
          </label>
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition min-h-[44px]">
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: 创建 (dashboard)/layout.tsx（侧边栏 + Session 检查）**

```typescript
// apps/web/src/app/(dashboard)/layout.tsx
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Bug, Activity, Settings } from 'lucide-react'
import { auth } from '@/lib/auth-server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <nav className="w-60 bg-surface border-r border-slate-800 p-4 space-y-1 shrink-0">
        <div className="px-3 py-4 mb-2">
          <div className="font-bold text-lg text-slate-100">Error Tracker</div>
          <div className="text-xs text-slate-500 mt-0.5">{session.user.email}</div>
        </div>
        <NavLink href="/" icon={<LayoutDashboard className="w-4 h-4" />} label="概览" />
        <NavLink href="/issues" icon={<Bug className="w-4 h-4" />} label="错误" />
        <NavLink href="/performance" icon={<Activity className="w-4 h-4" />} label="性能" />
        <NavLink href="/settings" icon={<Settings className="w-4 h-4" />} label="设置" />
      </nav>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition min-h-[44px]">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </Link>
  )
}
```

辅助文件 `apps/web/src/lib/auth-server.ts`:

```typescript
// 服务端 auth 实例，仅用于 layout 读取 session
import { betterAuth } from 'better-auth'
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3002',
})
```

- [ ] **Step 5: 创建概览页**

```typescript
// apps/web/src/app/(dashboard)/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { AlertTriangle, Users, TrendingUp } from 'lucide-react'

export default function OverviewPage() {
  const [stats, setStats] = useState({ totalIssues: 0, affectedUsers: 0, trend: 0 })

  useEffect(() => {
    // 简化：实际可从 /api/stats 取
    api.projects.list().then(projects => {
      const first = projects[0] as { id: string } | undefined
      if (first) api.stats.issues(first.id).then(data => {
        setStats({
          totalIssues: (data as unknown[]).length,
          affectedUsers: 0,
          trend: 0,
        })
      })
    })
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">概览</h1>
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<AlertTriangle className="w-5 h-5 text-danger" />} label="错误总数" value={stats.totalIssues} />
        <StatCard icon={<Users className="w-5 h-5 text-warning" />} label="影响用户" value={stats.affectedUsers} />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-success" />} label="过去 24h 趋势" value={`${stats.trend > 0 ? '+' : ''}${stats.trend}%`} />
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
```

- [ ] **Step 6: 创建错误列表页**

```typescript
// apps/web/src/app/(dashboard)/issues/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import Link from 'next/link'
import { Search, AlertCircle, CheckCircle2, MinusCircle } from 'lucide-react'

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  unresolved: { color: 'text-danger bg-danger/10 border-danger/30', icon: <AlertCircle className="w-3 h-3" />, label: '未解决' },
  resolved: { color: 'text-success bg-success/10 border-success/30', icon: <CheckCircle2 className="w-3 h-3" />, label: '已解决' },
  ignored: { color: 'text-slate-500 bg-slate-800 border-slate-700', icon: <MinusCircle className="w-3 h-3" />, label: '已忽略' },
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<{ id: string; title: string; count: number; status: string; lastSeen: string }[]>([])
  const [q, setQ] = useState('')
  const [timeRange, setTimeRange] = useState('24h')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const params: Record<string, string> = { timeRange }
    if (q) params.q = q
    if (status) params.status = status
    api.issues.list(params).then(r => setIssues(r.rows as never))
  }, [q, timeRange, status])

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">错误</h1>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索错误..."
            className="w-full bg-surface border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-slate-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]" />
        </div>
        <select value={timeRange} onChange={e => setTimeRange(e.target.value)}
          className="bg-surface border border-slate-700 rounded-lg px-3 py-2 text-slate-100 min-h-[44px]">
          <option value="1h">最近 1 小时</option>
          <option value="24h">最近 24 小时</option>
          <option value="7d">最近 7 天</option>
          <option value="30d">最近 30 天</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="bg-surface border border-slate-700 rounded-lg px-3 py-2 text-slate-100 min-h-[44px]">
          <option value="">全部状态</option>
          <option value="unresolved">未解决</option>
          <option value="resolved">已解决</option>
          <option value="ignored">已忽略</option>
        </select>
      </div>
      <div className="bg-surface border border-slate-800 rounded-xl overflow-hidden">
        {issues.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">暂无错误</div>
        ) : issues.map(issue => {
          const cfg = statusConfig[issue.status]
          return (
            <Link key={issue.id} href={`/issues/${issue.id}`}
              className="flex items-center px-4 py-3 border-b border-slate-800 last:border-b-0 hover:bg-slate-800/50 gap-4 transition min-h-[60px]">
              <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${cfg.color}`}>
                {cfg.icon} {cfg.label}
              </span>
              <span className="flex-1 font-mono text-sm text-slate-200 truncate">{issue.title}</span>
              <span className="text-slate-500 text-sm font-mono tabular-nums">{issue.count} 次</span>
              <span className="text-slate-500 text-xs w-32 text-right">{new Date(issue.lastSeen).toLocaleString('zh')}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: 创建错误详情页**

```typescript
// apps/web/src/app/(dashboard)/issues/[id]/page.tsx
import { api } from '@/lib/api'
import Link from 'next/link'
import { Play } from 'lucide-react'

export default async function IssuePage({ params }: { params: { id: string } }) {
  const issue = await api.issues.get(params.id) as {
    id: string; title: string; status: string; count: number; firstSeen: string; lastSeen: string
  }
  const events = await api.events.listByIssue(params.id) as {
    id: string; message: string;
    stacktrace: { function: string; filename: string; lineno: number }[];
    breadcrumbs: { timestamp: number; type: string; message?: string }[];
    user: Record<string, string>; environment: string; release: string; timestamp: string
  }[]
  const latest = events[0]

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold font-mono text-slate-100 break-all">{issue.title}</h1>
          <p className="text-slate-400 text-sm mt-2 font-mono">
            首次: {new Date(issue.firstSeen).toLocaleString('zh')} ·
            最近: {new Date(issue.lastSeen).toLocaleString('zh')} ·
            <span className="text-slate-200"> {issue.count} 次</span>
          </p>
        </div>
        <Link href={`/issues/${params.id}/replay`}
          className="flex items-center gap-2 px-4 py-2 bg-surface border border-slate-700 rounded-lg text-slate-200 hover:bg-slate-800 text-sm font-medium min-h-[44px] shrink-0">
          <Play className="w-4 h-4" /> 查看录屏
        </Link>
      </div>

      {latest && (
        <>
          <section className="bg-surface border border-slate-800 rounded-xl p-5">
            <h2 className="font-semibold text-slate-200 mb-3">Stack Trace</h2>
            <pre className="font-mono text-xs bg-background border border-slate-800 rounded-lg p-4 overflow-x-auto text-slate-300 leading-relaxed">
{latest.stacktrace?.map(f => `  at ${f.function} (${f.filename}:${f.lineno})`).join('\n')}
            </pre>
          </section>

          <section className="bg-surface border border-slate-800 rounded-xl p-5">
            <h2 className="font-semibold text-slate-200 mb-3">Breadcrumbs</h2>
            <div className="space-y-2 border-l-2 border-slate-700 pl-4">
              {latest.breadcrumbs?.map((b, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-slate-500 font-mono w-20 shrink-0">{new Date(b.timestamp).toLocaleTimeString('zh')}</span>
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-xs h-fit">{b.type}</span>
                  <span className="text-slate-200">{b.message}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-surface border border-slate-800 rounded-xl p-5">
            <h2 className="font-semibold text-slate-200 mb-3">环境信息</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-500">Environment</dt><dd className="font-mono text-slate-200">{latest.environment}</dd></div>
              <div><dt className="text-slate-500">Release</dt><dd className="font-mono text-slate-200">{latest.release}</dd></div>
            </dl>
          </section>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 8: 创建录屏页**

```typescript
// apps/web/src/app/(dashboard)/issues/[id]/replay/page.tsx
'use client'
import { useEffect, useRef } from 'react'

export default function ReplayPage({ params }: { params: { id: string } }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    import('rrweb-player').then(({ default: Replayer }) => {
      if (!containerRef.current) return
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${params.id}/replay`, { credentials: 'include' })
        .then(r => r.json())
        .then(({ events }) => {
          new (Replayer as never)({ target: containerRef.current!, props: { events, width: 1024, height: 576 } })
        })
    })
  }, [params.id])
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">录屏回放</h1>
      <div ref={containerRef} className="bg-surface border border-slate-800 rounded-xl p-4 min-h-[600px]" />
    </div>
  )
}
```

- [ ] **Step 9: 创建性能页**

```typescript
// apps/web/src/app/(dashboard)/performance/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '@/lib/api'

const ratingColor: Record<string, string> = { good: '#22c55e', 'needs-improvement': '#f59e0b', poor: '#ef4444' }
const ratingLabel: Record<string, string> = { good: '良好', 'needs-improvement': '需改进', poor: '差' }

export default function PerformancePage() {
  const [data, setData] = useState<{ name: string; rating: string; count: number; avg_value: number }[]>([])
  useEffect(() => {
    api.projects.list().then(projects => {
      const first = projects[0] as { id: string } | undefined
      if (first) api.stats.performance(first.id).then(r => setData(r as never))
    })
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">性能概览</h1>
      <p className="text-slate-400 text-sm mb-6">过去 24 小时 Web Vitals 分布</p>
      <div className="grid grid-cols-2 gap-4">
        {['LCP', 'CLS', 'INP', 'TTFB'].map(metric => {
          const rows = data.filter(d => d.name === metric)
          return (
            <div key={metric} className="bg-surface border border-slate-800 rounded-xl p-5">
              <h2 className="font-semibold text-slate-200 mb-3">{metric}</h2>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={rows.map(r => ({ ...r, ratingLabel: ratingLabel[r.rating] }))}>
                  <XAxis dataKey="ratingLabel" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Bar dataKey="count">
                    {rows.map((r, i) => <Cell key={i} fill={ratingColor[r.rating] ?? '#64748b'} />)}
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
```

- [ ] **Step 10: 创建设置页**

```typescript
// apps/web/src/app/(dashboard)/settings/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Copy, Plus } from 'lucide-react'

export default function SettingsPage() {
  const [projects, setProjects] = useState<{ id: string; name: string; slug: string; dsnToken: string }[]>([])
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')

  useEffect(() => { api.projects.list().then(p => setProjects(p as never)) }, [])

  async function createProject() {
    if (!newName || !newSlug) return
    await api.projects.create({ name: newName, slug: newSlug })
    setNewName(''); setNewSlug('')
    api.projects.list().then(p => setProjects(p as never))
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">项目设置</h1>
      <section className="bg-surface border border-slate-800 rounded-xl p-5 mb-4">
        <h2 className="font-semibold text-slate-200 mb-3">创建新项目</h2>
        <div className="flex gap-3">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="项目名称"
            className="flex-1 bg-background border border-slate-700 rounded-lg px-3 py-2 text-slate-100 min-h-[44px]" />
          <input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="slug（如 utils-plane）"
            className="flex-1 bg-background border border-slate-700 rounded-lg px-3 py-2 text-slate-100 min-h-[44px]" />
          <button onClick={createProject}
            className="flex items-center gap-2 px-4 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium min-h-[44px]">
            <Plus className="w-4 h-4" /> 创建
          </button>
        </div>
      </section>
      <div className="space-y-3">
        {projects.map(p => {
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
                  <input readOnly value={dsn}
                    className="flex-1 bg-background border border-slate-700 rounded-lg px-3 py-2 text-slate-300 font-mono text-xs min-h-[44px]" />
                  <button onClick={() => navigator.clipboard.writeText(dsn)}
                    className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg min-h-[44px]">
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
```

- [ ] **Step 11: 启动验证**

```bash
cd D:/myProject/error-tracker
bun run services:up
bun run dev
```

打开 http://localhost:3003，应能看到登录页（深色风格）。

- [ ] **Step 12: 提交**

```bash
git add apps/web/src/
git commit -m "feat: Dashboard 所有页面（登录、概览、错误列表/详情/录屏、性能、设置，深色专业风格）"
```
