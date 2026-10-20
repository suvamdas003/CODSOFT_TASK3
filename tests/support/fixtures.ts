import { randomBytes } from "node:crypto";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import type { JobInput } from "@/features/jobs/schemas";
import { createJob } from "@/features/jobs/service";
import { registerUser } from "@/features/auth/service";
import { hashPassword } from "@/lib/password";

export const PASSWORD = "Test-Password-123";

/** Deletes every row so each test file starts from a clean database. */
export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "audit_events","notifications","interviews","application_notes","application_status_events","applications","resumes","job_reports","saved_jobs","jobs","recruiter_profiles","candidate_profiles","companies","sessions","platform_settings","users" CASCADE`,
  );
  await prisma.platformSettings.create({ data: { id: 1 } });
}

/** A unique fake IP per call so tests never share a rate-limit bucket. */
export function fakeIp() {
  return `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}`;
}

let counter = 0;
const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${++counter}@example.test`;

export async function createCandidate(name = "Test Candidate"): Promise<Actor> {
  return registerUser({ role: "CANDIDATE", name, email: uniqueEmail("candidate"), password: PASSWORD }, fakeIp());
}

export async function createRecruiter(companyName = "Acme Corp"): Promise<Actor> {
  return registerUser(
    { role: "RECRUITER", name: "Test Recruiter", email: uniqueEmail("recruiter"), password: PASSWORD, companyName, companyWebsite: null },
    fakeIp(),
  );
}

export async function createAdmin(): Promise<Actor> {
  const user = await prisma.user.create({
    data: { email: uniqueEmail("admin"), name: "Test Admin", role: "ADMIN", passwordHash: await hashPassword(PASSWORD) },
  });
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function jobInput(overrides: Partial<JobInput> = {}): JobInput {
  return {
    title: "Software Engineer",
    location: "Remote",
    workplaceType: "REMOTE",
    employmentType: "FULL_TIME",
    experienceLevel: "MID",
    description: "Build and maintain our product with a friendly team.",
    requirements: "Experience with TypeScript and SQL.",
    responsibilities: null,
    benefits: null,
    salaryMin: 50000,
    salaryMax: 70000,
    salaryCurrency: "USD",
    skills: ["TypeScript", "SQL"],
    applicationDeadline: null,
    ...overrides,
  };
}

export async function createPublishedJob(recruiter: Actor, overrides: Partial<JobInput> = {}) {
  return createJob(recruiter, jobInput(overrides), true);
}

/** Minimal valid PDF bytes. */
export function pdfBytes(text = "resume") {
  return Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% ${text}\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`, "latin1");
}
