const DEFAULT_BODY_PARSER_LIMIT = 5 * 1024 * 1024

export interface BodyParserEnv {
  API_BODY_LIMIT_BYTES?: string
  REPLAY_MAX_BODY_BYTES?: string
}

export function resolveBodyParserLimit(env: BodyParserEnv = process.env): number {
  return positiveInteger(env.API_BODY_LIMIT_BYTES) ?? positiveInteger(env.REPLAY_MAX_BODY_BYTES) ?? DEFAULT_BODY_PARSER_LIMIT
}

function positiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined
  return parsed
}
