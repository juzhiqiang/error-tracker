# Log Directory Organization Design

## Goal

Keep project runtime logs out of the repository root and application directories by consolidating them in a dedicated root-level `logs/` directory.

## Scope

Move the six root development logs, the two `.codex-logs/` files, and the four API/Web E2E logs into `logs/`. Preserve every file independently so no historical output is merged or overwritten.

The tool-managed `.playwright-mcp/` directory and root archive files are outside this change.

## File Mapping

| Current path | New path |
| --- | --- |
| `.next-web-dev.err.log` | `logs/dev-next-web.err.log` |
| `.next-web-dev.log` | `logs/dev-next-web.out.log` |
| `.tmp-api-dev.err.log` | `logs/dev-tmp-api.err.log` |
| `.tmp-api-dev.out.log` | `logs/dev-tmp-api.out.log` |
| `.tmp-web-dev.err.log` | `logs/dev-tmp-web.err.log` |
| `.tmp-web-dev.out.log` | `logs/dev-tmp-web.out.log` |
| `.codex-logs/api-dev.err.log` | `logs/dev-codex-api.err.log` |
| `.codex-logs/api-dev.out.log` | `logs/dev-codex-api.out.log` |
| `apps/api/e2e.err.log` | `logs/e2e-api.err.log` |
| `apps/api/e2e.out.log` | `logs/e2e-api.out.log` |
| `apps/web/e2e.err.log` | `logs/e2e-web.err.log` |
| `apps/web/e2e.out.log` | `logs/e2e-web.out.log` |

Remove `.codex-logs/` after its files have moved and the directory is empty.

## Runtime Behavior

Update `scripts/e2e/start-stack.ps1` to create `logs/` when necessary and redirect API/Web standard output and standard error to the four normalized E2E paths. This keeps future E2E runs from recreating log files under `apps/`.

Add `logs/.gitkeep` so the directory exists in fresh checkouts. The existing `*.log` rule continues to keep log contents out of Git.

## Verification

- Confirm all twelve source files exist at their mapped destinations with unchanged sizes.
- Confirm no selected project logs remain in the root, `.codex-logs/`, `apps/api/`, or `apps/web/`.
- Parse `scripts/e2e/start-stack.ps1` as a PowerShell script and confirm all four redirection paths use `logs/`.
- Confirm `.playwright-mcp/` contents and archive files were not changed.
