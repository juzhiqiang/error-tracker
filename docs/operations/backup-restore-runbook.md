# Backup and Restore Runbook

**Scope:** Error Tracker self-hosted deployment using PostgreSQL, MinIO, Redis/BullMQ, and the API service.

## Recovery Objectives

Recommended minimum targets for an internal production deployment:

- PostgreSQL RPO: 24 hours or better.
- PostgreSQL RTO: 2 hours after backup availability is confirmed.
- MinIO RPO: 24 hours or better for replay and source map artifacts.
- Redis/BullMQ RPO: best effort. Failed jobs must be visible and replayable from application state when possible.

## PostgreSQL Backup

Create a compressed logical backup:

```powershell
docker exec error-tracker-pg pg_dump -U tracker -d error_tracker -Fc -f /tmp/error_tracker.dump
docker cp error-tracker-pg:/tmp/error_tracker.dump .\backups\error_tracker-YYYYMMDD-HHMM.dump
```

Verify the backup file exists and is non-empty:

```powershell
Get-Item .\backups\error_tracker-YYYYMMDD-HHMM.dump
```

For hosted PostgreSQL, use the provider's automated snapshots plus a regular `pg_dump` export before risky migrations.

## PostgreSQL Restore

Restore into a new database first. Do not overwrite production until the restored database has been checked.

```powershell
docker exec error-tracker-pg createdb -U tracker error_tracker_restore
docker cp .\backups\error_tracker-YYYYMMDD-HHMM.dump error-tracker-pg:/tmp/error_tracker.dump
docker exec error-tracker-pg pg_restore -U tracker -d error_tracker_restore --clean --if-exists /tmp/error_tracker.dump
```

Smoke checks after restore:

```sql
select count(*) from projects;
select count(*) from issues;
select count(*) from events;
select count(*) from replays;
select count(*) from source_maps;
```

## MinIO Backup

MinIO stores replay clips and source map artifacts. Back up the whole bucket, preserving object keys.

Using the MinIO client from an operator machine:

```powershell
mc alias set error-tracker http://localhost:9011 tracker tracker123
mc mirror error-tracker/error-tracker .\backups\minio\error-tracker-YYYYMMDD-HHMM
```

For production, prefer object storage with versioning and lifecycle policies. If using MinIO, mirror to separate storage daily and before migrations that touch replay/source map metadata.

## MinIO Restore

Restore into an empty bucket or a staging bucket first:

```powershell
mc alias set error-tracker http://localhost:9011 tracker tracker123
mc mb error-tracker/error-tracker-restore
mc mirror .\backups\minio\error-tracker-YYYYMMDD-HHMM error-tracker/error-tracker-restore
```

After validation, point `MINIO_BUCKET` to the restored bucket or mirror objects back to the production bucket.

Validation checks:

- `replays/<projectId>/<eventId>.json` objects exist for recent replay rows.
- Source map objects exist for rows in `source_maps.storage_url`.
- `GET /health` reports MinIO as healthy.

## Redis and BullMQ

Redis is used for BullMQ queues. Treat Redis as operational state, not the source of truth.

Required production policy:

- Failed jobs are retained with `removeOnFail: false`.
- Queue counts are exposed through `/health` under `queues`.
- Operators review `failed` counts daily.
- If Redis is lost, recreate repeatable jobs by restarting the API service.

Failed job triage:

```powershell
redis-cli -h localhost -p 6380 keys "bull:*:failed"
redis-cli -h localhost -p 6380 keys "bull:*:wait"
```

If a queue has failed jobs:

1. Inspect the error stack from BullMQ tooling or Redis data.
2. Fix the root cause.
3. Retry jobs when safe, or mark them as intentionally discarded.
4. Record the incident in the deployment notes.

## Restore Drill Checklist

- [ ] Restore PostgreSQL backup into a staging database.
- [ ] Run row-count smoke checks.
- [ ] Restore MinIO bucket into a staging bucket.
- [ ] Verify replay and source map object keys referenced by DB rows exist.
- [ ] Start API against restored DB and bucket.
- [ ] Call `GET /health`.
- [ ] Open Dashboard `/issues`.
- [ ] Open an issue detail with stack trace and breadcrumbs.
- [ ] Open a replay page for a restored replay.
- [ ] Document elapsed restore time and any manual fixes.

## Before Risky Migrations

1. Take a fresh PostgreSQL backup.
2. Mirror MinIO bucket.
3. Record current API commit SHA.
4. Run `bun run build` for API and web.
5. Apply migration in staging first.

## Ownership

Minimum internal production ownership:

- One primary operator owns backup schedule and restore drills.
- One secondary operator can perform restore without help.
- Restore drill should run at least once per quarter.
