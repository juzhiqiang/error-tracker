import { headers } from 'next/headers'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002'

export interface ServerSession {
  user: { id: string; email: string; name: string }
  session: { id: string; userId: string }
}

// 服务端读取 session：转发浏览器 cookie 给 API 的 better-auth get-session 端点
export async function getServerSession(): Promise<ServerSession | null> {
  const h = await headers()
  const cookie = h.get('cookie') ?? ''
  try {
    const res = await fetch(`${API}/api/auth/get-session`, {
      headers: { cookie },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return data && data.session ? (data as ServerSession) : null
  } catch {
    return null
  }
}
