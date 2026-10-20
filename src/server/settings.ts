import "server-only";
import { prisma, type Tx } from "@/server/db";

/** Returns the singleton platform settings row, creating it with defaults if missing. */
export async function getPlatformSettings(db: Tx = prisma) {
  return db.platformSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}
