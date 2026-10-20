# CareerHub security model

## Authentication & sessions

- Passwords are hashed with **scrypt** (N=16384, r=8, p=1, 16-byte random salt) and compared in
  constant time. Unknown emails still run a hash comparison, so response time does not reveal
  which accounts exist. Login errors are generic ("Invalid email or password.").
- Sessions are random 256-bit tokens stored in an `HttpOnly`, `SameSite=Lax` cookie
  (`Secure` in production by default). Only the **SHA-256 hash** of the token is stored in the
  database, so a database leak does not yield usable sessions.
- Sessions expire after `SESSION_TTL_DAYS` (default 7). Suspending a user deletes all their
  sessions immediately; changing a password signs out all other sessions.
- Login (10 attempts / 15 min per IP+email) and registration (10 / hour per IP) are rate limited
  (in-memory, per instance — use a shared store if you scale horizontally).
- Administrators cannot be self-registered; they are created by the seed or directly in the database.

## Authorisation (server-side, in services)

Every service function takes the acting user and enforces access itself — the UI hiding a
button is never the only protection. Highlights:

| Resource | Rule |
| --- | --- |
| Job (manage) | Only the recruiter who posted it. Others get `403`/not found. |
| Job (view) | Public if published, not removed, before deadline and posted by an active recruiter; otherwise only the owner and admins (preview). |
| Application (candidate view) | Only its candidate. Internal notes and interview notes are never selected. |
| Application (recruiter view, status, notes, interviews) | Only the recruiter who owns the job. |
| Resume download | The owning candidate, or a recruiter owning a job the resume was submitted to, while that application is not withdrawn. **Admins are deliberately not granted access.** Unauthorised requests get the same 404 as non-existent files. |
| Admin operations | `ADMIN` role only; admins cannot suspend themselves. All significant actions are written to `audit_events`. |

Protected pages also call `requirePageUser(roles)`; `src/proxy.ts` only performs an
optimistic redirect for missing cookies.

## Input validation & injection

- All action input is parsed with **Zod** (types, lengths, enums, URL schemes — `javascript:`
  links are rejected, control characters are rejected).
- Database access uses Prisma's parameterised queries. The only raw SQL is static
  (`SELECT 1`, test/seed `TRUNCATE`).
- React escapes all rendered text; no `dangerouslySetInnerHTML` is used. User-supplied URLs are
  re-checked before rendering and open with `rel="noopener noreferrer nofollow"`.
- Post-login redirects (`?next=`) accept only same-site relative paths.

## CSRF

- Mutations are Server Actions, which Next.js protects by comparing the `Origin` header with
  the host. Session cookies are `SameSite=Lax`.
- The only state-changing route handlers would use `isSameOriginRequest` (`src/server/request.ts`);
  the resume download route is read-only (`GET`).
- Behind a proxy, forward the public `Host` (see `docker/nginx.conf`).

## File uploads

- Accepted: PDF and DOCX only, verified by **file signature** (not the client MIME type) and
  extension. DOCX must look like a Word package; macro projects (`vbaProject.bin`) are rejected.
  PDFs containing `/JavaScript` or `/Launch` actions are rejected.
- Max size `RESUME_MAX_BYTES` (≤ 5 MB) and a per-candidate count limit (admin setting).
- Stored under random server-generated keys; original names are sanitised and only used for
  display / `Content-Disposition`.
- Downloads are served with `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`,
  `Cache-Control: private, no-store` and a `sandbox` CSP.
- Uploaded files never live in `public/`, are excluded from Git, Docker build context and the
  source ZIP.

## HTTP hardening

`next.config.ts` sets a Content-Security-Policy (same-origin only, `frame-ancestors 'none'`,
`object-src 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy` and `Permissions-Policy`, and removes `X-Powered-By`.

## Secrets & containers

- No secrets in the repository or images: `.env*` files (except `.env.example`) are ignored by
  Git and `.dockerignore`; Compose passes a whitelist of variables at runtime.
- The app container runs as the unprivileged `node` user with a read-only root filesystem,
  `no-new-privileges`, all capabilities dropped. PostgreSQL is only on an internal Docker
  network and is not published to the host. The app port binds to `127.0.0.1` by default.
- Startup fails fast in production on unsafe configuration (e.g. `COOKIE_SECURE=false` with an
  https URL, missing S3 credentials).

## Privacy

- Public endpoints expose company names and job content only — never recruiter or candidate
  contact data.
- Candidate profiles (including phone) are visible only to recruiters of jobs the candidate
  applied to. Demo data uses fictional people and the reserved `.test` domain.

## Known limitations

- Rate limiting is per process. Use Redis or a gateway limiter for multi-instance deployments.
- There is no email verification or password-reset email flow (no mail service is configured).
- Antivirus scanning of uploads is not included; add one (e.g. ClamAV) before accepting
  untrusted files at scale.
