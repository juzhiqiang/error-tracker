'use client'

import { Languages } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n()
  const nextLocale = locale === 'en' ? 'zh' : 'en'
  const label = locale === 'en' ? t('locale.switchToZh') : t('locale.switchToEn')

  return (
    <button
      type="button"
      onClick={() => setLocale(nextLocale)}
      title={label}
      className="app-button inline-flex items-center justify-center gap-2 border border-slate-700 bg-slate-950/70 px-3 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-slate-50"
    >
      <Languages className="h-4 w-4" />
      {!compact && <span>{label}</span>}
    </button>
  )
}
