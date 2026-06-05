param(
  [string] $Container = "error-tracker-pg",
  [string] $Database = "error_tracker",
  [string] $User = "tracker",
  [string] $OutputDir = "backups"
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

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$file = "error_tracker-$timestamp.dump"
$target = Join-Path $OutputDir $file

Invoke-Native "docker" @("exec", $Container, "pg_dump", "-U", $User, "-Fc", $Database, "-f", "/tmp/$file")
Invoke-Native "docker" @("cp", "$Container`:/tmp/$file", $target)
Invoke-Native "docker" @("exec", $Container, "rm", "-f", "/tmp/$file")

$backup = Get-Item $target
if ($backup.Length -le 0) {
  throw "Backup file is empty: $($backup.FullName)"
}

Write-Output $backup.FullName
