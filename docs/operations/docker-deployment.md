# Docker Deployment

This project ships two production image targets from the same `Dockerfile`:

- `full`: runs the API on port `3002` and the Web console on port `3003`.
- `api`: runs only the API on port `3002`.

The production compose file also starts Postgres, Redis, and MinIO with persistent volumes.

## Build Images

```bash
docker build --target full -t error-tracker:full .
docker build --target api -t error-tracker:api .
```

If you build images manually instead of using compose, pass the public API URL because `NEXT_PUBLIC_*` values are compiled into the Web bundle:

```bash
docker build --target full -t error-tracker:full \
  --build-arg NEXT_PUBLIC_API_URL=https://api.tracker.example.com .
docker build --target api -t error-tracker:api \
  --build-arg NEXT_PUBLIC_API_URL=https://api.tracker.example.com .
```

## Configure Environment

Create the runtime env file from the template:

```bash
cp .env.production.example .env.production
```

Edit `.env.production` before starting production:

- Replace `BETTER_AUTH_SECRET` with a 32+ character secret.
- Replace `POSTGRES_PASSWORD`, `DATABASE_URL`, and `MINIO_ROOT_PASSWORD`.
- Set `APP_PUBLIC_URL`, `API_PUBLIC_URL`, `NEXT_PUBLIC_API_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_API_URL`, and `CORS_ORIGIN` to the public HTTPS URLs used by your server or reverse proxy.

Fill `.env.production` before running `docker compose ... --build`; compose passes the `NEXT_PUBLIC_*` values into `docker build`.

## Run Full Stack

This starts Postgres, Redis, MinIO, API, and Web:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile full up -d --build
```

Open:

- Web: `http://SERVER_IP:3003`
- API health: `http://SERVER_IP:3002/health`
- MinIO console: `http://SERVER_IP:9001`

For public production traffic, put Nginx/Caddy/Traefik in front of the container and terminate HTTPS there.

## Run API Only

This starts Postgres, Redis, MinIO, and the API container only:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile api up -d --build
```

## Database Migrations

After the containers are healthy, run migrations once per deployment:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile full run --rm app-full sh -lc "cd apps/api && npx drizzle-kit migrate"
```

For API-only deployments:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile api run --rm api sh -lc "cd apps/api && npx drizzle-kit migrate"
```

## Export Images For Upload

If the server does not build from source, save the images:

```bash
docker save error-tracker:full -o error-tracker-full.tar
docker save error-tracker:api -o error-tracker-api.tar
```

On the server:

```bash
docker load -i error-tracker-full.tar
docker load -i error-tracker-api.tar
docker compose --env-file .env.production -f docker-compose.prod.yml --profile full up -d
```
