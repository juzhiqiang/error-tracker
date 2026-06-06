import { Inject, Injectable, Optional } from '@nestjs/common'
import type { AiAnalysis, AiAnalysisKind } from './ai-advisor.types'

export const AI_PROVIDER_ENV = Symbol('AI_PROVIDER_ENV')
export const AI_PROVIDER_RUNTIME = Symbol('AI_PROVIDER_RUNTIME')

export interface AiProviderEnv {
  OPENAI_API_KEY?: string
  OPENAI_MODEL?: string
  OPENAI_BASE_URL?: string
}

type Sender = (input: string, init?: RequestInit) => Promise<Response>

export interface AiProviderRuntime {
  sender?: Sender
}

@Injectable()
export class AiProviderService {
  private readonly env: AiProviderEnv
  private readonly sender?: Sender

  constructor(
    @Optional() @Inject(AI_PROVIDER_ENV) env?: AiProviderEnv,
    @Optional() @Inject(AI_PROVIDER_RUNTIME) runtime: AiProviderRuntime = {},
  ) {
    this.env = env ?? process.env
    this.sender = runtime.sender ?? defaultSender()
  }

  async generate(kind: AiAnalysisKind, context: string, fallback: AiAnalysis): Promise<AiAnalysis> {
    const apiKey = this.env.OPENAI_API_KEY?.trim()
    const model = this.env.OPENAI_MODEL?.trim()
    if (!apiKey || !model || !this.sender) {
      return { ...fallback, provider: 'local', model: 'local-rules' }
    }

    try {
      const response = await this.sender(`${this.baseUrl()}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: [
            {
              role: 'system',
              content:
                'You are an observability incident advisor. Return concise JSON only. Ground every recommendation in the supplied evidence.',
            },
            {
              role: 'user',
              content: `${kind} analysis context:\n${context}`,
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'ai_advisor_analysis',
              strict: true,
              schema: analysisJsonSchema,
            },
          },
        }),
      })
      if (!response.ok) return { ...fallback, provider: 'local', model: 'local-rules' }
      const payload = (await response.json()) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }
      const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).find((item) => item.text)?.text
      if (!text) return { ...fallback, provider: 'local', model: 'local-rules' }
      const parsed = JSON.parse(text) as AiAnalysis
      return { ...parsed, provider: 'openai', model }
    } catch {
      return { ...fallback, provider: 'local', model: 'local-rules' }
    }
  }

  private baseUrl(): string {
    return (this.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, '')
  }
}

function defaultSender(): Sender | undefined {
  return typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined
}

const analysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'probableCause', 'priority', 'confidence', 'evidence', 'recommendations', 'testsToAdd'],
  properties: {
    summary: { type: 'string' },
    probableCause: { type: 'string' },
    priority: { type: 'string', enum: ['low', 'medium', 'high'] },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    evidence: { type: 'array', items: { type: 'string' } },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'reason', 'steps'],
        properties: {
          title: { type: 'string' },
          reason: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    testsToAdd: { type: 'array', items: { type: 'string' } },
  },
} as const
