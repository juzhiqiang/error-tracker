export interface ParsedDsn {
  ingestUrl: string
  replayUrl: string
  token?: string
}

export function parseDsn(dsn: string): ParsedDsn {
  try {
    const url = new URL(dsn)
    const parts = url.pathname.split('/').filter(Boolean)
    const ingestIndex = parts.lastIndexOf('ingest')
    const projectId = ingestIndex >= 0 ? parts[ingestIndex + 1] : undefined
    const token = ingestIndex >= 0 ? parts[ingestIndex + 2] : undefined

    if (projectId && token) {
      const baseParts = parts.slice(0, ingestIndex + 2)
      url.pathname = `/${baseParts.join('/')}`
      const ingestUrl = url.toString()
      return { ingestUrl, replayUrl: `${ingestUrl.replace(/\/$/, '')}/replay`, token }
    }
  } catch {
    return { ingestUrl: dsn, replayUrl: `${dsn.replace(/\/$/, '')}/replay` }
  }

  return { ingestUrl: dsn, replayUrl: `${dsn.replace(/\/$/, '')}/replay` }
}
