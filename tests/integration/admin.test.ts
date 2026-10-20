import { beforeAll, describe, expect, it } from "vitest";
import {
  getPlatformMetrics,
  listAuditEvents,
  listJobsForModeration,
  listUsers,
  moderateJob,
  resolveReport,
  setCompanyVerified,
  updateSettings,
} from "@/features/admin/service";
import { getRecruiterStats } from "@/features/recruiters/service";
import { applyToJob, updateApplicationStatus } from "@/features/applications/service";
import { getJobForViewer, recordJobView, reportJob, searchJobs, setJobStatus } from "@/features/jobs/service";
import { prisma } from "@/server/db";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { createAdmin, createCandidate, createPublishedJob, createRecruiter, resetDatabase } from "../support/fixtures";

beforeAll(resetDatabase);

describe("administrator moderation", () => {
  it("removes and restores listings with audit events and recruiter notifications", async () => {
    const admin = await createAdmin();
    const recruiter = await createRecruiter();
    const tag = `mod${Date.now()}`;
    const job = await createPublishedJob(recruiter, { title: tag });

    await moderateJob(admin, job.id, "REMOVE", "Fraudulent listing", null);
    expect((await searchJobs({ page: 1, q: tag }, null)).total).toBe(0);
    expect(await getJobForViewer(job.id, null)).toBeNull();
    expect((await getJobForViewer(job.id, recruiter))?.job.moderationReason).toBe("Fraudulent listing");
    await expect(setJobStatus(recruiter, job.id, "CLOSED")).resolves.toBeTruthy();
    await expect(setJobStatus(recruiter, job.id, "PUBLISHED")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await prisma.notification.count({ where: { userId: recruiter.id, type: "JOB_MODERATED" } })).toBe(1);

    await moderateJob(admin, job.id, "RESTORE", null, null);
    await setJobStatus(recruiter, job.id, "PUBLISHED");
    expect((await searchJobs({ page: 1, q: tag }, null)).total).toBe(1);

    const actions = (await prisma.auditEvent.findMany({ where: { entityId: job.id }, orderBy: { createdAt: "asc" } })).map((e) => e.action);
    expect(actions).toEqual(["job.remove", "job.restore"]);
  });

  it("resolves reports and can remove the reported job in one step", async () => {
    const admin = await createAdmin();
    const recruiter = await createRecruiter();
    const candidate = await createCandidate();
    const job = await createPublishedJob(recruiter);
    await reportJob(candidate, job.id, "FRAUD", "scam");
    const report = await prisma.jobReport.findFirstOrThrow({ where: { jobId: job.id } });

    expect((await listJobsForModeration(admin, { page: 1, reported: true })).items.map((j) => j.id)).toContain(job.id);
    await resolveReport(admin, { reportId: report.id, resolution: "RESOLVED", note: "Confirmed scam", removeJob: true }, null);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).moderationStatus).toBe("REMOVED");
    expect((await prisma.jobReport.findUniqueOrThrow({ where: { id: report.id } })).status).toBe("RESOLVED");
    await expect(resolveReport(admin, { reportId: report.id, resolution: "DISMISSED", note: null, removeJob: false }, null)).rejects.toBeInstanceOf(ValidationError);
  });

  it("verifies companies and updates settings with audited diffs", async () => {
    const admin = await createAdmin();
    const recruiter = await createRecruiter("Verify Me");
    const profile = await prisma.recruiterProfile.findUniqueOrThrow({ where: { userId: recruiter.id } });
    await setCompanyVerified(admin, profile.companyId, true, "203.0.113.5");
    expect((await prisma.company.findUniqueOrThrow({ where: { id: profile.companyId } })).verified).toBe(true);

    await updateSettings(admin, { allowCandidateRegistration: true, allowRecruiterRegistration: false, maxResumesPerCandidate: 7, announcement: "Maintenance tonight" }, null);
    const event = await prisma.auditEvent.findFirstOrThrow({ where: { action: "settings.update" }, orderBy: { createdAt: "desc" } });
    expect(event.metadata).toMatchObject({ maxResumesPerCandidate: { from: 5, to: 7 }, allowRecruiterRegistration: { from: true, to: false } });

    const audit = await listAuditEvents(admin, { page: 1, action: "company." });
    expect(audit.items[0]).toMatchObject({ action: "company.verify", ipAddress: "203.0.113.5" });

    await updateSettings(admin, { allowCandidateRegistration: true, allowRecruiterRegistration: true, maxResumesPerCandidate: 5, announcement: null }, null);
  });

  it("restricts every admin operation to administrators", async () => {
    const recruiter = await createRecruiter();
    const candidate = await createCandidate();
    for (const actor of [recruiter, candidate]) {
      await expect(getPlatformMetrics(actor)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listUsers(actor, { page: 1 })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(moderateJob(actor, "x", "REMOVE", "r", null)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listAuditEvents(actor, { page: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});

describe("statistics come from real data", () => {
  it("computes recruiter and platform metrics from the database", async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "applications","jobs" CASCADE`);
    const admin = await createAdmin();
    const recruiter = await createRecruiter();
    const job = await createPublishedJob(recruiter);
    await recordJobView(job.id, null);
    await recordJobView(job.id, null);
    const [c1, c2] = [await createCandidate(), await createCandidate()];
    const a1 = await applyToJob(c1, { jobId: job.id, resumeId: null, coverLetter: null });
    await applyToJob(c2, { jobId: job.id, resumeId: null, coverLetter: null });
    await updateApplicationStatus(recruiter, a1.id, "HIRED");

    const stats = await getRecruiterStats(recruiter);
    expect(stats).toMatchObject({ totalApplications: 2, totalViews: 2, jobCounts: { PUBLISHED: 1 }, appCounts: { HIRED: 1, APPLIED: 1 } });
    expect(stats.jobPerformance[0]).toMatchObject({ id: job.id, applications: 2, hired: 1, progressed: 1 });

    const metrics = await getPlatformMetrics(admin);
    expect(metrics.totalApplications).toBe(2);
    expect(metrics.jobs.PUBLISHED).toBe(1);
    expect(metrics.daily.reduce((s, d) => s + d.count, 0)).toBe(2);
  });
});
