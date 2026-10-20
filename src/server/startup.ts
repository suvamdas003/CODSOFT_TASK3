import { validateServerEnv } from "@/lib/env";

/** Logs configuration problems; in production also stops the process. */
export function enforceServerEnv() {
  const problems = validateServerEnv(process.env);
  if (!problems.length) return;
  const message = `CareerHub configuration problems:\n- ${problems.join("\n- ")}`;
  if (process.env.NODE_ENV === "production") {
    console.error(`${message}\nRefusing to start. See docs/DEPLOYMENT.md.`);
    process.exit(1);
  }
  console.warn(message);
}
