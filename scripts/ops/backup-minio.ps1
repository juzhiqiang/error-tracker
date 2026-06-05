param(
  [string] $Alias = "error-tracker",
  [string] $Bucket = "error-tracker",
  [string] $OutputDir = "backups/minio",
  [string] $Endpoint = "http://error-tracker-minio:9000",
  [string] $AccessKey = "tracker",
  [string] $SecretKey = "tracker123",
  [string] $Network = "error-tracker_default",
  [string] $Image = "minio/mc:latest"
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

function Invoke-McShell {
  param([string] $Command)
  Invoke-Native "docker" @(
    "run",
    "--rm",
    "--network",
    $Network,
    "-v",
    "$($script:HostRoot):/backup",
    "--entrypoint",
    "/bin/sh",
    $Image,
    "-c",
    $Command
  )
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $OutputDir "$Bucket-$timestamp"
New-Item -ItemType Directory -Force -Path $target | Out-Null

$resolvedTarget = Resolve-Path $target
$script:HostRoot = $resolvedTarget.Path

Invoke-McShell "mc alias set $Alias $Endpoint $AccessKey $SecretKey && mc mirror $Alias/$Bucket /backup"

$files = Get-ChildItem -Recurse -File -Path $resolvedTarget.Path
if ($files.Count -eq 0) {
  throw "MinIO backup is empty: $($resolvedTarget.Path)"
}

Write-Output $resolvedTarget.Path
