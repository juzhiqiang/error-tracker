import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Bug, Activity, Settings } from 'lucide-react'
import { getServerSession } from '@/lib/auth-server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession()
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
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition min-h-[44px]"
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </Link>
  )
}
