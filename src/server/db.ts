import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

export { Prisma };

/** Transaction client accepted by helpers that may run inside a transaction. */
export type Tx = Prisma.TransactionClient;

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { __careerhubPrisma?: PrismaClient };

/**
 * Lazily created Prisma client, reused across hot reloads in development so we
 * do not exhaust database connections. Lazy creation also keeps `next build`
 * from requiring a database.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    globalForPrisma.__careerhubPrisma ??= createPrismaClient();
    const client = globalForPrisma.__careerhubPrisma;
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export async function disconnectPrisma() {
  await globalForPrisma.__careerhubPrisma?.$disconnect();
  globalForPrisma.__careerhubPrisma = undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}
