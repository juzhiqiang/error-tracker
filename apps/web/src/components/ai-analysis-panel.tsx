'use client'

import type { ReactNode } from 'react'
import { BrainCircuit, CheckCircle2, FlaskConical, Lightbulb, ListChecks, Sparkles, TriangleAlert } from 'lucide-react'
import { Panel } from '@/components/panel'
import type { AiAnalysis, AiConfidence, AiPriority } from '@/lib/api'
import { useI18n } from '@/lib/i18n'

export function AiAnalysisPanel({
  title,
  description,
  analyzeLabel,
  emptyTitle,
  emptyDescription,
  analysis,
  loading,
  error,
  disabled = false,
  onAnalyze,
}: {
  title: string
  description: string
  analyzeLabel: string
  emptyTitle: string
  emptyDescription: string
  analysis: AiAnalysis | null
  loading: boolean
  error: string
  disabled?: boolean
  onAnalyze: () => void
}) {
  const { t } = useI18n()

  return (
    <Panel
      title={title}
      description={description}
      className="relative"
      action={
        <button
          type="button"
          disabled={disabled || loading}
          onClick={onAnalyze}
          className="app-button inline-flex min-h-[44px] items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {loading ? t('ai.action.generating') : analyzeLabel}
        </button>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading && !analysis ? (
          <div className="space-y-3">
            <div className="h-20 animate-pulse rounded-md bg-slate-800/70" />
            <div className="grid gap-3 md:grid-cols-3">
              <div className="h-16 animate-pulse rounded-md bg-slate-800/55" />
              <div className="h-16 animate-pulse rounded-md bg-slate-800/55" />
              <div className="h-16 animate-pulse rounded-md bg-slate-800/55" />
            </div>
          </div>
        ) : analysis ? (
          <AnalysisBody analysis={analysis} />
        ) : (
          <div className="app-panel-muted flex min-h-[116px] items-start gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-indigo-300">
              <BrainCircuit className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-100">{emptyTitle}</div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{emptyDescription}</p>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}

function AnalysisBody({ analysis }: { analysis: AiAnalysis }) {
  const { t } = useI18n()
  const provider = analysis.provider ? t(`ai.provider.${analysis.provider}`) : t('ai.provider.unknown')

  return (
    <div className="space-y-4">
      <div className="app-panel-muted p-4">
        <div className="flex flex-wrap items-center gap-2">
          <AnalysisBadge tone={priorityTone(analysis.priority)} label={`${t('ai.label.priority')}: ${t(`ai.priority.${analysis.priority}`)}`} />
          <AnalysisBadge tone={confidenceTone(analysis.confidence)} label={`${t('ai.label.confidence')}: ${t(`ai.confidence.${analysis.confidence}`)}`} />
          <AnalysisBadge tone="neutral" label={`${t('ai.label.provider')}: ${provider}`} />
          {analysis.model && <AnalysisBadge tone="neutral" label={`${t('ai.label.model')}: ${analysis.model}`} />}
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-200">{analysis.summary}</p>
        <div className="mt-3 rounded-md border border-slate-700/80 bg-slate-950/45 p-3 text-sm leading-6 text-slate-300">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-400">
            <TriangleAlert className="h-4 w-4 text-amber-300" />
            {t('ai.label.probableCause')}
          </div>
          {analysis.probableCause}
        </div>
      </div>

      {analysis.evidence.length > 0 && (
        <Section title={t('ai.label.evidence')} icon={<ListChecks className="h-4 w-4 text-indigo-300" />}>
          <ul className="grid gap-2">
            {analysis.evidence.map((item, index) => (
              <li key={`${item}-${index}`} className="flex gap-2 text-sm leading-6 text-slate-300">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t('ai.label.recommendations')} icon={<Lightbulb className="h-4 w-4 text-amber-300" />}>
        <div className="grid gap-3">
          {analysis.recommendations.map((item, index) => (
            <div key={`${item.title}-${index}`} className="rounded-md border border-slate-700/80 bg-slate-950/35 p-3">
              <div className="text-sm font-semibold text-slate-100">{item.title}</div>
              <p className="mt-1 text-sm leading-6 text-slate-400">{item.reason}</p>
              <ol className="mt-3 space-y-2">
                {item.steps.map((step, stepIndex) => (
                  <li key={`${step}-${stepIndex}`} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 text-sm leading-6 text-slate-300">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/25 bg-primary/10 font-mono text-[11px] text-indigo-300">
                      {stepIndex + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Section>

      {analysis.testsToAdd.length > 0 && (
        <Section title={t('ai.label.tests')} icon={<FlaskConical className="h-4 w-4 text-sky-300" />}>
          <div className="flex flex-wrap gap-2">
            {analysis.testsToAdd.map((item, index) => (
              <span key={`${item}-${index}`} className="rounded-md border border-info/25 bg-info/10 px-2 py-1 text-xs leading-5 text-sky-200">
                {item}
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="app-panel-muted p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

function AnalysisBadge({ tone, label }: { tone: 'danger' | 'warning' | 'success' | 'neutral' | 'primary'; label: string }) {
  const toneClass = {
    danger: 'border-danger/35 bg-danger/10 text-red-200',
    warning: 'border-warning/40 bg-warning/10 text-amber-200',
    success: 'border-success/35 bg-success/10 text-emerald-200',
    primary: 'border-primary/35 bg-primary/10 text-indigo-200',
    neutral: 'border-slate-700 bg-slate-900/70 text-slate-300',
  }[tone]
  return <span className={`inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-medium ${toneClass}`}>{label}</span>
}

function priorityTone(priority: AiPriority) {
  return priority === 'high' ? 'danger' : priority === 'medium' ? 'warning' : 'success'
}

function confidenceTone(confidence: AiConfidence) {
  return confidence === 'high' ? 'success' : confidence === 'medium' ? 'primary' : 'neutral'
}
