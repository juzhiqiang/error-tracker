import { describe, expect, it, mock } from 'bun:test'
import { AiProviderService } from './ai-provider.service'

describe('AiProviderService', () => {
  it('returns the fallback analysis when OpenAI is not configured', async () => {
    const service = new AiProviderService({}, {})
    const fallback = { summary: 'local', recommendations: [] }

    await expect(service.generate('issue', '{}', fallback as never)).resolves.toEqual({
      ...fallback,
      provider: 'local',
      model: 'local-rules',
    })
  })

  it('calls OpenAI Responses API with a JSON schema when configured', async () => {
    const sender = mock(async () =>
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            summary: 'model summary',
            probableCause: 'model cause',
            priority: 'medium',
            confidence: 'medium',
            evidence: ['stack frame'],
            recommendations: [{ title: 'Fix guard', reason: 'undefined value', steps: ['Add null check'] }],
            testsToAdd: ['Regression test'],
          }),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const service = new AiProviderService(
      { OPENAI_API_KEY: 'sk-test', OPENAI_MODEL: 'gpt-test' },
      { sender },
    )

    const result = await service.generate('issue', '{"title":"boom"}', { summary: 'fallback', recommendations: [] } as never)

    expect(result.summary).toBe('model summary')
    expect(result.provider).toBe('openai')
    expect(result.model).toBe('gpt-test')
    const [url, init] = sender.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer sk-test')
    expect(String(init?.body)).toContain('"json_schema"')
  })
})
