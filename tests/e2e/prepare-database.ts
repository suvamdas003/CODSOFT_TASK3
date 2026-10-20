/**
 * Recreates the isolated e2e database, migrates it and loads the demo seed.
 * Run by Playwright's webServer command before `next start` (Playwright
 * starts the web server before globalSetup, so this cannot be a globalSetup).
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { Client } from "pg";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const uploadDir = process.env.UPLOAD_DIR;
  if (!databaseUrl || !uploadDir) throw new Error("DATABASE_URL and UPLOAD_DIR must be set by playwright.config.ts.");
  const dbName = new URL(databaseUrl).pathname.slice(1);
  if (!dbName.endsWith("_e2e")) throw new Error(`Refusing to reset "${dbName}": e2e database names must end with "_e2e".`);

  const admin = new URL(databaseUrl);
  admin.pathname = "/postgres";
  admin.search = "";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.end();
  }

  rmSync(uploadDir, { recursive: true, force: true });
  const env = { ...process.env, NODE_ENV: "development" as const };
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
