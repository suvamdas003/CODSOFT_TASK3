import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

async function check(fn: () => Promise<unknown>, timeoutMs = 3000): Promise<"ok" | "error"> {
  try {
    await Promise.race([fn(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs))]);
    return "ok";
  } catch (error) {
    console.error("[health] check failed", error instanceof Error ? error.message : error);
    return "error";
  }
}

/** Liveness + readiness: verifies the app responds and can reach the database and file storage. */
export async function GET() {
  const [database, storage] = await Promise.all([check(() => prisma.$queryRaw`SELECT 1`), check(() => getStorage().check())]);
  const healthy = database === "ok" && storage === "ok";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks: { database, storage }, time: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
