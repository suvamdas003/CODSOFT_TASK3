/**
 * Typed access to runtime configuration plus a startup sanity check.
 * Secrets are only ever read from the environment, never from source.
 */
export const config = {
  get appUrl() {
    return process.env.APP_URL ?? "http://localhost:3005";
  },
  /** Session cookies get the Secure flag unless explicitly disabled (plain-HTTP local runs). */
  get cookieSecure() {
    const raw = process.env.COOKIE_SECURE;
    if (raw === "false") return false;
    if (raw === "true") return true;
    return process.env.NODE_ENV === "production";
  },
  get sessionTtlDays() {
    return clampInt(process.env.SESSION_TTL_DAYS, 7, 1, 90);
  },
  /** Only trust X-Forwarded-For when a reverse proxy we control sets it. */
  get trustProxy() {
    return process.env.TRUST_PROXY === "true";
  },
  /** Capped at 5 MB to stay below the Server Action body limit set in next.config.ts. */
  get resumeMaxBytes() {
    return clampInt(process.env.RESUME_MAX_BYTES, 5 * 1024 * 1024, 10 * 1024, 5 * 1024 * 1024);
  },
  get storageDriver(): "local" | "s3" {
    return process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
  },
  get uploadDir() {
    return process.env.UPLOAD_DIR ?? "./storage/uploads";
  },
};

export function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = raw === undefined || raw === "" ? NaN : Number(raw);
  if (!Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Returns human-readable configuration problems (empty when everything is fine). */
export function validateServerEnv(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];
  if (!env.DATABASE_URL) problems.push("DATABASE_URL is required.");
  if (env.STORAGE_DRIVER === "s3") {
    for (const key of ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) {
      if (!env[key]) problems.push(`${key} is required when STORAGE_DRIVER=s3.`);
    }
  }
  if (env.APP_URL?.startsWith("https://") && env.COOKIE_SECURE === "false") {
    problems.push("COOKIE_SECURE=false is not allowed when APP_URL uses https.");
  }
  return problems;
}
