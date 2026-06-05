# Task P5-08: 容量与压测基线

**计划：** Plan 5  
**批次：** 正式生产补齐  
**目标：** 建立可重复运行的容量测试，明确 ingest QPS、批量事件、replay 大对象、source map 大文件和 Dashboard 查询延迟基线。

## 验收标准

- 有脚本可以压测 `/ingest/:projectId/:token`。
- 有脚本可以上传大 replay payload 和大 source map 文件。
- 有脚本可以测 Dashboard API 查询延迟。
- 生成 `docs/operations/capacity-baseline.md`，记录硬件环境、参数、结果和已知瓶颈。
- 压测不污染正式项目，使用独立 `load-test` 项目。

## 文件

- Create: `scripts/load/ingest-load.ts`
- Create: `scripts/load/replay-load.ts`
- Create: `scripts/load/sourcemap-load.ts`
- Create: `scripts/load/dashboard-query-load.ts`
- Create: `docs/operations/capacity-baseline.md`
- Modify: `package.json`

## 步骤

- [ ] **Step 1: 增加 load scripts**

在 root `package.json` 增加：

```json
{
  "scripts": {
    "load:ingest": "bun scripts/load/ingest-load.ts",
    "load:replay": "bun scripts/load/replay-load.ts",
    "load:sourcemap": "bun scripts/load/sourcemap-load.ts",
    "load:dashboard": "bun scripts/load/dashboard-query-load.ts"
  }
}
```

- [ ] **Step 2: 创建 ingest 压测脚本**

创建 `scripts/load/ingest-load.ts`：

```typescript
const apiUrl = process.env.ERROR_TRACKER_API_URL ?? 'http://localhost:3002'
const projectId = process.env.ERROR_TRACKER_PROJECT_ID!
const token = process.env.ERROR_TRACKER_DSN_TOKEN!
const requests = Number(process.env.LOAD_REQUESTS ?? 500)
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 20)

if (!projectId || !token) {
  throw new Error('ERROR_TRACKER_PROJECT_ID and ERROR_TRACKER_DSN_TOKEN are required')
}

let sent = 0
let accepted = 0
let rejected = 0
const started = Date.now()

async function sendOne(index: number) {
  const res = await fetch(`${apiUrl}/ingest/${projectId}/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      events: [
        {
          eventId: `load-${Date.now()}-${index}`,
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
  if (res.status === 202) accepted += 1
  else rejected += 1
}

async function worker() {
  while (sent < requests) {
    const index = sent++
    await sendOne(index)
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()))
const durationMs = Date.now() - started

console.log(JSON.stringify({ requests, concurrency, accepted, rejected, durationMs, qps: requests / (durationMs / 1000) }, null, 2))
```

- [ ] **Step 3: 创建 replay 和 sourcemap 大对象脚本**

`replay-load.ts` 生成 1 MB、5 MB、10 MB rrweb payload 并 POST replay endpoint。  
`sourcemap-load.ts` 生成 1 MB、5 MB、10 MB `.map` 文件并上传到 `/api/sourcemaps/:projectId/:release`。

每个脚本输出 JSON：

```json
{
  "sizeBytes": 1048576,
  "status": 202,
  "durationMs": 123
}
```

- [ ] **Step 4: 创建 Dashboard 查询脚本**

`dashboard-query-load.ts` 调用：

- `/api/issues?projectId=...`
- `/api/stats/issues?projectId=...`
- `/api/stats/performance?projectId=...`

记录 p50、p95、p99。

- [ ] **Step 5: 执行基线测试**

```bash
bun run services:up
bun run load:ingest
bun run load:replay
bun run load:sourcemap
bun run load:dashboard
```

- [ ] **Step 6: 写容量报告**

创建 `docs/operations/capacity-baseline.md`：

```markdown
# Capacity Baseline

**Date:** 2026-06-06
**Environment:** Local Docker services on developer workstation

## Ingest

| Requests | Concurrency | Accepted | Rejected | Duration ms | QPS |
| --- | --- | --- | --- | --- | --- |

## Replay payload

| Size | Status | Duration ms |
| --- | --- | --- |

## Source map upload

| Size | Status | Duration ms |
| --- | --- | --- |

## Dashboard queries

| Endpoint | p50 ms | p95 ms | p99 ms |
| --- | --- | --- | --- |

## Known Limits

- In-memory rate limits are process-local.
- Local Docker numbers are not cloud production numbers.
- Large replay payloads depend on MinIO and reverse proxy body-size settings.
```

- [ ] **Step 7: 验证**

```bash
bun scripts/load/ingest-load.ts
bun scripts/load/dashboard-query-load.ts
```

Expected: scripts print JSON results and exit 0.

- [ ] **Step 8: 提交**

```bash
git add package.json scripts/load docs/operations/capacity-baseline.md
git commit -m "docs: 增加容量压测基线"
```
