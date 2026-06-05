param(
  [Parameter(Mandatory = $true)] [string] $BackupDir,
  [string] $Alias = "error-tracker",
  [string] $RestoreBucket = "error-tracker-restore",
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

$resolved = Resolve-Path $BackupDir
$script:HostRoot = $resolved.Path

Invoke-McShell "mc alias set $Alias $Endpoint $AccessKey $SecretKey && mc mb --ignore-existing $Alias/$RestoreBucket && mc mirror --overwrite /backup $Alias/$RestoreBucket && mc ls --recursive $Alias/$RestoreBucket"
