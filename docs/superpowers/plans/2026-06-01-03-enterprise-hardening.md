# Error Tracker Enterprise Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the project from enterprise MVP toward production-ready internal enterprise usage by hardening ingest safety, SDK delivery reliability, source-map accuracy, data lifecycle behavior, and service observability.

**Architecture:** Keep the existing NestJS + Drizzle + BullMQ + MinIO + Next.js structure. Add small, testable services around existing modules instead of replacing the current implementation. Prioritize server-side safety checks and SDK delivery semantics that can be verified with Bun tests.

**Tech Stack:** Bun test, TypeScript, NestJS, Drizzle ORM, BullMQ, MinIO/S3, Next.js, rrweb, source-map.

---

## Execution Order

1. Task P3-01: Ingest safety guardrails
2. Task P3-02: SDK retry and persistent queue foundation
3. Task P3-03: Source map precise matching
4. Task P3-04: Replay and cleanup lifecycle hardening
5. Task P3-05: Health and observability endpoints
6. Task P3-06: Enterprise backlog documentation

## Files Overview

- `apps/api/src/modules/ingest/ingest.validation.ts`: validates ingest payloads before database writes.
- `apps/api/src/modules/ingest/ingest.controller.ts`: applies validation and accepts DSN token from either path or header.
- `apps/api/src/common/guards/dsn-auth.guard.ts`: authenticates `:token` or `x-error-tracker-token`.
- `packages/sdk/src/core/queue.ts`: adds retry and optional persistence hooks.
- `packages/sdk/src/core/client.ts`: wires queue persistence and retry behavior from `SdkOptions`.
- `packages/sdk/src/types.ts`: adds SDK reliability options.
- `apps/api/src/modules/events/events.service.ts`: matches source maps by `projectId + release + filename`.
- `apps/api/src/modules/cleanup/cleanup.processor.ts`: deletes old replay objects with S3 delete support.
- `apps/api/src/modules/sourcemaps/minio.service.ts`: adds `deleteObject`.
- `apps/api/src/modules/health/`: exposes health checks for API, DB, Redis, and MinIO.
- `task/p3-task-*.md`: task-by-task implementation instructions.

## Verification

- `bun test packages/sdk`
- `cd apps/api && bun test`
- `cd packages/sdk && bun run build`
- `cd apps/api && bun run build`
- `cd apps/web && bun run build`
- Local smoke: POST `/ingest/:projectId/:token`, POST `/ingest/:projectId/:token/replay`, verify issue/event/performance/replay DB rows and MinIO object.
