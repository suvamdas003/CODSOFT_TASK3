# CareerHub architecture

CareerHub is a single Next.js 16 (App Router) application. Pages are React
Server Components that call server-side services directly; mutations go
through Server Actions; two route handlers cover what actions cannot
(authorised file downloads and the health check). PostgreSQL is accessed
through Prisma 7 with the `pg` driver adapter.

```
Browser ──HTTP──► Next.js (Node.js runtime)
                   ├─ src/proxy.ts                optimistic "signed in?" redirect for dashboards
                   ├─ src/app/**/page.tsx         server-rendered pages (auth checked per page)
                   ├─ src/features/*/actions.ts   Server Actions: parse FormData → Zod → service
                   ├─ src/features/*/service.ts   business rules + authorisation + Prisma queries
                   ├─ src/app/api/resumes/[id]    authorised resume download (route handler)
                   ├─ src/app/api/health          liveness/readiness (DB + storage)
                   └─ src/server/storage          local volume | S3-compatible adapter
                          │
                          ▼
                     PostgreSQL 17
```

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Routes & UI | `src/app`, `src/components`, `src/features/*/components` | Rendering, forms, navigation. Every protected page calls `requirePageUser(roles)`. |
| Actions | `src/features/*/actions.ts` | `"use server"` entry points. Authenticate (`requireActor`), validate (`parseInput` + Zod), call a service, revalidate. Errors become `ActionState` via `runAction`. |
| Services | `src/features/*/service.ts` | Domain logic. **Every service function receives the acting user and enforces ownership/role checks itself**, so authorisation does not depend on the UI. |
| Server infra | `src/server` | Prisma client, sessions, audit log, notifications, storage adapters, request helpers. |
| Shared lib | `src/lib` | Validation helpers, password hashing, formatting, errors, rate limiting, env config. |

Feature folders: `auth`, `jobs`, `applications`, `candidates` (profile + resumes),
`recruiters` (company + stats), `admin` (moderation, users, settings, audit),
`notifications`.

## Data model

```
User ─┬─ CandidateProfile (1:1)          Company ─┬─ RecruiterProfile (n)
      ├─ RecruiterProfile (1:1) ─────────────────┘└─ Job (n)
      ├─ Session (n)                     Job ─┬─ Application (n) ─┬─ ApplicationStatusEvent (history)
      ├─ Resume (n) ◄── Application.resumeId    ├─ SavedJob (n)    ├─ ApplicationNote (internal)
      ├─ Notification (n)                       └─ JobReport (n)   └─ Interview (n)
      └─ AuditEvent (n, actor)           PlatformSettings (singleton id = 1)
```

Key constraints (Prisma schema + SQL in `prisma/migrations`):

- `applications (job_id, candidate_id)` **unique** — the final duplicate-application guard, race-safe.
- `job_reports (job_id, reporter_id)` unique — one report per user per job.
- `saved_jobs` composite primary key `(user_id, job_id)`.
- Partial unique index: at most one default resume per candidate.
- CHECK constraints: salary range ordering and non-negative values, interview duration 5–480,
  experience years 0–70, positive file sizes, settings singleton.
- Jobs with applications cannot be deleted (`ON DELETE RESTRICT`); recruiters close them instead.
- Deleting a resume sets `applications.resume_id` to `NULL` (candidate privacy wins).
- `skill_keys` (lower-cased copies of skills, GIN-indexed) give case-insensitive skill search.

## Request flow example: applying to a job

1. `/jobs/[id]` (Server Component) loads the job via `getJobForViewer`, which only returns
   public jobs unless the viewer owns the draft or is an admin.
2. The candidate submits `ApplyForm` → `applyAction` (Server Action; Next.js checks the
   `Origin` header against the host).
3. `applyAction` requires a `CANDIDATE` session, validates input with Zod and calls
   `applyToJob(actor, input)`.
4. `applyToJob` re-checks that the job is public and open, that the resume belongs to the
   candidate, then in one transaction creates the application, the first status event and a
   notification for the recruiter. A unique-constraint violation becomes "already applied".
5. The action revalidates candidate pages and redirects to the application tracker.

## Rendering

All pages are dynamic (they depend on the session cookie). Lists use URL search
parameters for filters, sorting and pagination, so they work without JavaScript
and are shareable. Forms are progressively enhanced: without JavaScript they post
natively; with JavaScript `ActionForm` dispatches the action without React's
automatic form reset, so validation errors never wipe user input.

## Storage adapters

`src/server/storage` defines `StorageAdapter { put, get, delete, check }`:

- `LocalStorage` — files under `UPLOAD_DIR` (a named Docker volume in Compose),
  mode `0600`, paths validated against traversal.
- `S3Storage` — any S3-compatible service, signed with AWS SigV4 implemented on
  `node:crypto` (verified against the AWS test vector) to avoid the AWS SDK's size.

Storage keys are always server-generated: `resumes/<userId>/<uuid>.<pdf|docx>`.

## Statistics

Recruiter and admin dashboards are computed with `groupBy`/`count`/`aggregate`
queries at request time — no hard-coded numbers. Job views are counted when a
public job page is rendered (owners' own views excluded).
