# Log Directory Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate project runtime logs under root-level `logs/` and keep future E2E output there.

**Architecture:** A focused Bun regression test treats the PowerShell E2E launcher as configuration and locks its four output paths to `logs/`. The launcher creates the directory before starting child processes, while a one-time filesystem migration preserves all twelve existing logs independently and leaves tool-managed Playwright logs untouched.

**Tech Stack:** PowerShell, Bun test, Git

---

### Task 1: Route Future E2E Logs to the Root Log Directory

**Files:**
- Create: `scripts/e2e/start-stack.test.ts`
- Modify: `scripts/e2e/start-stack.ps1:3-5,104-121`

- [ ] **Step 1: Write the failing output-path test**

Create `scripts/e2e/start-stack.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

const script = readFileSync(new URL('./start-stack.ps1', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

describe('E2E stack log routing', () => {
  it('creates and uses the root logs directory for process output', () => {
    expect(script).toContain('$logsRoot = Join-Path $root "logs"')
    expect(script).toContain('New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null')

    for (const target of [
      'e2e-api.out.log',
      'e2e-api.err.log',
      'e2e-web.out.log',
      'e2e-web.err.log',
    ]) {
      expect(script).toContain(`Join-Path $logsRoot "${target}"`)
    }

    expect(script).not.toMatch(/Join-Path \$root "apps\/(?:api|web)\/e2e\.(?:out|err)\.log"/)
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `bun test scripts/e2e/start-stack.test.ts`

Expected: FAIL because `start-stack.ps1` does not yet contain `$logsRoot = Join-Path $root "logs"`.

- [ ] **Step 3: Implement the minimal E2E routing change**

After `$root` is resolved, define and create the log directory:

```powershell
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$logsRoot = Join-Path $root "logs"
New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null
Set-Location $root
```

Replace the API redirects with:

```powershell
  -Stdout (Join-Path $logsRoot "e2e-api.out.log") `
  -Stderr (Join-Path $logsRoot "e2e-api.err.log")
```

Replace the Web redirects with:

```powershell
  -Stdout (Join-Path $logsRoot "e2e-web.out.log") `
  -Stderr (Join-Path $logsRoot "e2e-web.err.log")
```

- [ ] **Step 4: Verify GREEN and PowerShell syntax**

Run: `bun test scripts/e2e/start-stack.test.ts`

Expected: `1 pass, 0 fail`.

Run:

```powershell
powershell -NoProfile -Command "[void][scriptblock]::Create((Get-Content -Raw 'scripts/e2e/start-stack.ps1')); Write-Output 'PowerShell syntax OK'"
```

Expected: `PowerShell syntax OK`.

- [ ] **Step 5: Commit the routing change**

```bash
git add scripts/e2e/start-stack.test.ts scripts/e2e/start-stack.ps1
git commit -m "feat: 统一 E2E 日志输出目录"
```

### Task 2: Move Existing Logs Without Data Loss

**Files:**
- Create: `logs/.gitkeep`
- Move ignored runtime logs according to `docs/superpowers/specs/2026-07-15-log-directory-design.md`
- Remove after empty: `.codex-logs/`

- [ ] **Step 1: Verify the migration starts from the expected state**

Run:

```powershell
$sources = @(
  '.next-web-dev.err.log', '.next-web-dev.log',
  '.tmp-api-dev.err.log', '.tmp-api-dev.out.log',
  '.tmp-web-dev.err.log', '.tmp-web-dev.out.log',
  '.codex-logs/api-dev.err.log', '.codex-logs/api-dev.out.log',
  'apps/api/e2e.err.log', 'apps/api/e2e.out.log',
  'apps/web/e2e.err.log', 'apps/web/e2e.out.log'
)
$missing = $sources | Where-Object { -not (Test-Path -LiteralPath $_) }
if ($missing) { throw "Missing source logs: $($missing -join ', ')" }
Write-Output 'All 12 source logs found'
```

Expected: `All 12 source logs found`.

- [ ] **Step 2: Add the tracked directory placeholder**

Create the empty file `logs/.gitkeep`. The existing root `.gitignore` rule `*.log` must remain unchanged because it already ignores every destination log.

- [ ] **Step 3: Move each log and verify its byte size is unchanged**

Run this PowerShell block from the repository root:

```powershell
$mapping = [ordered]@{
  '.next-web-dev.err.log' = 'logs/dev-next-web.err.log'
  '.next-web-dev.log' = 'logs/dev-next-web.out.log'
  '.tmp-api-dev.err.log' = 'logs/dev-tmp-api.err.log'
  '.tmp-api-dev.out.log' = 'logs/dev-tmp-api.out.log'
  '.tmp-web-dev.err.log' = 'logs/dev-tmp-web.err.log'
  '.tmp-web-dev.out.log' = 'logs/dev-tmp-web.out.log'
  '.codex-logs/api-dev.err.log' = 'logs/dev-codex-api.err.log'
  '.codex-logs/api-dev.out.log' = 'logs/dev-codex-api.out.log'
  'apps/api/e2e.err.log' = 'logs/e2e-api.err.log'
  'apps/api/e2e.out.log' = 'logs/e2e-api.out.log'
  'apps/web/e2e.err.log' = 'logs/e2e-web.err.log'
  'apps/web/e2e.out.log' = 'logs/e2e-web.out.log'
}

New-Item -ItemType Directory -Path 'logs' -Force | Out-Null
foreach ($entry in $mapping.GetEnumerator()) {
  if (Test-Path -LiteralPath $entry.Value) {
    throw "Destination already exists: $($entry.Value)"
  }
  $size = (Get-Item -LiteralPath $entry.Key).Length
  Move-Item -LiteralPath $entry.Key -Destination $entry.Value
  if ((Get-Item -LiteralPath $entry.Value).Length -ne $size) {
    throw "Size changed while moving $($entry.Key)"
  }
}

if ((Test-Path -LiteralPath '.codex-logs') -and -not (Get-ChildItem -Force '.codex-logs')) {
  Remove-Item -LiteralPath '.codex-logs'
}
Write-Output 'Moved and verified 12 logs'
```

Expected: `Moved and verified 12 logs`.

- [ ] **Step 4: Verify layout and ignore behavior**

Run:

```powershell
$projectLogs = rg --files --hidden -g '*.log' -g '!node_modules/**' -g '!.git/**' -g '!.next/**' -g '!dist/**'
$unexpected = $projectLogs | Where-Object { $_ -notlike 'logs\*' -and $_ -notlike '.playwright-mcp\*' }
if ($unexpected) { throw "Logs remain outside approved directories: $($unexpected -join ', ')" }
if ((Get-ChildItem -File 'logs' -Filter '*.log').Count -ne 12) { throw 'Expected 12 logs in logs/' }
git check-ignore -q logs/e2e-api.out.log
if ($LASTEXITCODE -ne 0) { throw 'Destination logs are not ignored by Git' }
Write-Output 'Log layout and ignore rules verified'
```

Expected: `Log layout and ignore rules verified`.

Run: `git status --short`

Expected: only `?? logs/` before staging; ignored `.log` files must not appear.

- [ ] **Step 5: Commit the persistent directory**

```bash
git add logs/.gitkeep
git commit -m "feat: 添加统一日志目录"
```

### Task 3: Final Regression Verification

**Files:**
- Verify only; no new files

- [ ] **Step 1: Run the focused regression test**

Run: `bun test scripts/e2e/start-stack.test.ts`

Expected: `1 pass, 0 fail`.

- [ ] **Step 2: Run all script tests**

Run: `bun test scripts`

Expected: all tests pass with zero failures.

- [ ] **Step 3: Validate repository state and scope**

Run: `git diff --check HEAD~2..HEAD`

Expected: no output and exit code 0.

Run: `git status --short --branch`

Expected: clean working tree; branch is ahead only by the approved design, plan, and implementation commits.
