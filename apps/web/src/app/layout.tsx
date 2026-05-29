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
