export type AiAnalysisKind = 'issue' | 'performance'
export type AiPriority = 'low' | 'medium' | 'high'
export type AiConfidence = 'low' | 'medium' | 'high'

export interface AiRecommendation {
  title: string
  reason: string
  steps: string[]
}

export interface AiAnalysis {
  summary: string
  probableCause: string
  priority: AiPriority
  confidence: AiConfidence
  evidence: string[]
  recommendations: AiRecommendation[]
  testsToAdd: string[]
  provider?: 'local' | 'openai'
  model?: string
}

export interface IssueAiContext {
  issue: {
    id: string
    projectId: string
    title: string
    level: string
    status: string
    count: number
    userCount: number
    fingerprint?: string
  }
  events: Array<{
    id: string
    message: string
    stacktrace?: unknown
    breadcrumbs?: unknown
    request?: unknown
    user?: unknown
    tags?: unknown
    environment?: string | null
    release?: string | null
  }>
}

export interface PerformanceAiContext {
  projectId: string
  window: string
  metrics: Array<{
    name: string
    rating: string
    count: number | string
    avg_value: number | string
  }>
}
