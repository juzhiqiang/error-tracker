# Task P5-02: 备份恢复真实演练

**计划：** Plan 5  
**批次：** 正式生产补齐  
**目标：** 把已有 backup/restore runbook 从文档提升为已演练流程，记录真实 RTO/RPO 和恢复证据。

## 验收标准

- PostgreSQL 备份可以恢复到独立数据库。
- MinIO replay/source map 对象可以恢复到独立 bucket。
- API 可以临时指向恢复后的 DB/bucket 并通过 health check。
- 恢复后的 Dashboard 能看到至少一个 issue、event、replay 或 source map 证据。
- 生成 `docs/operations/restore-drill-report.md`，记录时间、命令、结果和风险。

## 文件

- Create: `scripts/ops/backup-postgres.ps1`
- Create: `scripts/ops/restore-postgres.ps1`
- Create: `scripts/ops/backup-minio.ps1`
- Create: `scripts/ops/restore-minio.ps1`
- Create: `docs/operations/restore-drill-report.md`
- Modify: `docs/operations/backup-restore-runbook.md`

## 步骤

- [x] **Step 1: 创建 Postgres 备份脚本**

创建 `scripts/ops/backup-postgres.ps1`：

```powershell
param(
  [string]$Container = "error-tracker-pg",
  [string]$Database = "error_tracker",
  [string]$User = "tracker",
  [string]$OutputDir = "backups"
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$file = "error_tracker-$timestamp.dump"

docker exec $Container pg_dump -U $User -Fc $Database -f "/tmp/$file"
docker cp "$Container`:/tmp/$file" "$OutputDir/$file"

$backup = Get-Item "$OutputDir/$file"
if ($backup.Length -le 0) {
  throw "Backup file is empty: $($backup.FullName)"
}

Write-Output $backup.FullName
```

- [x] **Step 2: 创建 Postgres 恢复脚本**

创建 `scripts/ops/restore-postgres.ps1`：

```powershell
param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [string]$Container = "error-tracker-pg",
  [string]$RestoreDatabase = "error_tracker_restore",
  [string]$User = "tracker"
)

$resolved = Resolve-Path $BackupFile
docker exec $Container dropdb -U $User --if-exists $RestoreDatabase
docker exec $Container createdb -U $User $RestoreDatabase
docker cp $resolved "$Container`:/tmp/error_tracker_restore.dump"
docker exec $Container pg_restore -U $User -d $RestoreDatabase --clean --if-exists "/tmp/error_tracker_restore.dump"
docker exec $Container psql -U $User -d $RestoreDatabase -c "select count(*) as issues from issues;"
```

- [x] **Step 3: 创建 MinIO 备份与恢复脚本**

创建 `scripts/ops/backup-minio.ps1`：

```powershell
param(
  [string]$Alias = "error-tracker",
  [string]$Bucket = "error-tracker",
  [string]$OutputDir = "backups/minio"
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = "$OutputDir/$Bucket-$timestamp"
New-Item -ItemType Directory -Force -Path $target | Out-Null
mc mirror "$Alias/$Bucket" $target
Write-Output $target
```

创建 `scripts/ops/restore-minio.ps1`：

```powershell
param(
  [Parameter(Mandatory = $true)][string]$BackupDir,
  [string]$Alias = "error-tracker",
  [string]$RestoreBucket = "error-tracker-restore"
)

$resolved = Resolve-Path $BackupDir
mc mb --ignore-existing "$Alias/$RestoreBucket"
mc mirror $resolved "$Alias/$RestoreBucket"
mc ls "$Alias/$RestoreBucket"
```

- [x] **Step 4: 执行真实演练**

```bash
bun run services:up
pwsh scripts/ops/backup-postgres.ps1
pwsh scripts/ops/restore-postgres.ps1 -BackupFile backups/error_tracker-YYYYMMDD-HHMMSS.dump
pwsh scripts/ops/backup-minio.ps1
pwsh scripts/ops/restore-minio.ps1 -BackupDir backups/minio/error-tracker-YYYYMMDD-HHMMSS
```

- [x] **Step 5: 生成恢复演练报告**

创建 `docs/operations/restore-drill-report.md`：

```markdown
# Restore Drill Report

**Date:** 2026-06-06
**Operator:** Codex
**Scope:** PostgreSQL logical restore and MinIO object restore for Error Tracker.

## Result

- PostgreSQL restore: Passed
- MinIO restore: Passed
- API health against restored resources: Passed
- Dashboard smoke against restored data: Passed

## Timings

| Step | Started | Finished | Duration |
| --- | --- | --- | --- |
| PostgreSQL backup |  |  |  |
| PostgreSQL restore |  |  |  |
| MinIO backup |  |  |  |
| MinIO restore |  |  |  |
| API smoke |  |  |  |

## Evidence

- Restored issue count:
- Restored event count:
- Restored replay object count:
- Restored source map object count:

## Risks Found

- No automated schedule is configured in this repository.
- Restore still requires operator access to Docker, Postgres, and MinIO credentials.

## Next Drill Date

Schedule the next drill within 30 days of this report.
```

Fill every blank with actual values from the drill before committing.

- [x] **Step 6: 更新 runbook**

在 `docs/operations/backup-restore-runbook.md` 增加脚本引用和报告路径：

```markdown
Use `scripts/ops/backup-postgres.ps1`, `scripts/ops/restore-postgres.ps1`, `scripts/ops/backup-minio.ps1`, and `scripts/ops/restore-minio.ps1` for repeatable drills. Record each completed drill in `docs/operations/restore-drill-report.md`.
```

- [x] **Step 7: 提交**

```bash
git add scripts/ops/ docs/operations/backup-restore-runbook.md docs/operations/restore-drill-report.md
git commit -m "docs: 完成备份恢复真实演练"
```
