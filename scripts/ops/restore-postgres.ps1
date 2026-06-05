param(
  [Parameter(Mandatory = $true)] [string] $BackupFile,
  [string] $Container = "error-tracker-pg",
  [string] $RestoreDatabase = "error_tracker_restore",
  [string] $User = "tracker"
)

$ErrorActionPreference = "Stop"

function Invoke-Native {
  param(
    [string] $FilePath,
    [string[]] $Arguments
  )
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath $($Arguments -join ' ') exited with code $LASTEXITCODE"
  }
}

$resolved = Resolve-Path $BackupFile
$file = "error_tracker_restore.dump"

Invoke-Native "docker" @("exec", $Container, "dropdb", "-U", $User, "--if-exists", $RestoreDatabase)
Invoke-Native "docker" @("exec", $Container, "createdb", "-U", $User, $RestoreDatabase)
Invoke-Native "docker" @("cp", $resolved.Path, "$Container`:/tmp/$file")
Invoke-Native "docker" @("exec", $Container, "pg_restore", "-U", $User, "-d", $RestoreDatabase, "--clean", "--if-exists", "/tmp/$file")
Invoke-Native "docker" @("exec", $Container, "rm", "-f", "/tmp/$file")
Invoke-Native "docker" @(
  "exec",
  $Container,
  "psql",
  "-U",
  $User,
  "-d",
  $RestoreDatabase,
  "-c",
  "select (select count(*) from projects) as projects, (select count(*) from issues) as issues, (select count(*) from events) as events, (select count(*) from replays) as replays, (select count(*) from source_maps) as source_maps;"
)
