import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard-shell'
import { getServerSession } from '@/lib/auth-server'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession()
  if (!session) redirect('/login')

  return <DashboardShell user={session.user}>{children}</DashboardShell>
}
