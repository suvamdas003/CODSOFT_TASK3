import { beforeAll, describe, expect, it } from "vitest";
import { authenticate, changePassword, registerUser } from "@/features/auth/service";
import { setUserStatus, updateSettings } from "@/features/admin/service";
import { resolveSessionToken, hashToken } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ConflictError, ForbiddenError, RateLimitError, ValidationError } from "@/lib/errors";
import { createAdmin, createCandidate, createRecruiter, fakeIp, PASSWORD, resetDatabase } from "../support/fixtures";

beforeAll(resetDatabase);

describe("registration", () => {
  it("creates candidates with a profile and recruiters with a company", async () => {
    const candidate = await createCandidate();
    const recruiter = await createRecruiter("Globex");
    expect(await prisma.candidateProfile.count({ where: { userId: candidate.id } })).toBe(1);
    const profile = await prisma.recruiterProfile.findUnique({ where: { userId: recruiter.id }, include: { company: true } });
    expect(profile?.company.name).toBe("Globex");
    expect(profile?.company.slug).toMatch(/^globex-[a-f0-9]{6}$/);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: candidate.id } });
    expect(stored.passwordHash).not.toContain(PASSWORD);
  });

  it("rejects duplicate emails (case-insensitively normalised by validation)", async () => {
    const email = "dup@example.test";
    await registerUser({ role: "CANDIDATE", name: "One", email, password: PASSWORD }, fakeIp());
    await expect(registerUser({ role: "CANDIDATE", name: "Two", email, password: PASSWORD }, fakeIp())).rejects.toBeInstanceOf(ConflictError);
  });

  it("honours registration settings", async () => {
    const admin = await createAdmin();
    await updateSettings(admin, { allowCandidateRegistration: false, allowRecruiterRegistration: true, maxResumesPerCandidate: 5, announcement: null }, null);
    await expect(registerUser({ role: "CANDIDATE", name: "Late", email: "late@example.test", password: PASSWORD }, fakeIp())).rejects.toBeInstanceOf(ForbiddenError);
    await updateSettings(admin, { allowCandidateRegistration: true, allowRecruiterRegistration: true, maxResumesPerCandidate: 5, announcement: null }, null);
  });
});

describe("login", () => {
  it("accepts valid credentials and rejects wrong ones with a generic message", async () => {
    const user = await createCandidate();
    const actor = await authenticate(user.email, PASSWORD, fakeIp());
    expect(actor).toMatchObject({ id: user.id, role: "CANDIDATE" });
    await expect(authenticate(user.email, "Wrong-Password-1", fakeIp())).rejects.toThrow("Invalid email or password.");
    await expect(authenticate("nobody@example.test", PASSWORD, fakeIp())).rejects.toThrow("Invalid email or password.");
  });

  it("rate-limits repeated failures from the same IP and email", async () => {
    const user = await createCandidate();
    const ip = fakeIp();
    for (let i = 0; i < 10; i++) await expect(authenticate(user.email, "Wrong-Password-1", ip)).rejects.toBeInstanceOf(ValidationError);
    await expect(authenticate(user.email, PASSWORD, ip)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("blocks suspended users and revokes their sessions", async () => {
    const admin = await createAdmin();
    const user = await createCandidate();
    const token = "test-session-token-" + Date.now();
    await prisma.session.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600_000) } });
    expect(await resolveSessionToken(token)).toMatchObject({ id: user.id });

    await setUserStatus(admin, user.id, "SUSPENDED", "spam", null);
    expect(await resolveSessionToken(token)).toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    await expect(authenticate(user.email, PASSWORD, fakeIp())).rejects.toBeInstanceOf(ForbiddenError);

    const audit = await prisma.auditEvent.findFirst({ where: { action: "user.suspend", entityId: user.id } });
    expect(audit?.actorId).toBe(admin.id);
  });

  it("rejects expired sessions", async () => {
    const user = await createCandidate();
    const token = "expired-token-" + Date.now();
    await prisma.session.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() - 1000) } });
    expect(await resolveSessionToken(token)).toBeNull();
    expect(await resolveSessionToken(undefined)).toBeNull();
  });

  it("changes passwords only with the current password and signs out other sessions", async () => {
    const user = await createCandidate();
    await prisma.session.createMany({
      data: [
        { userId: user.id, tokenHash: hashToken("keep-" + user.id), expiresAt: new Date(Date.now() + 3600_000) },
        { userId: user.id, tokenHash: hashToken("other-" + user.id), expiresAt: new Date(Date.now() + 3600_000) },
      ],
    });
    await expect(changePassword(user, "Wrong-Password-1", "New-Password-456")).rejects.toBeInstanceOf(ValidationError);
    await changePassword(user, PASSWORD, "New-Password-456", hashToken("keep-" + user.id));
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
    await expect(authenticate(user.email, "New-Password-456", fakeIp())).resolves.toMatchObject({ id: user.id });
  });

  it("prevents admins from suspending themselves", async () => {
    const admin = await createAdmin();
    await expect(setUserStatus(admin, admin.id, "SUSPENDED", null, null)).rejects.toBeInstanceOf(ValidationError);
    const recruiter = await createRecruiter();
    await expect(setUserStatus(recruiter, admin.id, "SUSPENDED", null, null)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
