/**
 * Demo seed: synthetic users, companies, jobs, applications and resumes for
 * local development and evaluation. Never run against production data.
 *
 *   npm run db:seed                 # seeds an empty database
 *   SEED_RESET=true npm run db:seed # wipes ALL data first, then seeds
 *
 * In NODE_ENV=production it refuses to run unless ALLOW_DEMO_SEED=true.
 */
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { ApplicationStatus } from "../src/generated/prisma/enums";
import { hashPassword } from "../src/lib/password";
import { skillKeysOf } from "../src/lib/utils";
import { LocalStorage } from "../src/server/storage/local";
import { S3Storage } from "../src/server/storage/s3";
import type { StorageAdapter } from "../src/server/storage/types";
import { COMPANIES, JOBS, describe } from "./seed-data";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (d: number, hours = 0) => new Date(now - d * DAY - hours * 60 * 60 * 1000);

export const DEMO_PASSWORDS = {
  admin: process.env.SEED_ADMIN_PASSWORD || "DevOnly-Admin-2026!",
  recruiter: process.env.SEED_RECRUITER_PASSWORD || "DevOnly-Recruiter-2026!",
  candidate: process.env.SEED_CANDIDATE_PASSWORD || "DevOnly-Candidate-2026!",
};

function storageFromEnv(): StorageAdapter {
  if (process.env.STORAGE_DRIVER === "s3") {
    return new S3Storage({
      bucket: process.env.S3_BUCKET!,
      region: process.env.S3_REGION!,
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    });
  }
  return new LocalStorage(process.env.UPLOAD_DIR ?? "./storage/uploads");
}

/** Builds a minimal valid one-page PDF containing the given lines of text. */
export function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7E]/g, "?");
  const content = ["BT", "/F1 12 Tf", "72 720 Td", "16 TL", ...lines.map((l) => `(${esc(l)}) Tj T*`), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Refusing to seed demo data in production. Set ALLOW_DEMO_SEED=true to override (evaluation only).");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const storage = storageFromEnv();

  try {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      if (process.env.SEED_RESET !== "true") {
        console.log(`Database already has ${existingUsers} users — skipping seed. Run with SEED_RESET=true to wipe and reseed.`);
        return;
      }
      console.log("SEED_RESET=true — deleting all existing data…");
      const files = await prisma.resume.findMany({ select: { storageKey: true } });
      for (const f of files) await storage.delete(f.storageKey).catch(() => undefined);
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "audit_events","notifications","interviews","application_notes","application_status_events","applications","resumes","job_reports","saved_jobs","jobs","recruiter_profiles","candidate_profiles","companies","sessions","platform_settings","users" CASCADE`,
      );
    }
    await prisma.platformSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

    const [adminHash, recruiterHash, candidateHash] = await Promise.all([
      hashPassword(DEMO_PASSWORDS.admin),
      hashPassword(DEMO_PASSWORDS.recruiter),
      hashPassword(DEMO_PASSWORDS.candidate),
    ]);

    // ── Users ──────────────────────────────────────────────────────────────
    const admin = await prisma.user.create({
      data: { email: "admin@careerhub.test", name: "Alex Admin", passwordHash: adminHash, role: "ADMIN", createdAt: daysAgo(60) },
    });

    const companyIds: Record<string, string> = {};
    for (const c of COMPANIES) {
      const { key, ...data } = c;
      companyIds[key] = (await prisma.company.create({ data: { ...data, createdAt: daysAgo(55) } })).id;
    }

    const recruiterSpecs = [
      { key: "recruiter", email: "recruiter@careerhub.test", name: "Riley Recruiter", company: "northwind", jobTitle: "Talent Partner" },
      { key: "recruiter2", email: "recruiter2@careerhub.test", name: "Morgan Hiring", company: "bluepeak", jobTitle: "Recruitment Lead" },
      { key: "recruiter3", email: "recruiter3@careerhub.test", name: "Sam Talent", company: "orbit", jobTitle: "HR Manager" },
    ] as const;
    const recruiters: Record<string, string> = {};
    for (const r of recruiterSpecs) {
      const user = await prisma.user.create({
        data: {
          email: r.email,
          name: r.name,
          passwordHash: recruiterHash,
          role: "RECRUITER",
          createdAt: daysAgo(50),
          recruiterProfile: { create: { companyId: companyIds[r.company], jobTitle: r.jobTitle } },
        },
      });
      recruiters[r.key] = user.id;
    }

    const candidateSpecs = [
      {
        email: "candidate@careerhub.test",
        name: "Ava Candidate",
        profile: { headline: "Frontend Engineer · React & TypeScript", location: "Berlin, Germany", phone: "+49 30 000000", skills: ["React", "TypeScript", "Next.js", "CSS", "Testing"], experienceYears: 6, desiredEmploymentType: "FULL_TIME" as const, desiredWorkplaceType: "HYBRID" as const, linkedinUrl: "https://linkedin.example/in/ava", summary: "Product-minded frontend engineer who enjoys accessible, fast interfaces." },
      },
      {
        email: "candidate2@careerhub.test",
        name: "Ben Applicant",
        profile: { headline: "Product Designer", location: "Toronto, Canada", skills: ["Figma", "Design systems", "User research"], experienceYears: 8, desiredWorkplaceType: "HYBRID" as const, portfolioUrl: "https://portfolio.example/ben", summary: "Designer focused on complex B2B workflows." },
      },
      {
        email: "candidate3@careerhub.test",
        name: "Chen Jobseeker",
        profile: { headline: "Data & Backend Engineer", location: "Vancouver, Canada", skills: ["Python", "SQL", "Node.js", "PostgreSQL"], experienceYears: 3, desiredEmploymentType: "FULL_TIME" as const, summary: "Engineer who likes turning messy data into reliable services." },
      },
    ];
    const candidates: string[] = [];
    for (const [i, c] of candidateSpecs.entries()) {
      const user = await prisma.user.create({
        data: { email: c.email, name: c.name, passwordHash: candidateHash, role: "CANDIDATE", createdAt: daysAgo(45 - i * 5), candidateProfile: { create: { ...c.profile, skillKeys: skillKeysOf(c.profile.skills) } } },
      });
      candidates.push(user.id);
    }

    // ── Resumes (synthetic PDFs written to the configured storage) ────────
    async function addResume(ownerId: string, name: string, fileName: string, isDefault: boolean) {
      const data = makePdf([`${name} — Resume (synthetic demo document)`, "", "Experience: demo data only.", "Skills: see CareerHub profile.", "Generated by the CareerHub seed script."]);
      const storageKey = `resumes/${ownerId}/${randomUUID()}.pdf`;
      await storage.put(storageKey, data, "application/pdf");
      return prisma.resume.create({
        data: { ownerId, originalName: fileName, storageKey, mimeType: "application/pdf", sizeBytes: data.length, sha256: createHash("sha256").update(data).digest("hex"), isDefault },
      });
    }
    const resumes = [
      await addResume(candidates[0], candidateSpecs[0].name, "Ava-Candidate-Resume.pdf", true),
      await addResume(candidates[1], candidateSpecs[1].name, "Ben-Applicant-Portfolio-CV.pdf", true),
      await addResume(candidates[2], candidateSpecs[2].name, "Chen-Jobseeker-CV.pdf", true),
    ];
    await addResume(candidates[0], candidateSpecs[0].name, "Ava-Candidate-Resume-Short.pdf", false);

    // ── Jobs ───────────────────────────────────────────────────────────────
    const jobs: { id: string; title: string; postedById: string }[] = [];
    for (const j of JOBS) {
      const company = COMPANIES.find((c) => c.key === j.company)!;
      const created = daysAgo(j.daysAgo + 1);
      const job = await prisma.job.create({
        data: {
          companyId: companyIds[j.company],
          postedById: recruiters[j.recruiter],
          title: j.title,
          location: j.location,
          workplaceType: j.workplaceType,
          employmentType: j.employmentType,
          experienceLevel: j.experienceLevel,
          salaryMin: j.salary?.[0],
          salaryMax: j.salary?.[1],
          salaryCurrency: j.salary?.[2] ?? "USD",
          skills: j.skills,
          skillKeys: skillKeysOf(j.skills),
          status: j.status,
          viewCount: j.views,
          publishedAt: j.status === "DRAFT" ? null : daysAgo(j.daysAgo),
          closedAt: j.status === "CLOSED" ? daysAgo(3) : null,
          applicationDeadline: j.deadlineInDays ? new Date(now + j.deadlineInDays * DAY) : null,
          createdAt: created,
          ...describe(j.title, company.name),
        },
      });
      jobs.push({ id: job.id, title: job.title, postedById: job.postedById });
    }

    // ── Applications with status history ─────────────────────────────────
    async function apply(jobIndex: number, candidateIndex: number, path: ApplicationStatus[], appliedDaysAgo: number, coverLetter?: string) {
      const job = jobs[jobIndex];
      const createdAt = daysAgo(appliedDaysAgo);
      const app = await prisma.application.create({
        data: {
          jobId: job.id,
          candidateId: candidates[candidateIndex],
          resumeId: resumes[candidateIndex].id,
          coverLetter: coverLetter ?? null,
          status: path[path.length - 1],
          createdAt,
        },
      });
      let previous: ApplicationStatus | null = null;
      for (const [step, status] of path.entries()) {
        const at = new Date(createdAt.getTime() + step * DAY * 0.8);
        await prisma.applicationStatusEvent.create({
          data: {
            applicationId: app.id,
            fromStatus: previous,
            toStatus: status,
            changedById: status === "APPLIED" || status === "WITHDRAWN" ? candidates[candidateIndex] : job.postedById,
            createdAt: at,
          },
        });
        if (step > 0 && status !== "WITHDRAWN") {
          await prisma.notification.create({
            data: { userId: candidates[candidateIndex], type: "APPLICATION_STATUS", title: `Application update: ${job.title}`, body: `Your application status is now "${status.charAt(0)}${status.slice(1).toLowerCase()}".`, link: `/candidate/applications/${app.id}`, createdAt: at, readAt: step < path.length - 1 ? at : null },
          });
        }
        previous = status;
      }
      await prisma.notification.create({
        data: { userId: job.postedById, type: "APPLICATION_RECEIVED", title: `New application for ${job.title}`, body: "A candidate applied.", link: `/recruiter/applications/${app.id}`, createdAt, readAt: appliedDaysAgo > 2 ? createdAt : null },
      });
      return { app, job };
    }

    const avaFrontend = await apply(0, 0, ["APPLIED", "SHORTLISTED", "INTERVIEW"], 2, "I have shipped design-system driven React apps for six years and would love to help Northwind's frontend team.");
    await apply(0, 1, ["APPLIED"], 1);
    await apply(0, 2, ["APPLIED", "REJECTED"], 2);
    await apply(1, 0, ["APPLIED", "SHORTLISTED"], 4);
    await apply(1, 2, ["APPLIED"], 3, "Backend services with Node.js and PostgreSQL are my daily work.");
    await apply(5, 1, ["APPLIED", "SHORTLISTED", "INTERVIEW", "OFFERED", "HIRED"], 35);
    await apply(5, 0, ["APPLIED", "WITHDRAWN"], 30);
    await apply(6, 1, ["APPLIED", "SHORTLISTED", "INTERVIEW", "OFFERED"], 3);
    const chenData = await apply(7, 2, ["APPLIED", "INTERVIEW"], 5);
    await apply(10, 0, ["APPLIED"], 0);

    // ── Interviews & internal notes ───────────────────────────────────────
    const upcoming = new Date(now + 3 * DAY);
    upcoming.setUTCHours(14, 0, 0, 0);
    await prisma.interview.create({
      data: { applicationId: avaFrontend.app.id, scheduledById: avaFrontend.job.postedById, startsAt: upcoming, durationMinutes: 60, mode: "VIDEO", location: "https://meet.example/northwind-frontend", internalNotes: "Panel: tech lead + design engineer. Focus on accessibility." },
    });
    await prisma.notification.create({
      data: { userId: candidates[0], type: "INTERVIEW_SCHEDULED", title: `Interview scheduled: ${avaFrontend.job.title}`, body: "Video interview — see application for details.", link: `/candidate/applications/${avaFrontend.app.id}` },
    });
    const past = new Date(now - 2 * DAY);
    past.setUTCHours(16, 30, 0, 0);
    await prisma.interview.create({
      data: { applicationId: chenData.app.id, scheduledById: chenData.job.postedById, startsAt: past, durationMinutes: 45, mode: "PHONE", location: "+1 604 000 0000", status: "COMPLETED", internalNotes: "Strong SQL fundamentals." },
    });
    await prisma.applicationNote.createMany({
      data: [
        { applicationId: avaFrontend.app.id, authorId: avaFrontend.job.postedById, body: "Great portfolio. Strong match for the design-system work.", createdAt: daysAgo(1) },
        { applicationId: chenData.app.id, authorId: chenData.job.postedById, body: "Follow up on availability for a technical exercise.", createdAt: daysAgo(1) },
      ],
    });

    // ── Saved jobs, reports, audit history ────────────────────────────────
    await prisma.savedJob.createMany({
      data: [
        { userId: candidates[0], jobId: jobs[3].id },
        { userId: candidates[0], jobId: jobs[9].id },
        { userId: candidates[1], jobId: jobs[0].id },
        { userId: candidates[2], jobId: jobs[13].id },
      ],
    });
    await prisma.jobReport.create({
      data: { jobId: jobs[12].id, reporterId: candidates[1], reason: "FRAUD", details: "Unrealistic pay and no real job description — looks like a scam.", createdAt: daysAgo(0, 5) },
    });
    await prisma.jobReport.create({
      data: { jobId: jobs[12].id, reporterId: candidates[2], reason: "SPAM", createdAt: daysAgo(0, 2) },
    });
    await prisma.jobReport.create({
      data: { jobId: jobs[11].id, reporterId: candidates[0], reason: "MISLEADING", details: "Location seems wrong.", status: "DISMISSED", resolutionNote: "Location verified with employer.", resolvedById: admin.id, resolvedAt: daysAgo(4), createdAt: daysAgo(6) },
    });
    await prisma.auditEvent.createMany({
      data: [
        { actorId: admin.id, action: "company.verify", entityType: "Company", entityId: companyIds.northwind, metadata: { name: "Northwind Labs" }, createdAt: daysAgo(50) },
        { actorId: admin.id, action: "company.verify", entityType: "Company", entityId: companyIds.bluepeak, metadata: { name: "Bluepeak Health" }, createdAt: daysAgo(49) },
        { actorId: admin.id, action: "report.dismissed", entityType: "JobReport", entityId: null, metadata: { reason: "MISLEADING" }, createdAt: daysAgo(4) },
      ],
    });

    console.log("Seed complete. Development-only accounts:");
    console.table([
      { role: "Administrator", email: "admin@careerhub.test", password: DEMO_PASSWORDS.admin },
      { role: "Recruiter (Northwind Labs)", email: "recruiter@careerhub.test", password: DEMO_PASSWORDS.recruiter },
      { role: "Recruiter (Bluepeak Health)", email: "recruiter2@careerhub.test", password: DEMO_PASSWORDS.recruiter },
      { role: "Recruiter (Orbit Retail)", email: "recruiter3@careerhub.test", password: DEMO_PASSWORDS.recruiter },
      { role: "Candidate", email: "candidate@careerhub.test", password: DEMO_PASSWORDS.candidate },
      { role: "Candidate", email: "candidate2@careerhub.test", password: DEMO_PASSWORDS.candidate },
      { role: "Candidate", email: "candidate3@careerhub.test", password: DEMO_PASSWORDS.candidate },
    ]);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
