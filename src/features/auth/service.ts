import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma, isUniqueViolation } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { getPlatformSettings } from "@/server/settings";
import { ConflictError, ForbiddenError, RateLimitError, ValidationError } from "@/lib/errors";
import { getDummyHash, hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils";
import { randomBytes } from "node:crypto";
import type { RegisterInput } from "./schemas";

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const INVALID_LOGIN = "Invalid email or password.";

/** Verifies credentials. Returns the user on success; throws a generic error otherwise. */
export async function authenticate(email: string, password: string, ip: string | null): Promise<Actor> {
  const limiterKey = `login:${ip ?? "unknown"}:${email}`;
  if (!rateLimit(limiterKey, LOGIN_LIMIT, LOGIN_WINDOW_MS)) throw new RateLimitError();

  const user = await prisma.user.findUnique({ where: { email } });
  // Always run a hash comparison so unknown emails take as long as known ones.
  const ok = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !ok) throw new ValidationError(INVALID_LOGIN);
  if (user.status !== "ACTIVE") throw new ForbiddenError("This account has been suspended. Contact support for help.");

  resetRateLimit(limiterKey);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    // Housekeeping: drop this user's expired sessions.
    prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } }),
  ]);
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Creates a candidate or recruiter account. Administrators are never self-registered. */
export async function registerUser(input: RegisterInput, ip: string | null): Promise<Actor> {
  if (!rateLimit(`register:${ip ?? "unknown"}`, 10, 60 * 60 * 1000)) throw new RateLimitError();

  const settings = await getPlatformSettings();
  if (input.role === "CANDIDATE" && !settings.allowCandidateRegistration) {
    throw new ForbiddenError("Candidate registration is currently closed.");
  }
  if (input.role === "RECRUITER" && !settings.allowRecruiterRegistration) {
    throw new ForbiddenError("Recruiter registration is currently closed.");
  }

  const passwordHash = await hashPassword(input.password);
  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash, role: input.role },
      });
      if (input.role === "CANDIDATE") {
        await tx.candidateProfile.create({ data: { userId: created.id } });
      } else {
        const company = await tx.company.create({
          data: {
            name: input.companyName,
            slug: `${slugify(input.companyName) || "company"}-${randomBytes(3).toString("hex")}`,
            website: input.companyWebsite,
          },
        });
        await tx.recruiterProfile.create({ data: { userId: created.id, companyId: company.id } });
      }
      await recordAudit({ actorId: created.id, action: "user.register", entityType: "User", entityId: created.id, metadata: { role: input.role }, ipAddress: ip }, tx);
      return created;
    });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("An account with this email already exists. Try signing in instead.");
    }
    throw error;
  }
}

export async function changePassword(actor: Actor, currentPassword: string, newPassword: string, currentSessionTokenHash?: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ValidationError("Current password is incorrect.", { currentPassword: "Current password is incorrect." });
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: actor.id }, data: { passwordHash } }),
    // Sign out every other device.
    prisma.session.deleteMany({
      where: { userId: actor.id, ...(currentSessionTokenHash ? { NOT: { tokenHash: currentSessionTokenHash } } : {}) },
    }),
  ]);
  await recordAudit({ actorId: actor.id, action: "user.password_change", entityType: "User", entityId: actor.id });
}

export async function updateAccountName(actor: Actor, name: string) {
  await prisma.user.update({ where: { id: actor.id }, data: { name } });
}
