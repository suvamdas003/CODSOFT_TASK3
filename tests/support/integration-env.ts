import "dotenv/config";
import { afterAll } from "vitest";

// Point the app's Prisma client at the isolated test database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.STORAGE_DRIVER = "local";

const { setStorageForTests } = await import("@/server/storage");
const { MemoryStorage } = await import("./memory-storage");
setStorageForTests(new MemoryStorage());

afterAll(async () => {
  const { disconnectPrisma } = await import("@/server/db");
  await disconnectPrisma();
});
