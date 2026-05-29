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
    if (err) {
      setError(err.message ?? '登录失败')
      return
    }
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-slate-700 p-8 rounded-2xl shadow-2xl w-full max-w-sm space-y-5"
      >
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
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
              required
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300 mb-1.5 block">密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
              required
              autoComplete="current-password"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition min-h-[44px]"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  )
}
