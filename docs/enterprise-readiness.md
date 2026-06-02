# Error Tracker Enterprise Readiness

**Date:** 2026-06-02  
**Scope:** Current repository state after Plan 1, Plan 2, Plan 3, and Plan 4 production-hardening work.

## Summary

The current system is suitable for internal pilots, small self-hosted teams, and single-organization product debugging where operators control the deployment and data access model.

It should not be described as ready for most enterprise production deployments yet. Plan 4 raises the minimum production baseline with rate limits, token rotation, server-side PII scrubbing, queue failure visibility, and backup/restore runbooks, but common enterprise requirements still remain in identity governance, auditability, high availability, tenant isolation, and compliance workflows.

## Current Enterprise Boundary

Included today:

- Browser and Node SDK ingestion with retries, batching, dedupe, breadcrumbs, replay, and Web Vitals capture.
- DSN token authentication for ingest, including header-based token support.
- Payload guardrails for ingest and replay request shape.
- Issue/event aggregation, stack trace display, breadcrumbs, replay playback, performance pages, source-map lookup, and alert/cleanup jobs.
- Source map matching by project, release, and generated filename.
- Replay object cleanup through S3 `DeleteObject`.
- Ingest body-size guardrails, in-memory per-project rate limits, and daily quota foundation.
- Project DSN token rotation.
- Server-side PII scrubbing for event user/request/breadcrumb/tag payloads.
- BullMQ failed-job retention and queue count visibility.
- `GET /health` covering API, DB, Redis/BullMQ, MinIO readiness, queue counts, and ingest counters.
- Backup and restore runbook for PostgreSQL, MinIO, and Redis/BullMQ.

Not included today:

- Multi-organization tenant model, teams, project membership, or RBAC.
- Enterprise SSO through SAML/OIDC, SCIM, or centralized identity providers.
- Audit log for access, project changes, token use, status changes, and administrative actions.
- Configurable project-level PII policies and user-facing retention controls.
- Scoped DSN tokens, distributed Redis-backed rate limits, and abuse dashboards.
- HA deployment topology, automated restore drills, and full operational dashboards.
- Compliance reports, legal retention policy controls, or customer-managed encryption.

## Enterprise Readiness Matrix

| Area | Current status | Enterprise expectation | Recommendation |
| --- | --- | --- | --- |
| Ingest safety | Partial | Payload limits, auth, rate limits, abuse controls, token scopes | Replace in-memory limits with Redis-backed distributed limits and add abuse dashboards. |
| SDK reliability | Partial | Offline recovery, retry durability, low user-impact overhead | Move browser persistence to IndexedDB, add backoff jitter and delivery telemetry. |
| Source maps | Partial | Exact artifact mapping, upload validation, release artifact lifecycle | Add artifact bundle validation, checksum tracking, and release-level artifact UI. |
| Identity and access | Missing | Organization, teams, RBAC, SSO, least privilege | Build org/team/project membership and enforce permissions on every dashboard API. |
| Auditability | Missing | Immutable audit log for admin and data-access actions | Add audit events for login, project/token changes, issue status changes, replay access. |
| Privacy and data governance | Partial | PII scrubbing, field denylist, retention controls, export/delete workflows | Add configurable field policies, replay masking UI, and export/delete workflows. |
| Availability and recovery | Partial | HA services, backups, restore tests, queue DLQ, health/SLO dashboards | Automate restore drills and add HA deployment topology. |
| Observability | Partial | Health checks, metrics, traces, logs, alerting | Add Prometheus metrics, structured logs, and error budget alerts. |
| Tenant isolation | Missing | Data isolation and permission boundaries across organizations | Add organization scoping to every data model and query. |
| Admin operations | Partial | Operational runbooks, migrations, environment validation | Add deployment runbook, migration rollback notes, and startup config validation. |

## Recommended Roadmap

1. Identity foundation: organizations, teams, project membership, RBAC, and dashboard/API authorization checks.
2. Governance foundation: audit log, token rotation, scoped DSN tokens, project quotas, and rate limiting.
3. Privacy foundation: server-side PII scrubbing, configurable replay masking, denylist rules, and retention UI.
4. Operations foundation: DLQ, backup/restore documentation, Prometheus metrics, structured logs, and HA deployment guide.
5. Artifact foundation: source map upload validation, artifact bundles, checksum tracking, and release artifact management.

## Positioning Guidance

Use this wording:

> Enterprise MVP for internal evaluation and controlled self-hosted pilots.

Avoid this wording:

> Ready for most enterprise production use.

The system has enough core product capability to demonstrate value, but enterprise buyers usually require governance, identity, audit, privacy, and operational recovery controls before broad production adoption.
