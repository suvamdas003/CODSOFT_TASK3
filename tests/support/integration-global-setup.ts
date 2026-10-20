import { execSync } from "node:child_process";
import "dotenv/config";
import { Client } from "pg";

/**
 * Creates (or recreates) a dedicated test database and applies all
 * migrations to it. Never touches the development database.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example).");
  const target = new URL(url);
  const dbName = target.pathname.slice(1);
  if (!/^[a-z0-9_]+_test$/.test(dbName)) {
    throw new Error(`Refusing to use "${dbName}" for tests: the database name must end with "_test".`);
  }

  const admin = new URL(url);
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

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
