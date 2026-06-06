# Production Deployment

## Required Environment

- `NODE_ENV=production`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`, at least 32 random characters
- `BETTER_AUTH_URL`, HTTPS public Web origin
- `CORS_ORIGIN`, HTTPS public Web origin or comma-separated allowlist
- `REDIS_HOST`
- `REDIS_PORT`
- `MINIO_ENDPOINT`
- `MINIO_PORT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`

## Reverse Proxy

Terminate TLS before API and Web through Nginx, Caddy, Ingress, or a managed load balancer. Forward these headers to the API:

- `X-Forwarded-Proto`
- `X-Forwarded-Host`
- `X-Forwarded-For`

Route the public Web origin to the Next.js service and route the public API origin to the NestJS service. If the API uses a different public origin than the Web app, set `BETTER_AUTH_API_URL` to the HTTPS API origin.

## Cookie Policy

Production auth cookies must be scoped to the HTTPS application origin. The API enables secure cookies when `NODE_ENV=production`; keep TLS termination and forwarded headers in place so browsers only receive cookies over HTTPS.

## CORS Policy

Do not use wildcard CORS in production. Set `CORS_ORIGIN` to the exact deployed Web origin, or to a comma-separated list of exact HTTPS origins when multiple consoles are deployed. Credentialed requests are enabled, so every allowed origin must be trusted.
