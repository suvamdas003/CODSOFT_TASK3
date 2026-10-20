import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { JobStatus, ModerationStatus, ReportStatus, Role, UserStatus } from "@/generated/prisma/enums";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { notify } from "@/server/notifications";
import { getPlatformSettings } from "@/server/settings";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { PAGE_SIZE } from "@/lib/utils";

function assertAdmin(actor: Actor) {
  if (actor.role !== "ADMIN") throw new ForbiddenError("Administrator access required.");
}

// ─── Metrics ────────────────────────────────────────────────────────────────

export async function getPlatformMetrics(actor: Actor) {
  assertAdmin(actor);
  const now = Date.now();
  const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const since14 = new Date(now - 13 * 24 * 60 * 60 * 1000);
  since14.setUTCHours(0, 0, 0, 0);

  const [usersByRole, suspended, newUsers, jobsByStatus, removedJobs, appsByStatus, openReports, recentApps, recentAudit] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: { createdAt: { gte: since30 } } }),
    prisma.job.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.job.count({ where: { moderationStatus: "REMOVED" } }),
    prisma.application.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.jobReport.count({ where: { status: "OPEN" } }),
    prisma.application.findMany({ where: { createdAt: { gte: since14 } }, select: { createdAt: true } }),
    prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { actor: { select: { name: true } } } }),
  ]);

  // Applications per day for the last 14 days (UTC).
  const daily: { day: string; count: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since14.getTime() + i * 24 * 60 * 60 * 1000);
    daily.push({ day: d.toISOString().slice(0, 10), count: 0 });
  }
  const index = new Map(daily.map((d, i) => [d.day, i]));
  for (const app of recentApps) {
    const i = index.get(app.createdAt.toISOString().slice(0, 10));
    if (i !== undefined) daily[i].count += 1;
  }

  return {
    users: Object.fromEntries(usersByRole.map((r) => [r.role, r._count._all])) as Partial<Record<Role, number>>,
    suspended,
    newUsers,
    jobs: Object.fromEntries(jobsByStatus.map((r) => [r.status, r._count._all])) as Partial<Record<JobStatus, number>>,
    removedJobs,
    applications: Object.fromEntries(appsByStatus.map((r) => [r.status, r._count._all])) as Partial<Record<string, number>>,
    totalApplications: appsByStatus.reduce((s, r) => s + r._count._all, 0),
    openReports,
    daily,
    recentAudit,
  };
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function listUsers(actor: Actor, filters: { q?: string; role?: Role; status?: UserStatus; page: number }) {
  assertAdmin(actor);
  const where: Prisma.UserWhereInput = {
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? { OR: [{ name: { contains: filters.q, mode: "insensitive" } }, { email: { contains: filters.q, mode: "insensitive" } }] }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        recruiterProfile: { select: { company: { select: { name: true } } } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page: filters.page, pageSize: PAGE_SIZE };
}

/** Suspends or reactivates an account. Suspension revokes all sessions immediately. */
export async function setUserStatus(actor: Actor, userId: string, status: UserStatus, reason: string | null, ip: string | null) {
  assertAdmin(actor);
  if (userId === actor.id) throw new ValidationError("You cannot change the status of your own account.");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true, email: true } });
  if (!user) throw new NotFoundError("User not found.");
  if (user.status === status) return;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status } });
    if (status === "SUSPENDED") await tx.session.deleteMany({ where: { userId } });
    await recordAudit(
      { actorId: actor.id, action: status === "SUSPENDED" ? "user.suspend" : "user.reactivate", entityType: "User", entityId: userId, metadata: { email: user.email, reason }, ipAddress: ip },
      tx,
    );
  });
}

// ─── Companies / recruiters ─────────────────────────────────────────────────

export async function listCompanies(actor: Actor, filters: { q?: string; verified?: boolean; page: number }) {
  assertAdmin(actor);
  const where: Prisma.CompanyWhereInput = {
    ...(filters.verified !== undefined ? { verified: filters.verified } : {}),
    ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        recruiters: { select: { user: { select: { id: true, name: true, email: true, status: true } } } },
        _count: { select: { jobs: true } },
      },
    }),
    prisma.company.count({ where }),
  ]);
  return { items, total, page: filters.page, pageSize: PAGE_SIZE };
}

export async function setCompanyVerified(actor: Actor, companyId: string, verified: boolean, ip: string | null) {
  assertAdmin(actor);
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
  if (!company) throw new NotFoundError("Company not found.");
  await prisma.$transaction(async (tx) => {
    await tx.company.update({ where: { id: companyId }, data: { verified } });
    await recordAudit({ actorId: actor.id, action: verified ? "company.verify" : "company.unverify", entityType: "Company", entityId: companyId, metadata: { name: company.name }, ipAddress: ip }, tx);
  });
}

// ─── Job moderation ─────────────────────────────────────────────────────────

export async function listJobsForModeration(
  actor: Actor,
  filters: { q?: string; status?: JobStatus; moderation?: ModerationStatus; reported?: boolean; page: number },
) {
  assertAdmin(actor);
  const where: Prisma.JobWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.moderation ? { moderationStatus: filters.moderation } : {}),
    ...(filters.reported ? { reports: { some: { status: "OPEN" } } } : {}),
    ...(filters.q
      ? { OR: [{ title: { contains: filters.q, mode: "insensitive" } }, { company: { name: { contains: filters.q, mode: "insensitive" } } }] }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        status: true,
        moderationStatus: true,
        moderationReason: true,
        createdAt: true,
        company: { select: { name: true, verified: true } },
        postedBy: { select: { name: true, email: true } },
        _count: { select: { applications: true, reports: { where: { status: "OPEN" } } } },
      },
    }),
    prisma.job.count({ where }),
  ]);
  return { items, total, page: filters.page, pageSize: PAGE_SIZE };
}

export async function moderateJob(actor: Actor, jobId: string, decision: "REMOVE" | "RESTORE", reason: string | null, ip: string | null) {
  assertAdmin(actor);
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, title: true, postedById: true, moderationStatus: true } });
  if (!job) throw new NotFoundError("Job not found.");
  const target: ModerationStatus = decision === "REMOVE" ? "REMOVED" : "ACTIVE";
  if (job.moderationStatus === target) return;
  await prisma.$transaction(async (tx) => {
    await tx.job.update({ where: { id: jobId }, data: { moderationStatus: target, moderationReason: decision === "REMOVE" ? reason : null } });
    await recordAudit({ actorId: actor.id, action: decision === "REMOVE" ? "job.remove" : "job.restore", entityType: "Job", entityId: jobId, metadata: { title: job.title, reason }, ipAddress: ip }, tx);
    await notify(
      {
        userId: job.postedById,
        type: "JOB_MODERATED",
        title: decision === "REMOVE" ? `Your listing "${job.title}" was removed` : `Your listing "${job.title}" was restored`,
        body: decision === "REMOVE" ? `Reason: ${reason}` : "It is visible to candidates again if published.",
        link: `/recruiter/jobs/${jobId}`,
      },
      tx,
    );
  });
}

// ─── Reports ────────────────────────────────────────────────────────────────

export async function listReports(actor: Actor, filters: { status?: ReportStatus; page: number }) {
  assertAdmin(actor);
  const where: Prisma.JobReportWhereInput = filters.status ? { status: filters.status } : {};
  const [items, total] = await Promise.all([
    prisma.jobReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        job: { select: { id: true, title: true, moderationStatus: true, company: { select: { name: true } } } },
        reporter: { select: { name: true, email: true } },
        resolvedBy: { select: { name: true } },
      },
    }),
    prisma.jobReport.count({ where }),
  ]);
  return { items, total, page: filters.page, pageSize: PAGE_SIZE };
}

export async function resolveReport(
  actor: Actor,
  input: { reportId: string; resolution: "RESOLVED" | "DISMISSED"; note: string | null; removeJob: boolean },
  ip: string | null,
) {
  assertAdmin(actor);
  const report = await prisma.jobReport.findUnique({ where: { id: input.reportId }, select: { id: true, status: true, jobId: true, reason: true } });
  if (!report) throw new NotFoundError("Report not found.");
  if (report.status !== "OPEN") throw new ValidationError("This report has already been handled.");
  await prisma.$transaction(async (tx) => {
    await tx.jobReport.update({
      where: { id: report.id },
      data: { status: input.resolution, resolutionNote: input.note, resolvedById: actor.id, resolvedAt: new Date() },
    });
    await recordAudit(
      { actorId: actor.id, action: `report.${input.resolution.toLowerCase()}`, entityType: "JobReport", entityId: report.id, metadata: { jobId: report.jobId, reason: report.reason, note: input.note }, ipAddress: ip },
      tx,
    );
  });
  if (input.resolution === "RESOLVED" && input.removeJob) {
    await moderateJob(actor, report.jobId, "REMOVE", input.note ?? `Reported: ${report.reason.toLowerCase()}`, ip);
  }
}

// ─── Settings & audit ───────────────────────────────────────────────────────

export async function getSettings(actor: Actor) {
  assertAdmin(actor);
  return getPlatformSettings();
}

export async function updateSettings(
  actor: Actor,
  input: { allowCandidateRegistration: boolean; allowRecruiterRegistration: boolean; maxResumesPerCandidate: number; announcement: string | null },
  ip: string | null,
) {
  assertAdmin(actor);
  await prisma.$transaction(async (tx) => {
    const before = await getPlatformSettings(tx);
    await tx.platformSettings.update({ where: { id: 1 }, data: { ...input, updatedById: actor.id } });
    const changes = Object.fromEntries(
      (Object.keys(input) as (keyof typeof input)[])
        .filter((key) => before[key] !== input[key])
        .map((key) => [key, { from: before[key], to: input[key] }]),
    );
    await recordAudit({ actorId: actor.id, action: "settings.update", entityType: "PlatformSettings", entityId: "1", metadata: changes, ipAddress: ip }, tx);
  });
}

export async function listAuditEvents(actor: Actor, filters: { action?: string; entityType?: string; q?: string; page: number }) {
  assertAdmin(actor);
  const where: Prisma.AuditEventWhereInput = {
    ...(filters.action ? { action: { startsWith: filters.action } } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.q ? { actor: { OR: [{ name: { contains: filters.q, mode: "insensitive" } }, { email: { contains: filters.q, mode: "insensitive" } }] } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE * 2,
      take: PAGE_SIZE * 2,
      include: { actor: { select: { name: true, email: true } } },
    }),
    prisma.auditEvent.count({ where }),
  ]);
  return { items, total, page: filters.page, pageSize: PAGE_SIZE * 2 };
}
