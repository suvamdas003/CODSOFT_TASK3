import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build (`npm run build` first) on
 * port 3007, backed by an isolated, freshly seeded `careerhub_e2e` database.
 */
const PORT = Number(process.env.E2E_PORT ?? 3007);
const baseURL = `http://localhost:${PORT}`;

function e2eDatabaseUrl(): string {
  const source = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!source) throw new Error("Set E2E_DATABASE_URL or DATABASE_URL.");
  const url = new URL(source);
  if (!process.env.E2E_DATABASE_URL) url.pathname = "/careerhub_e2e";
  return url.toString();
}

export const E2E_ENV = {
  DATABASE_URL: e2eDatabaseUrl(),
  STORAGE_DRIVER: "local",
  UPLOAD_DIR: "./storage/e2e-uploads",
  COOKIE_SECURE: "false",
  APP_URL: baseURL,
};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx tsx tests/e2e/prepare-database.ts && npx next start -p ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: E2E_ENV,
  },
});
