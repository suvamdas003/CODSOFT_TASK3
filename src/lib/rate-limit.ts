/**
 * Fixed-window in-memory rate limiter. Suitable for a single application
 * instance (the default Docker deployment); use a shared store such as Redis
 * if you scale out horizontally.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

/** Returns true if the action identified by `key` is allowed right now. */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) prune(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still full: drop the oldest entries rather than grow without bound.
  if (buckets.size >= MAX_KEYS) {
    for (const key of [...buckets.keys()].slice(0, Math.ceil(MAX_KEYS / 10))) buckets.delete(key);
  }
}
