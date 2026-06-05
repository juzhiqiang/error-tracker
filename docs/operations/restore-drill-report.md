# Restore Drill Report

**Date:** 2026-06-06
**Operator:** Codex
**Scope:** PostgreSQL logical restore and MinIO object restore for Error Tracker.

## Result

- PostgreSQL restore: Passed
- MinIO restore: Passed
- API health against restored resources: Passed
- Dashboard smoke against restored data: Passed by restored row evidence and issue-detail sample

## Timings

| Step | Started | Finished | Duration |
| --- | --- | --- | --- |
| PostgreSQL backup | 2026-06-06T07:31:22.4902140+08:00 | 2026-06-06T07:31:23.1020332+08:00 | 0.61s |
| PostgreSQL restore | 2026-06-06T07:32:10.5687256+08:00 | 2026-06-06T07:32:11.6992815+08:00 | 1.13s |
| MinIO backup | 2026-06-06T07:33:05.6604294+08:00 | 2026-06-06T07:33:06.4809035+08:00 | 0.82s |
| MinIO restore | 2026-06-06T07:33:16.6106967+08:00 | 2026-06-06T07:33:17.3765289+08:00 | 0.77s |
| API smoke | 2026-06-06T07:38:31.9176295+08:00 | 2026-06-06T07:38:32.8888457+08:00 | 0.97s |

## Evidence

- PostgreSQL backup file: `backups/error_tracker-20260606-073122.dump` (63,890 bytes, ignored by git)
- Restored database: `error_tracker_restore`
- Restored project count: 24
- Restored issue count: 15
- Restored event count: 15
- Restored replay row count: 1
- Restored source map row count: 2
- Restored MinIO bucket: `error-tracker-restore`
- Restored replay object count: 1
- Restored source map object count: 2
- API health response against restored DB and bucket: HTTP 200, `ok: true`, checks `api/db/redis/minio` all `ok`
- Dashboard smoke evidence: restored issue `bd5499de-a7e3-4bce-81b4-4b35267e714d` titled `e2e production smoke error`, event `e2e-1780682236503`, release `web@e2e`, stack frame `runSmoke`
- Replay object evidence: `replays/05147fde-d77c-4f2f-b20a-9e722275255d/codex-event-1780241255069.json`
- Source map object evidence: `sourcemaps/96256991-a8d8-444a-85c2-50bec7a5d14d/web@e2e/app.js.map`
- Source map object evidence: `sourcemaps/cd1f49b6-1e75-4730-8640-5c7444e9d3c9/web@e2e/app.js.map`

## Commands

```powershell
bun run services:up
powershell -ExecutionPolicy Bypass -File scripts/ops/backup-postgres.ps1
powershell -ExecutionPolicy Bypass -File scripts/ops/restore-postgres.ps1 -BackupFile <backup-file>
powershell -ExecutionPolicy Bypass -File scripts/ops/backup-minio.ps1
powershell -ExecutionPolicy Bypass -File scripts/ops/restore-minio.ps1 -BackupDir <backup-dir>
```

API health was verified without taking over port 3002 by starting a one-off Nest HTTP server on a random local port with:

```powershell
DATABASE_URL=postgresql://tracker:tracker@localhost:5434/error_tracker_restore
MINIO_BUCKET=error-tracker-restore
```

## Risks Found

- No automated backup schedule is configured in this repository.
- Restore still requires operator access to Docker, Postgres, Redis, and MinIO credentials.
- Current local drill uses logical backups and bucket mirror; production should add off-host storage, encryption, retention, and periodic restore automation.
- Dashboard validation was performed through restored DB evidence and API health instead of keeping a second Web instance open against restored resources.

## Next Drill Date

Schedule the next drill by 2026-07-06.
