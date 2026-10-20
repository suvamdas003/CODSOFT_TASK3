import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/generated/prisma/enums";
import { config } from "@/lib/env";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { prisma } from "@/server/db";
import { getClientIp } from "@/server/request";

export const SESSION_COOKIE = "ch_session";

/** The authenticated user as seen by services. Contains no secrets. */
export type Actor = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a database session and sets the HttpOnly session cookie. */
export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt, ipAddress: await getClientIp(), userAgent },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Deletes the current session (server side) and clears the cookie. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

/** Looks up a session token; suspended users and expired sessions are rejected. */
export async function resolveSessionToken(token: string | undefined): Promise<Actor | null> {
  if (!token || token.length > 100) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expiresAt: true, user: { select: { id: true, email: true, name: true, role: true, status: true } } },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") return null;
  const { id, email, name, role } = session.user;
  return { id, email, name, role };
}

/** Current user for this request (memoised per request). */
export const getCurrentUser = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return resolveSessionToken(token);
});

export function homePathFor(role: Role): string {
  return role === "ADMIN" ? "/admin" : role === "RECRUITER" ? "/recruiter" : "/candidate";
}

/** For pages: redirects to the login page or the user's own dashboard when not allowed. */
export async function requirePageUser(roles?: Role[], nextPath?: string): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  if (roles && !roles.includes(user.role)) redirect(`/forbidden`);
  return user;
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function requireActor(roles?: Role[]): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  if (roles && !roles.includes(user.role)) throw new ForbiddenError();
  return user;
}
