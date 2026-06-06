import { apiUrl, ensureLoadProject, envSizes, timedFetch } from './common'

const sizes = envSizes('LOAD_REPLAY_SIZES', [1, 5, 10].map((mb) => mb * 1024 * 1024))
const { projectId, token } = await ensureLoadProject()

const results = []
for (const sizeBytes of sizes) {
  const payload = 'x'.repeat(Math.max(1, sizeBytes - 220))
  const eventId = `load-replay-${Date.now()}-${sizeBytes}`
  const result = await timedFetch(`${apiUrl}/ingest/${projectId}/${token}/replay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId,
      events: [{ type: 2, timestamp: Date.now(), data: { source: 0, payload } }],
    }),
  })
  results.push({ sizeBytes, ...result })
}

console.log(JSON.stringify({ projectId, results }, null, 2))
