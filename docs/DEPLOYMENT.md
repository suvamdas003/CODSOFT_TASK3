# Deploying CareerHub with Docker

## Images

| Image | Dockerfile target | Purpose |
| --- | --- | --- |
| `careerhub-app` | `runner` (default) | Next.js standalone server on Node 24 Alpine, runs as `node`, health check on `/api/health`. |
| `careerhub-tools` | `tools` | Prisma CLI + `tsx` only (versions pinned from `package-lock.json`) for `prisma migrate deploy` and the optional demo seed. |

The build is multi-stage: `deps` (npm ci + prisma generate) → `builder` (`next build`
with `NEXT_OUTPUT=standalone`) → `runner` (only `.next/standalone`, `.next/static`, `public`).
No `.env` file or secret is copied into any stage.

## First start

```bash
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD to a long URL-safe value, e.g.
openssl rand -hex 24
docker compose up --build -d
docker compose ps            # db, app healthy; migrate exited (0)
curl http://localhost:8088/api/health
```

Startup order is enforced with health checks: `db` (healthy) → `migrate`
(completed successfully) → `app` (healthy) → optional `proxy`.

### Demo data (evaluation only)

```bash
docker compose --profile demo run --rm seed
# Wipe everything and reseed:
SEED_RESET=true docker compose --profile demo run --rm seed
```

The seed refuses to run in production unless `ALLOW_DEMO_SEED=true` (set only by the
`seed` service) and skips a non-empty database unless `SEED_RESET=true`.

### Optional Nginx reverse proxy

```bash
# In .env: TRUST_PROXY=true
docker compose --profile proxy up -d
curl http://localhost:8089/api/health
```

Terminate TLS in front of Nginx (load balancer/ingress) or extend `docker/nginx.conf`
with a TLS server block. Behind HTTPS, set `PUBLIC_URL=https://…` and keep
`COOKIE_SECURE=true` (the default).

## Migrations

- Schema changes are made in `prisma/schema.prisma`; create a migration in development with
  `npm run db:migrate -- --name <change>` and commit `prisma/migrations/*`.
- Deployments apply pending migrations with the one-shot `migrate` service on every
  `docker compose up`. To run them manually: `docker compose run --rm migrate`.
- Check status: `docker compose run --rm migrate npx prisma migrate status`.

## Configuration

All settings are environment variables (see `.env.example`). Compose forwards only:
`DATABASE_URL` (built from `POSTGRES_*`), `APP_URL` (`PUBLIC_URL`), `COOKIE_SECURE`,
`TRUST_PROXY`, `SESSION_TTL_DAYS`, `RESUME_MAX_BYTES`, `STORAGE_DRIVER`, `UPLOAD_DIR`
and `S3_*`.

Ports: the app binds to `127.0.0.1:${APP_PORT:-8088}`. To expose it on all interfaces
set `APP_BIND=0.0.0.0` (prefer putting a TLS proxy in front instead). PostgreSQL is never
published; it lives on an internal network.

## Resume storage

### Local volume (default)

Resumes are written to the named volume `careerhub_uploads` mounted at
`/app/storage/uploads`. It survives `docker compose down` and image rebuilds; it is
removed only by `docker compose down -v`.

### S3-compatible object storage (production)

```env
STORAGE_DRIVER=s3
S3_BUCKET=careerhub-resumes
S3_REGION=eu-central-1
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
# For MinIO / R2 / B2:
S3_ENDPOINT=https://minio.example.internal:9000
S3_FORCE_PATH_STYLE=true
```

Keep the bucket **private** (no public ACLs/policies); the app streams files to authorised
users. The health check performs a `HEAD` on the bucket. Enable server-side encryption and
versioning on the bucket.

## Backups

```bash
# Database (logical dump, compressed)
docker compose exec -T db pg_dump -U careerhub -d careerhub -Fc > backups/careerhub-$(date +%F).dump
# Restore into an empty database
docker compose exec -T db pg_restore -U careerhub -d careerhub --clean --if-exists < backups/careerhub-YYYY-MM-DD.dump

# Local resume volume
docker run --rm -v careerhub_uploads:/data -v "$PWD/backups":/backup alpine \
  tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

Back up the database and the resume store together (resume metadata lives in the database,
files in the volume/bucket). Store backups encrypted — they contain personal data.
For S3 storage rely on bucket versioning/replication.

## Operations

```bash
docker compose logs -f app          # application logs
docker compose ps                   # health status
docker compose restart app
docker compose down                 # stop (data volumes kept)
docker compose down -v              # stop AND delete database + uploads (destructive)
docker compose up --build -d        # rebuild after code changes (runs migrations)
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Set POSTGRES_PASSWORD in .env` | Create `.env` from `.env.example` and set the password. |
| `migrate` exits non-zero | `docker compose logs migrate`. Usually wrong credentials: if you changed `POSTGRES_PASSWORD` after the first start, the existing volume still has the old password — revert it or `docker compose down -v` (destroys data). |
| App unhealthy / 503 from `/api/health` | `curl localhost:8088/api/health` shows which check fails (`database` / `storage`). Check `docker compose logs app`. |
| Login appears to do nothing when browsing via a LAN IP over plain HTTP | Secure cookies are only accepted on `localhost` or HTTPS. Use HTTPS, or for local testing set `COOKIE_SECURE=false`. |
| Forms fail behind a proxy ("Invalid Server Actions request") | The proxy must forward the public `Host` header (see `docker/nginx.conf`). |
| Port already in use | Change `APP_PORT` / `PROXY_PORT` in `.env`. |
| Upload fails with "5 MB or smaller" | Resumes are capped at 5 MB (`RESUME_MAX_BYTES`). |
| Container refuses to start with "configuration problems" | Read the listed problems in `docker compose logs app` — the app fails fast on unsafe settings. |
