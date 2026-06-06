import { apiUrl, ensureLoadProject, envNumber, percentile, runWorkers, timedFetch } from './common'

const requests = envNumber('LOAD_DASHBOARD_REQUESTS', 90)
const concurrency = envNumber('LOAD_DASHBOARD_CONCURRENCY', 6)
const { projectId, cookie } = await ensureLoadProject()
if (!cookie) throw new Error('Dashboard query load requires a signed-in load user')

const endpoints = [
  `/api/issues?projectId=${projectId}`,
  `/api/stats/issues?projectId=${projectId}`,
  `/api/stats/performance?projectId=${projectId}`,
]
const timings = new Map(endpoints.map((endpoint) => [endpoint, [] as number[]]))
const statuses = new Map(endpoints.map((endpoint) => [endpoint, new Map<number, number>()]))

await runWorkers(requests, concurrency, async (index) => {
  const endpoint = endpoints[index % endpoints.length]
  const result = await timedFetch(`${apiUrl}${endpoint}`, { headers: { Cookie: cookie } })
  timings.get(endpoint)!.push(result.durationMs)
  const endpointStatuses = statuses.get(endpoint)!
  endpointStatuses.set(result.status, (endpointStatuses.get(result.status) ?? 0) + 1)
})

console.log(
  JSON.stringify(
    {
      projectId,
      requests,
      concurrency,
      endpoints: endpoints.map((endpoint) => {
        const values = timings.get(endpoint)!
        return {
          endpoint,
          statuses: Object.fromEntries(statuses.get(endpoint)!),
          p50Ms: percentile(values, 50),
          p95Ms: percentile(values, 95),
          p99Ms: percentile(values, 99),
        }
      }),
    },
    null,
    2,
  ),
)
