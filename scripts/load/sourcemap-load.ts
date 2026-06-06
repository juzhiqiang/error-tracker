import { createHash } from 'node:crypto'
import { apiUrl, ensureLoadProject, envSizes, timedFetch } from './common'

const sizes = envSizes('LOAD_SOURCEMAP_SIZES', [1, 5, 10].map((mb) => mb * 1024 * 1024))
const release = process.env.LOAD_RELEASE ?? 'load-test'
const { projectId, token } = await ensureLoadProject()

const results = []
for (const sizeBytes of sizes) {
  const filename = `load-${sizeBytes}.js.map`
  const content = sourcemapContent(sizeBytes)
  const checksum = createHash('sha256').update(content).digest('hex')
  const form = new FormData()
  form.append('files', new File([content], filename, { type: 'application/json' }))
  form.append('checksums', JSON.stringify([{ filename, checksum }]))
  const result = await timedFetch(`${apiUrl}/api/sourcemaps/${projectId}/${encodeURIComponent(release)}/ci`, {
    method: 'POST',
    headers: { 'x-error-tracker-token': token },
    body: form,
  })
  results.push({ sizeBytes: content.length, status: result.status, durationMs: result.durationMs, checksum })
}

console.log(JSON.stringify({ projectId, release, results }, null, 2))

function sourcemapContent(sizeBytes: number): string {
  const base = JSON.stringify({ version: 3, file: 'load.js', sources: ['load.ts'], names: [], mappings: '' })
  const padding = Math.max(1, sizeBytes - base.length - 32)
  return JSON.stringify({ version: 3, file: 'load.js', sources: ['load.ts'], names: [], mappings: ';'.repeat(padding) })
}
