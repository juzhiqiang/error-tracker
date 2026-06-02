# Error Tracker Production Hardening Implementation Plan

> **For agentic workers:** Implement task-by-task. Follow TDD for production code changes and commit each task separately.

**Goal:** Move the project from internal Enterprise MVP toward minimum formal production readiness, then document the next enterprise governance phase.

**Scope:** Execute the first six minimum-production tasks now. Keep the final two enterprise governance tasks in the backlog for the next batch.

## Minimum Formal Production Batch

1. P4-01: Ingest rate limits, quotas, and body-size guardrails.
2. P4-02: DSN token rotation and revocation endpoint.
3. P4-03: Server-side PII scrubber for event payloads.
4. P4-04: DLQ visibility plus structured logging and basic metrics.
5. P4-05: Backup, restore, and retention runbook.
6. P4-06: Startup configuration validation.

## Enterprise Governance Backlog

7. P4-07: Organization, team, project membership, and RBAC.
8. P4-08: Audit log for security and administrative actions.

## Design Choices

- Prefer small, testable API modules over broad rewrites.
- Use in-memory ingest limits for the first production baseline; later replace or augment with Redis-backed distributed limits.
- Keep token rotation on the existing `projects.dsnToken` column first; a token history table can follow when scoped tokens are added.
- Scrub PII at server ingress before database writes.
- Keep BullMQ failed jobs visible through queue state and logs before building a dashboard surface.
- Treat backup/restore and startup validation as production gates, not nice-to-have notes.

## Verification

- `cd apps/api && bun test`
- `cd apps/api && bun run lint`
- `cd apps/api && bun run build`
- `bun test packages/sdk`
- `cd packages/sdk && bun run build`
