'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

const STORAGE_KEY = 'error-tracker-theme'
type Theme = 'light' | 'dark'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    const initial = saved === 'light' ? 'light' : 'dark'
    applyTheme(initial)
    setTheme(initial)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  const isDark = theme === 'dark'
  const Icon = isDark ? Sun : Moon
  const label = isDark ? t('theme.light') : t('theme.night')

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      title={label}
      className="app-button inline-flex items-center justify-center gap-2 border border-slate-700 bg-slate-950/70 px-3 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-slate-50"
    >
      <Icon className="h-4 w-4" />
      {!compact && <span>{label}</span>}
    </button>
  )
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}
