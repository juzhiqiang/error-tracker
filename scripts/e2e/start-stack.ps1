$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$logsRoot = Join-Path $root "logs"
New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null
Set-Location $root

function Import-LocalEnv {
  $envPath = Join-Path $root ".env.local"
  if (-not (Test-Path $envPath)) {
    return
  }

  Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
      return
    }
    $name, $value = $line.Split("=", 2)
    [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), "Process")
  }
}

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

function Test-HttpReady {
  param([string] $Url)
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return [int] $response.StatusCode -ge 200 -and [int] $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Wait-HttpReady {
  param(
    [string] $Url,
    [int] $TimeoutSeconds = 90
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpReady $Url) {
      return
    }
    Start-Sleep -Seconds 1
  }
  throw "Timed out waiting for $Url"
}

function Stop-ListeningProcess {
  param([int[]] $Ports)

  foreach ($port in $Ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processIds) {
      if (-not $processId -or $processId -eq $PID) {
        continue
      }
      Write-Host "Stopping existing process on port $port (PID $processId)..."
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Start-BackgroundProcess {
  param(
    [string] $Name,
    [string] $FilePath,
    [string[]] $Arguments,
    [string] $Stdout,
    [string] $Stderr
  )
  Write-Host "Starting $Name..."
  $process = Start-Process `
    -FilePath $FilePath `
    -ArgumentList $Arguments `
    -WorkingDirectory $root `
    -RedirectStandardOutput $Stdout `
    -RedirectStandardError $Stderr `
    -WindowStyle Hidden `
    -PassThru
  return $process
}

Import-LocalEnv

Write-Host "Starting local Docker services..."
Invoke-Native "bun" @("run", "services:up")

Write-Host "Running database migrations..."
Invoke-Native "bun" @("run", "--cwd", "apps/api", "db:migrate")

Stop-ListeningProcess @(3002, 3003)

$started = @()
$started += Start-BackgroundProcess `
  -Name "API" `
  -FilePath "bun" `
  -Arguments @("run", "--cwd", "apps/api", "dev") `
  -Stdout (Join-Path $logsRoot "e2e-api.out.log") `
  -Stderr (Join-Path $logsRoot "e2e-api.err.log")
Wait-HttpReady "http://localhost:3002/health" 120

Write-Host "Seeding E2E user..."
Invoke-Native "bun" @("scripts/e2e/seed-user.ts")

$started += Start-BackgroundProcess `
  -Name "Web" `
  -FilePath "bun" `
  -Arguments @("run", "--cwd", "apps/web", "dev") `
  -Stdout (Join-Path $logsRoot "e2e-web.out.log") `
  -Stderr (Join-Path $logsRoot "e2e-web.err.log")
Wait-HttpReady "http://localhost:3003/login" 120

try {
  Write-Host "Running Playwright E2E..."
  Invoke-Native "bun" @("run", "--cwd", "apps/web", "e2e")
} finally {
  foreach ($process in $started) {
    if ($process -and -not $process.HasExited) {
      Write-Host "Stopping $($process.Id)..."
      Stop-Process -Id $process.Id -Force
    }
  }
}
