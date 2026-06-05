'use client'

import { FolderKanban } from 'lucide-react'
import type { Project } from '@/lib/api'
import { useI18n } from '@/lib/i18n'

export function ProjectSelect({
  projects,
  value,
  onChange,
}: {
  projects: Project[]
  value?: string
  onChange: (projectId: string) => void
}) {
  const { t } = useI18n()

  return (
    <label className="flex min-w-0 items-center gap-3 text-sm text-slate-400">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300">
        <FolderKanban className="h-4 w-4" />
      </span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="app-control min-w-0 px-3 text-sm sm:min-w-72"
      >
        {projects.length === 0 ? (
          <option value="">{t('common.noProjects')}</option>
        ) : (
          projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name} / {project.slug}
            </option>
          ))
        )}
      </select>
    </label>
  )
}
