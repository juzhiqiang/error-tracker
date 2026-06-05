import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { I18nProvider } from '@/lib/i18n'
import './globals.css'

export const metadata: Metadata = {
  title: 'Error Tracker',
  description: 'Error monitoring, performance metrics, breadcrumbs, stack traces, and session replay.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className="bg-background text-slate-200 antialiased">
        <I18nProvider>
          {children}
          <Toaster theme="dark" richColors position="top-right" closeButton />
        </I18nProvider>
      </body>
    </html>
  )
}
