/**
 * Runs once when the Next.js server starts. In production, missing or unsafe
 * configuration stops the process so the container fails fast with the
 * reasons in its log instead of serving broken pages.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { enforceServerEnv } = await import("./server/startup");
    enforceServerEnv();
  }
}
