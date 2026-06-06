import { apiUrl, ensureLoadProject, envNumber, runWorkers } from './common'

const requests = envNumber('LOAD_REQUESTS', 500)
const concurrency = envNumber('LOAD_CONCURRENCY', 20)
const { projectId, token } = await ensureLoadProject()
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
let accepted = 0
let rejected = 0
const started = Date.now()

await runWorkers(requests, concurrency, async (index) => {
  const response = await fetch(`${apiUrl}/ingest/${projectId}/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      events: [
        {
          eventId: `load-${runId}-${index}`,
          timestamp: Date.now(),
          level: 'error',
          message: 'load test event',
          fingerprint: `load-${index % 25}`,
          stacktrace: [{ function: 'loadTest', filename: 'load.js', lineno: 1 }],
          release: 'load-test',
          environment: 'load',
        },
      ],
      sentAt: new Date().toISOString(),
    }),
  })
  if (response.status === 202) accepted += 1
  else rejected += 1
})

const durationMs = Date.now() - started
console.log(JSON.stringify({ projectId, requests, concurrency, accepted, rejected, durationMs, qps: requests / (durationMs / 1000) }, null, 2))
