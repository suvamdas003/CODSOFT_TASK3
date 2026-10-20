# CareerHub

A full-stack recruitment platform: candidates search and apply for jobs and track
their applications; recruiters publish jobs and run hiring pipelines; administrators
moderate content and manage the platform.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 ·
PostgreSQL 17 · Prisma 7 · Zod 4 · Vitest · Playwright · Docker Compose

---

## Features

**Candidates**
- Register / sign in / sign out, profile (headline, skills, experience, links, preferences), account & password settings
- Job search with keyword (title, company, skill), location, company, employment type, workplace, experience level, minimum salary, sorting and pagination
- Job details, apply with a chosen resume and cover letter, duplicate applications prevented (also at database level)
- Application tracker with status history and interview details; withdraw applications
- Resume management: upload, replace, set default, download, delete (PDF/DOCX, validated by file signature)
- Saved jobs, in-app notifications, reporting suspicious listings

**Recruiters**
- Company profile (public company page) and recruiter profile
- Create, edit, publish, close, reopen and delete owned job listings (jobs with applicants can only be closed)
- Applicant list across jobs with filters (job, status, name/email/headline, skill) and sorting
- Candidate profiles and authorised resume downloads
- Pipeline statuses: Applied → Shortlisted → Interview → Offered → Hired / Rejected (with history and candidate notifications)
- Interview scheduling (video/phone/on-site) with candidate-visible details and internal notes; private applicant notes
- Dashboard with live statistics: jobs by status, views, apply rate, pipeline, per-job performance, upcoming interviews

**Administrators**
- Platform metrics (users, jobs, applications per status, 14-day application trend, open reports)
- User management (search/filter, suspend with reason — revokes sessions — and reactivate)
- Recruiter & company management (company verification)
- Job moderation (remove with reason / restore), reported-content queue (resolve, dismiss, remove)
- Platform settings (registration switches, resume limit, site-wide announcement)
- Audit log of significant actions with filters

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SECURITY.md](docs/SECURITY.md) and
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Project structure

```
CareerHub/
├─ src/
│  ├─ app/                 pages, layouts, route handlers (api/health, api/resumes/[id])
│  ├─ components/          shared UI (forms, tables, filters, pagination…) and layouts
│  ├─ features/
│  │  ├─ auth/             login, registration, account
│  │  ├─ jobs/             search, job CRUD, saved jobs, reports
│  │  ├─ applications/     applying, pipeline, notes, interviews
│  │  ├─ candidates/       profile, resumes, file validation
│  │  ├─ recruiters/       company profile, statistics
│  │  ├─ admin/            moderation, users, settings, audit
│  │  └─ notifications/
│  ├─ server/              Prisma client, sessions, audit, notifications, storage adapters
│  ├─ lib/                 validation, password hashing, env, formatting, utilities
│  └─ proxy.ts             optimistic auth redirect (Next.js 16 "proxy", formerly middleware)
├─ prisma/                 schema.prisma, migrations/, seed.ts, seed-data.ts
├─ tests/                  unit/, integration/ (real PostgreSQL), e2e/ (Playwright)
├─ docs/                   architecture, security, deployment
├─ docker/nginx.conf       optional reverse proxy
├─ scripts/source-size.mjs size report + clean source ZIP
├─ Dockerfile · docker-compose.yml · docker-compose.dev.yml · .dockerignore
└─ .env.example
```

---

## Prerequisites

- **Docker** 24+ with Docker Compose v2 (for the containerised setup)
- For local development: **Node.js 20.9+** (developed on Node 24) and npm 10+

## Quick start with Docker

```bash
cp .env.example .env
# Set POSTGRES_PASSWORD in .env to a long URL-safe value, e.g.:  openssl rand -hex 24
docker compose up --build -d
docker compose --profile demo run --rm seed      # optional: synthetic demo data
```

Open **http://localhost:8088** (change with `APP_PORT`). Health: `http://localhost:8088/api/health`.

Optional Nginx proxy: set `TRUST_PROXY=true` in `.env`, then `docker compose --profile proxy up -d`
and open http://localhost:8089.

## Local development

```bash
cp .env.example .env              # defaults match the dev database below
npm install                       # also runs `prisma generate`
npm run db:dev:up                 # PostgreSQL 17 on 127.0.0.1:5434 (docker-compose.dev.yml)
npm run db:deploy                 # apply migrations
npm run db:seed                   # demo data (SEED_RESET=true to wipe & reseed)
npm run dev                       # http://localhost:3005
```

| Command | Purpose |
| --- | --- |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit tests |
| `npm run test:integration` | Integration tests (creates `careerhub_test` from `TEST_DATABASE_URL`) |
| `npm run build && npm run test:e2e` | Playwright end-to-end tests (creates `careerhub_e2e`, port 3007) |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:migrate -- --name x` | Create a new migration (development) |
| `npm run size` | Measure the distributable source size |
| `npm run package:zip` | Write `release/careerhub-source.zip` (clean source archive) |

First-time Playwright users: `npx playwright install chromium`.

## Demo accounts (development only)

Created by `prisma/seed.ts` with synthetic data. **Never use these in production.** Override the
passwords with `SEED_ADMIN_PASSWORD`, `SEED_RECRUITER_PASSWORD`, `SEED_CANDIDATE_PASSWORD`.

| Role | Email | Password |
| --- | --- | --- |
| Administrator | admin@careerhub.test | `DevOnly-Admin-2026!` |
| Recruiter — Northwind Labs | recruiter@careerhub.test | `DevOnly-Recruiter-2026!` |
| Recruiter — Bluepeak Health | recruiter2@careerhub.test | `DevOnly-Recruiter-2026!` |
| Recruiter — Orbit Retail | recruiter3@careerhub.test | `DevOnly-Recruiter-2026!` |
| Candidate | candidate@careerhub.test | `DevOnly-Candidate-2026!` |
| Candidate | candidate2@careerhub.test | `DevOnly-Candidate-2026!` |
| Candidate | candidate3@careerhub.test | `DevOnly-Candidate-2026!` |

The demo includes jobs in every state, applications across the whole pipeline, interviews,
notes, saved jobs, an open fraud report on a scam-like listing, notifications and audit history.

## Environment configuration

All configuration is via environment variables documented in [`.env.example`](.env.example):
database URLs, Docker ports, `COOKIE_SECURE`, `TRUST_PROXY`, `SESSION_TTL_DAYS`, resume storage
(`STORAGE_DRIVER=local|s3`, `UPLOAD_DIR`, `S3_*`) and `RESUME_MAX_BYTES`.

## Troubleshooting

- **`Set POSTGRES_PASSWORD in .env`** — create `.env` from `.env.example` first.
- **Port in use** — change `APP_PORT`/`PROXY_PORT` (Docker) or the `-p` in `npm run dev`.
- **Cannot sign in over plain HTTP from another machine** — Secure cookies work on `localhost`
  and HTTPS only; use HTTPS or set `COOKIE_SECURE=false` for local testing.
- **`P1001` / cannot reach database in development** — `npm run db:dev:up` and check port 5434.
- **Prisma client errors after a schema change** — `npm run db:generate` and restart `npm run dev`.
- **Integration tests refuse to run** — `TEST_DATABASE_URL` must point to a database whose name
  ends in `_test` (it is dropped and recreated).
- More in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#troubleshooting).

## Source size & clean archive

```bash
npm run size          # bytes of distributable source (excludes node_modules, .next, generated code, uploads, .env…)
npm run package:zip   # release/careerhub-source.zip
```

The 30 MB limit applies to the distributable source. Installed dependencies (`node_modules`)
and Docker images are much larger by nature and are reported separately.

## Importing into GitHub

The project is ready for Git but no repository has been created or pushed.

```bash
cd CareerHub
git init -b main
git add .
git status            # verify: no .env, node_modules, .next, storage/ or src/generated
git commit -m "Initial import of CareerHub"
# Create an EMPTY repository on GitHub (no README/.gitignore), then:
git remote add origin https://github.com/<you>/careerhub.git
git push -u origin main
```

`.gitignore` already excludes secrets, dependencies, build output, generated Prisma client,
uploaded resumes and test artefacts.

## License

Private project. Add a license before publishing.
