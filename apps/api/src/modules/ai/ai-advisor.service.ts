import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { events, issues, performanceMetrics } from '../../db/schema'
import { scrubPii } from '../ingest/pii-scrubber'
import { AiProviderService } from './ai-provider.service'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { AiAnalysis, IssueAiContext, PerformanceAiContext } from './ai-advisor.types'
import * as schema from '../../db/schema'

@Injectable()
export class AiAdvisorService {
  constructor(
    private readonly provider: AiProviderService,
    @Inject(DB) private readonly db?: PostgresJsDatabase<typeof schema>,
  ) {}

  async analyzeIssueById(issueId: string): Promise<{ projectId: string; analysis: AiAnalysis }> {
    const context = await this.issueContext(issueId)
    const analysis = await this.analyzeIssue(context)
    return { projectId: context.issue.projectId, analysis }
  }

  async analyzePerformanceByProject(projectId: string): Promise<{ projectId: string; analysis: AiAnalysis }> {
    const context = await this.performanceContext(projectId)
    const analysis = await this.analyzePerformance(context)
    return { projectId, analysis }
  }

  async analyzeIssue(context: IssueAiContext): Promise<AiAnalysis> {
    const scrubbed = scrubPii(context)
    return this.provider.generate('issue', JSON.stringify(scrubbed, null, 2), localIssueAnalysis(scrubbed))
  }

  async analyzePerformance(context: PerformanceAiContext): Promise<AiAnalysis> {
    const scrubbed = scrubPii(context)
    return this.provider.generate('performance', JSON.stringify(scrubbed, null, 2), localPerformanceAnalysis(scrubbed))
  }

  private async issueContext(issueId: string): Promise<IssueAiContext> {
    if (!this.db) throw new NotFoundException('AI context unavailable')
    const [issue] = await this.db.select().from(issues).where(eq(issues.id, issueId)).limit(1)
    if (!issue) throw new NotFoundException('Issue not found')
    const rows = await this.db
      .select()
      .from(events)
      .where(eq(events.issueId, issueId))
      .orderBy(sql`${events.timestamp} desc`)
      .limit(5)

    return {
      issue: {
        id: issue.id,
        projectId: issue.projectId,
        title: issue.title,
        level: issue.level,
        status: issue.status,
        count: issue.count,
        userCount: issue.userCount,
        fingerprint: issue.fingerprint,
      },
      events: rows.map((event) => ({
        id: event.id,
        message: event.message,
        stacktrace: event.stacktrace,
        breadcrumbs: event.breadcrumbs,
        request: event.request,
        user: event.user,
        tags: event.tags,
        context: event.context,
        environment: event.environment,
        release: event.release,
      })),
    }
  }

  private async performanceContext(projectId: string): Promise<PerformanceAiContext> {
    if (!this.db) throw new NotFoundException('AI context unavailable')
    const result = await this.db.execute(sql`
      SELECT name, rating, count(*) as count, avg(value) as avg_value
      FROM ${performanceMetrics}
      WHERE project_id = ${projectId}
        AND timestamp >= now() - interval '24 hours'
      GROUP BY name, rating
      ORDER BY name, rating
    `)
    return { projectId, window: '24h', metrics: rowsFrom(result) }
  }
}

function localIssueAnalysis(context: IssueAiContext): AiAnalysis {
  const topEvent = context.events[0]
  const topFrame = firstStackFrame(topEvent?.stacktrace)
  const runtimeEvidence = runtimeEnvironmentEvidence(topEvent?.context)
  const evidence = [
    `${context.issue.count} events across ${context.issue.userCount} users`,
    `Level ${context.issue.level}, status ${context.issue.status}`,
    topFrame ? `Top frame ${topFrame.function} in ${topFrame.filename}:${topFrame.lineno ?? '-'}` : 'No stack frame reported',
    runtimeEvidence,
  ].filter((item): item is string => Boolean(item))
  return {
    summary: `${context.issue.title} is affecting ${context.issue.userCount} users with ${context.issue.count} events.`,
    probableCause: topFrame
      ? `The failure likely starts around ${topFrame.function} in ${topFrame.filename}.`
      : 'The event lacks a resolved stack frame, so start from the latest event message and breadcrumbs.',
    priority: context.issue.level === 'fatal' || context.issue.userCount >= 10 ? 'high' : context.issue.level === 'error' ? 'medium' : 'low',
    confidence: topFrame ? 'medium' : 'low',
    evidence,
    recommendations: [
      {
        title: topFrame ? `Inspect ${topFrame.function}` : 'Reproduce from latest event context',
        reason: topFrame ? 'The top application frame is the closest source location in the captured evidence.' : 'No source frame is available.',
        steps: [
          topFrame ? `Open ${topFrame.filename}:${topFrame.lineno ?? 1}` : 'Open the latest event sample.',
          'Check assumptions around null, undefined, API response shape, and feature flag state.',
          'Add a guard or normalize the input before the failing call.',
        ],
      },
      {
        title: 'Add a regression test',
        reason: 'The issue is already grouped and recurring, so a focused test prevents the same failure from returning.',
        steps: ['Create a test using the failing route/context.', 'Assert the error path is handled and telemetry no longer reports this exception.'],
      },
    ],
    testsToAdd: ['Unit test for the failing function input shape', 'Integration test for the affected route or workflow'],
  }
}

function runtimeEnvironmentEvidence(context: unknown): string | null {
  if (!isRecord(context)) return null
  const environment = isRecord(context.environment) ? context.environment : null
  if (!environment) return null
  const network = isRecord(environment.network) ? environment.network : null
  const performance = isRecord(environment.performance) ? environment.performance : null
  const userAgent = isRecord(environment.userAgent) ? environment.userAgent : null
  const browser = isRecord(userAgent?.browser) ? userAgent.browser : null
  const os = isRecord(userAgent?.os) ? userAgent.os : null
  const parts = [
    textPart('browser', browser?.name),
    textPart('os', os?.name),
    textPart('network', network?.quality),
    textPart('performance', performance?.tier),
  ].filter(Boolean)
  return parts.length ? `Runtime profile: ${parts.join(', ')}` : null
}

function localPerformanceAnalysis(context: PerformanceAiContext): AiAnalysis {
  const poor = context.metrics.filter((metric) => metric.rating === 'poor')
  const focus = poor[0] ?? context.metrics.find((metric) => metric.rating === 'needs-improvement') ?? context.metrics[0]
  const recommendations = focus ? [metricRecommendation(focus.name)] : []
  return {
    summary: focus
      ? `${focus.name} is the highest priority metric in the last ${context.window}.`
      : `No performance samples were found in the last ${context.window}.`,
    probableCause: focus ? probableMetricCause(focus.name) : 'No performance evidence is available yet.',
    priority: poor.length > 0 ? 'high' : context.metrics.length > 0 ? 'medium' : 'low',
    confidence: focus ? 'medium' : 'low',
    evidence: context.metrics.map((metric) => `${metric.name} ${metric.rating}: ${metric.count} samples, avg ${Math.round(Number(metric.avg_value ?? 0))}`),
    recommendations,
    testsToAdd: ['Add a Web Vitals budget check for release smoke runs', 'Track the affected route before and after optimization'],
  }
}

function metricRecommendation(name: string) {
  const steps: Record<string, string[]> = {
    LCP: ['Identify the LCP element.', 'Preload critical image/font assets.', 'Reduce server and render-blocking work before first paint.'],
    INP: ['Profile long tasks around the slow interaction.', 'Split expensive handlers and defer non-critical work.', 'Avoid synchronous layout reads after writes.'],
    CLS: ['Reserve dimensions for images, embeds, and ads.', 'Avoid inserting content above existing content.', 'Use transform animations instead of layout-changing properties.'],
    TTFB: ['Check API/database latency on the initial document request.', 'Add caching where the route is cacheable.', 'Move slow work out of the request path.'],
    FID: ['Reduce boot-time JavaScript.', 'Defer non-critical third-party scripts.', 'Break long startup tasks into smaller chunks.'],
  }
  return {
    title: `Optimize ${name}`,
    reason: probableMetricCause(name),
    steps: steps[name] ?? ['Inspect samples by route and browser.', 'Compare the current release with the previous healthy release.'],
  }
}

function probableMetricCause(name: string): string {
  return (
    {
      LCP: 'The largest visible content is likely waiting on resource load, server response, or render-blocking work.',
      INP: 'User interactions are likely blocked by long JavaScript tasks or expensive rendering.',
      CLS: 'Layout is shifting after initial render, often from late-loading media or injected content.',
      TTFB: 'The document request is likely waiting on server, network, cache, or database work.',
      FID: 'The main thread is likely busy during initial input.',
    }[name] ?? 'The metric needs route-level sample inspection.'
  )
}

function firstStackFrame(stacktrace: unknown): { function?: string; filename?: string; lineno?: number } | null {
  return Array.isArray(stacktrace) && stacktrace[0] ? (stacktrace[0] as never) : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textPart(label: string, value: unknown): string | null {
  return typeof value === 'string' && value ? `${label} ${value}` : null
}

function rowsFrom<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] }).rows ?? [])
}
