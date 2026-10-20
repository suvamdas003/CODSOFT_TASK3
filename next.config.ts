import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Next.js injects small inline bootstrap scripts, hence 'unsafe-inline' for
// scripts. Everything else is locked to this origin; no third-party assets.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Resume uploads go through a Server Action; files are capped at 5 MB
    // (RESUME_MAX_BYTES) and multipart encoding adds a little overhead.
    serverActions: { bodySizeLimit: "6mb" },
  },
  // The Docker build sets NEXT_OUTPUT=standalone to produce a minimal self-contained server.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
