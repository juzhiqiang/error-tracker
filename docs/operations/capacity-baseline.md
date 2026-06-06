# Capacity Baseline

**Date:** 2026-06-06  
**Environment:** Local Docker services on Windows developer workstation  
**Load project:** `load-test` (`98b368ce-aa75-4cda-ac5f-195010ed0c09`)  
**Hardware:** Intel Core i5-13600KF, 14 cores / 20 logical processors, 64 GB RAM  
**Services:** `error-tracker-pg`, `error-tracker-redis`, `error-tracker-minio`, API on `http://localhost:3002`

## Parameters

- API migrations were applied before the run.
- API process was restarted from the latest build before source map tests.
- Ingest baseline used `LOAD_REQUESTS=100` and `LOAD_CONCURRENCY=10`.
- Dashboard query baseline used `LOAD_DASHBOARD_REQUESTS=30` and `LOAD_DASHBOARD_CONCURRENCY=5`.
- Replay and source map tests used the default 1 MB, 5 MB, and 10 MB object sizes.

## Ingest

| Requests | Concurrency | Accepted | Rejected | Duration ms | QPS |
| --- | --- | --- | --- | --- | --- |
| 100 | 10 | 100 | 0 | 173 | 578.03 |

## Replay Payload

| Size | Status | Duration ms |
| --- | --- | --- |
| 1 KB smoke | 202 | 17 |
| 1 MB | 413 | 2 |
| 5 MB | 413 | 5 |
| 10 MB | 413 | 9 |

## Source Map Upload

| Size | Status | Duration ms |
| --- | --- | --- |
| 1 MB | 201 | 32 |
| 5 MB | 201 | 55 |
| 10 MB | 201 | 88 |

## Dashboard Queries

| Endpoint | Requests | Statuses | p50 ms | p95 ms | p99 ms |
| --- | --- | --- | --- | --- | --- |
| `/api/issues?projectId=...` | 10 | 200: 10 | 12 | 29 | 29 |
| `/api/stats/issues?projectId=...` | 10 | 200: 10 | 8 | 24 | 24 |
| `/api/stats/performance?projectId=...` | 10 | 200: 10 | 9 | 25 | 25 |

## Docker Snapshot

| Service | CPU | Memory |
| --- | --- | --- |
| `error-tracker-pg` | 0.00% | 78.28 MiB |
| `error-tracker-redis` | 0.70% | 5.06 MiB |
| `error-tracker-minio` | 0.01% | 112.1 MiB |

## Known Limits

- In-memory rate limits are process-local; multi-instance production needs shared counters.
- Local Docker numbers are not cloud production numbers.
- Replay payloads at 1 MB and above currently return `413` before the application-level `REPLAY_MAX_BODY_BYTES` limit can be useful. Increase the Nest/Express JSON body limit and any reverse proxy body-size setting before promising large replay uploads.
- Source map uploads use multipart and accepted 10 MB locally, but production reverse proxy body-size limits still need to be set explicitly.
- Dashboard query latency was measured on the `load-test` data set only; larger issue/event history needs a second run after synthetic data volume increases.
