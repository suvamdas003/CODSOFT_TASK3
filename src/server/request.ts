import "server-only";
import { headers } from "next/headers";
import { config } from "@/lib/env";

/** Best-effort client IP for rate limiting and audit logs. */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  return clientIpFromHeaders(h, config.trustProxy);
}

export function clientIpFromHeaders(h: Headers, trustProxy: boolean): string | null {
  if (trustProxy) {
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded.slice(0, 64);
    const real = h.get("x-real-ip")?.trim();
    if (real) return real.slice(0, 64);
  }
  return null;
}

/**
 * CSRF defence for cookie-authenticated route handlers that change state.
 * Browsers always send `Origin` on cross-site POSTs; we require it to match
 * the host the request was addressed to (Server Actions get the same check
 * from Next.js itself). Session cookies are also SameSite=Lax.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
