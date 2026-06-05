# Error Tracker Formal Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining gaps between the current internal enterprise MVP and a minimum formal production deployment baseline.

**Architecture:** Keep the existing NestJS API, Next.js dashboard, Drizzle schema, BullMQ queues, MinIO object storage, and SDK packages. Extend the system with automated end-to-end verification, real restore drill evidence, hardened deployment settings, operational queue controls, organization-scoped tenancy, queryable audit workflows, source-map CI delivery, and capacity baseline scripts.

**Tech Stack:** Bun, TypeScript, NestJS, Drizzle ORM, PostgreSQL, BullMQ, Redis, MinIO/S3, Next.js App Router, Playwright, k6 or autocannon, PowerShell-friendly operations scripts.

---

## Scope

This plan contains the eight tasks required before describing Error Tracker as ready for a controlled formal production deployment:

1. P5-01: E2E automation for migration, API, Web, SDK ingest, source maps, and dashboard verification.
2. P5-02: Real backup and restore drill with recorded RTO/RPO evidence.
3. P5-03: Production deployment security configuration.
4. P5-04: Queue failure operations page and retry controls.
5. P5-05: Organization and team tenancy hardening.
6. P5-06: Audit log query, filtering, and CSV export.
7. P5-07: Source-map CI and CLI upload workflow with checksum validation.
8. P5-08: Capacity and load-test baseline.

## Execution Order

Run tasks in this order:

1. P5-01 first, because later production hardening needs a repeatable regression gate.
2. P5-02 and P5-03 next, because recovery and secure deployment are production gates.
3. P5-04 next, because failed jobs must be actionable before sustained traffic.
4. P5-07 and P5-08 next, because artifact delivery and capacity depend on the hardened baseline.
5. P5-05 and P5-06 last, because organization tenancy and audit UI affect authorization and data access boundaries.

## Files Overview

- `task/p5-task-01-e2e-regression.md`: Playwright end-to-end regression task.
- `task/p5-task-02-restore-drill.md`: Backup and restore drill task.
- `task/p5-task-03-production-security-config.md`: deployment security and config hardening task.
- `task/p5-task-04-queue-operations.md`: queue operations API and UI task.
- `task/p5-task-05-organization-tenancy.md`: organization/team tenancy task.
- `task/p5-task-06-audit-log-console.md`: audit log console and export task.
- `task/p5-task-07-sourcemap-ci-cli.md`: source-map CI/CLI upload task.
- `task/p5-task-08-capacity-baseline.md`: load-test and capacity reporting task.

## Acceptance Criteria

- `bun test packages/sdk` passes.
- `bun run --cwd packages/sdk build` passes.
- `bun run --cwd apps/api test` passes.
- `bun run --cwd apps/api lint` passes.
- `bun run --cwd apps/api build` passes.
- `bun run --cwd apps/web lint` passes.
- `bun run --cwd apps/web build` passes.
- `bun run e2e` passes against local Docker services, API, and Web.
- `docs/operations/restore-drill-report.md` records a successful restore drill with concrete timestamps and evidence.
- `docs/operations/capacity-baseline.md` records capacity numbers and known limits.

## Task Files

| File | Task | Primary outcome |
| --- | --- | --- |
| `task/p5-task-01-e2e-regression.md` | E2E regression | Automated browser and API smoke path |
| `task/p5-task-02-restore-drill.md` | Restore drill | Evidence-backed backup and restore process |
| `task/p5-task-03-production-security-config.md` | Security config | Safe production env, CORS, cookies, proxy notes |
| `task/p5-task-04-queue-operations.md` | Queue operations | Failed job visibility and retry actions |
| `task/p5-task-05-organization-tenancy.md` | Tenancy | Organization and team boundaries enforced |
| `task/p5-task-06-audit-log-console.md` | Audit console | Search, filters, and CSV export |
| `task/p5-task-07-sourcemap-ci-cli.md` | Source-map CI/CLI | Automated artifact upload with checksums |
| `task/p5-task-08-capacity-baseline.md` | Capacity baseline | Repeatable load tests and report |

## Verification

Run the full gate after each task that changes production code:

```bash
bun test packages/sdk
bun run --cwd packages/sdk build
bun run --cwd apps/api test
bun run --cwd apps/api lint
bun run --cwd apps/api build
bun run --cwd apps/web lint
bun run --cwd apps/web build
```

Run the final formal-production gate after all tasks:

```bash
bun run services:up
bun run --cwd apps/api db:migrate
bun run e2e
bun test packages/sdk
bun run --cwd apps/api test
bun run --cwd apps/web build
```
