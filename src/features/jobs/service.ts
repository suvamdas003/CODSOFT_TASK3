import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { JobStatus } from "@/generated/prisma/enums";
import type { Actor } from "@/server/auth/session";
import { prisma, isUniqueViolation } from "@/server/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { PAGE_SIZE, skillKeysOf } from "@/lib/utils";
import type { JobInput, JobSearchFilters } from "./schemas";

// ─── Public visibility ──────────────────────────────────────────────────────

/** Jobs anyone may see: published, not removed by moderation, open, and posted by an active recruiter. */
export function publicJobWhere(now = new Date()): Prisma.JobWhereInput {
  return {
    status: "PUBLISHED",
    moderationStatus: "ACTIVE",
    postedBy: { status: "ACTIVE" },
    OR: [{ applicationDeadline: null }, { applicationDeadline: { gte: now } }],
  };
}

/** Fields safe to expose publicly. Never includes recruiter contact data. */
export const publicJobListSelect = {
  id: true,
  title: true,
  location: true,
  workplaceType: true,
  employmentType: true,
  experienceLevel: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  skills: true,
  publishedAt: true,
  applicationDeadline: true,
  company: { select: { name: true, slug: true, verified: true } },
} satisfies Prisma.JobSelect;

export type PublicJobListItem = Prisma.JobGetPayload<{ select: typeof publicJobListSelect }>;

export function buildJobSearchWhere(filters: JobSearchFilters, now = new Date()): Prisma.JobWhereInput {
  const and: Prisma.JobWhereInput[] = [publicJobWhere(now)];
  if (filters.q) {
    and.push({
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { company: { name: { contains: filters.q, mode: "insensitive" } } },
        { skillKeys: { has: filters.q.toLowerCase() } },
      ],
    });
  }
  if (filters.location) and.push({ location: { contains: filters.location, mode: "insensitive" } });
  if (filters.company) and.push({ company: { name: { contains: filters.company, mode: "insensitive" } } });
  if (filters.employmentType) and.push({ employmentType: filters.employmentType });
  if (filters.workplaceType) and.push({ workplaceType: filters.workplaceType });
  if (filters.experienceLevel) and.push({ experienceLevel: filters.experienceLevel });
  if (filters.minSalary !== undefined) {
    and.push({ OR: [{ salaryMax: { gte: filters.minSalary } }, { salaryMax: null, salaryMin: { gte: filters.minSalary } }] });
  }
  return { AND: and };
}

function jobOrderBy(sort: JobSearchFilters["sort"]): Prisma.JobOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ publishedAt: "asc" }, { id: "asc" }];
    case "salary_desc":
      return [{ salaryMax: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }];
    case "salary_asc":
      return [{ salaryMin: { sort: "asc", nulls: "last" } }, { publishedAt: "desc" }];
    default:
      return [{ publishedAt: "desc" }, { id: "desc" }];
  }
}

export async function searchJobs(filters: JobSearchFilters, viewer: Actor | null) {
  const where = buildJobSearchWhere(filters);
  const [items, total] = await Promise.all([
    prisma.job.findMany({
      where,
      select: {
        ...publicJobListSelect,
        ...(viewer?.role === "CANDIDATE" ? { savedBy: { where: { userId: viewer.id }, select: { userId: true } } } : {}),
      },
      orderBy: jobOrderBy(filters.sort),
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.job.count({ where }),
  ]);
  return {
    items: items.map(({ savedBy, ...job }) => ({ ...job, isSaved: Array.isArray(savedBy) && savedBy.length > 0 })),
    total,
    page: filters.page,
    pageSize: PAGE_SIZE,
  };
}

/**
 * A job detail page. Public jobs are visible to everyone; drafts, closed and
 * removed jobs only to the owning recruiter and administrators (preview).
 */
export async function getJobForViewer(jobId: string, viewer: Actor | null) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      ...publicJobListSelect,
      description: true,
      requirements: true,
      responsibilities: true,
      benefits: true,
      status: true,
      moderationStatus: true,
      moderationReason: true,
      postedById: true,
      company: { select: { name: true, slug: true, verified: true, description: true, website: true, industry: true, size: true, location: true } },
    },
  });
  if (!job) return null;

  const isOwner = viewer?.role === "RECRUITER" && viewer.id === job.postedById;
  const isAdmin = viewer?.role === "ADMIN";
  const isPublic = (await prisma.job.count({ where: { id: jobId, ...publicJobWhere() } })) === 1;
  if (!isPublic && !isOwner && !isAdmin) return null;

  let application: { id: string; status: string } | null = null;
  let isSaved = false;
  let hasReported = false;
  if (viewer?.role === "CANDIDATE") {
    [application, isSaved] = await Promise.all([
      prisma.application.findUnique({ where: { jobId_candidateId: { jobId, candidateId: viewer.id } }, select: { id: true, status: true } }),
      prisma.savedJob.count({ where: { userId: viewer.id, jobId } }).then((n) => n > 0),
    ]);
  }
  if (viewer) hasReported = (await prisma.jobReport.count({ where: { jobId, reporterId: viewer.id } })) > 0;

  const { postedById: _postedById, ...rest } = job;
  void _postedById;
  return { job: rest, isPublic, isOwner, isAdmin, application, isSaved, hasReported };
}

/** Counts a view of a public job (owners viewing their own listing are not counted). */
export async function recordJobView(jobId: string, viewer: Actor | null) {
  await prisma.job.updateMany({
    where: { id: jobId, ...publicJobWhere(), ...(viewer ? { NOT: { postedById: viewer.id } } : {}) },
    data: { viewCount: { increment: 1 } },
  });
}

export async function getLandingData() {
  const where = publicJobWhere();
  const [recentJobs, openJobs, companies, candidates, hires] = await Promise.all([
    prisma.job.findMany({ where, select: publicJobListSelect, orderBy: { publishedAt: "desc" }, take: 6 }),
    prisma.job.count({ where }),
    prisma.company.count({ where: { jobs: { some: where } } }),
    prisma.user.count({ where: { role: "CANDIDATE", status: "ACTIVE" } }),
    prisma.application.count({ where: { status: "HIRED" } }),
  ]);
  return { recentJobs, stats: { openJobs, companies, candidates, hires } };
}

export async function getCompanyPage(slug: string) {
  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, website: true, description: true, industry: true, size: true, location: true, verified: true },
  });
  if (!company) return null;
  const jobs = await prisma.job.findMany({
    where: { ...publicJobWhere(), companyId: company.id },
    select: publicJobListSelect,
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
  return { company, jobs };
}

// ─── Recruiter job management ───────────────────────────────────────────────

async function recruiterCompanyId(actor: Actor): Promise<string> {
  if (actor.role !== "RECRUITER") throw new ForbiddenError();
  const profile = await prisma.recruiterProfile.findUnique({ where: { userId: actor.id }, select: { companyId: true } });
  if (!profile) throw new ForbiddenError("Complete your recruiter profile first.");
  return profile.companyId;
}

/** Loads a job the actor owns, or throws. Recruiters can only manage jobs they posted. */
export async function getOwnedJob(actor: Actor, jobId: string) {
  if (actor.role !== "RECRUITER") throw new ForbiddenError();
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { _count: { select: { applications: true } } } });
  if (!job) throw new NotFoundError("Job not found.");
  if (job.postedById !== actor.id) throw new ForbiddenError("You can only manage jobs you posted.");
  return job;
}

function assertDeadlineOpen(deadline: Date | null) {
  if (deadline && deadline.getTime() < Date.now()) {
    throw new ValidationError("The application deadline is in the past.", { applicationDeadline: "Choose a future date to publish." });
  }
}

export async function createJob(actor: Actor, input: JobInput, publish: boolean) {
  const companyId = await recruiterCompanyId(actor);
  if (publish) assertDeadlineOpen(input.applicationDeadline);
  return prisma.job.create({
    data: {
      ...input,
      skillKeys: skillKeysOf(input.skills),
      companyId,
      postedById: actor.id,
      status: publish ? "PUBLISHED" : "DRAFT",
      publishedAt: publish ? new Date() : null,
    },
  });
}

export async function updateJob(actor: Actor, jobId: string, input: JobInput) {
  const job = await getOwnedJob(actor, jobId);
  if (job.status === "PUBLISHED") assertDeadlineOpen(input.applicationDeadline);
  return prisma.job.update({ where: { id: jobId }, data: { ...input, skillKeys: skillKeysOf(input.skills) } });
}

export async function setJobStatus(actor: Actor, jobId: string, status: JobStatus) {
  const job = await getOwnedJob(actor, jobId);
  if (job.status === status) return job;
  if (status === "DRAFT") throw new ValidationError("A job cannot be moved back to draft.");
  if (status === "PUBLISHED") {
    if (job.moderationStatus === "REMOVED") {
      throw new ForbiddenError("This job was removed by a moderator and cannot be republished.");
    }
    assertDeadlineOpen(job.applicationDeadline);
  }
  return prisma.job.update({
    where: { id: jobId },
    data:
      status === "PUBLISHED"
        ? { status, publishedAt: job.publishedAt ?? new Date(), closedAt: null }
        : { status, closedAt: new Date() },
  });
}

/** Jobs that already received applications cannot be deleted — close them instead. */
export async function deleteJob(actor: Actor, jobId: string) {
  const job = await getOwnedJob(actor, jobId);
  if (job._count.applications > 0) {
    throw new ConflictError("This job has applications and cannot be deleted. Close it instead to keep candidate history.");
  }
  await prisma.job.delete({ where: { id: jobId } });
}

export async function listRecruiterJobs(actor: Actor, filters: { status?: JobStatus; q?: string; page: number }) {
  if (actor.role !== "RECRUITER") throw new ForbiddenError();
  const where: Prisma.JobWhereInput = {
    postedById: actor.id,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q ? { title: { contains: filters.q, mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        location: true,
        status: true,
        moderationStatus: true,
        employmentType: true,
        publishedAt: true,
        applicationDeadline: true,
        viewCount: true,
        updatedAt: true,
        _count: { select: { applications: true } },
      },
    }),
    prisma.job.count({ where }),
  ]);
  return { items, total, page: filters.page, pageSize: PAGE_SIZE };
}

// ─── Saved jobs ─────────────────────────────────────────────────────────────

export async function toggleSavedJob(actor: Actor, jobId: string): Promise<boolean> {
  if (actor.role !== "CANDIDATE") throw new ForbiddenError("Only candidates can save jobs.");
  const existing = await prisma.savedJob.findUnique({ where: { userId_jobId: { userId: actor.id, jobId } } });
  if (existing) {
    await prisma.savedJob.delete({ where: { userId_jobId: { userId: actor.id, jobId } } });
    return false;
  }
  const visible = await prisma.job.count({ where: { id: jobId, ...publicJobWhere() } });
  if (!visible) throw new NotFoundError("This job is no longer available.");
  try {
    await prisma.savedJob.create({ data: { userId: actor.id, jobId } });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  return true;
}

export async function listSavedJobs(actor: Actor, page: number) {
  if (actor.role !== "CANDIDATE") throw new ForbiddenError();
  const where = { userId: actor.id };
  const [items, total] = await Promise.all([
    prisma.savedJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        createdAt: true,
        job: { select: { ...publicJobListSelect, status: true, moderationStatus: true } },
      },
    }),
    prisma.savedJob.count({ where }),
  ]);
  return { items, total, page, pageSize: PAGE_SIZE };
}

// ─── Reports ────────────────────────────────────────────────────────────────

export async function reportJob(actor: Actor, jobId: string, reason: Prisma.JobReportCreateInput["reason"], details: string | null) {
  const job = await prisma.job.findFirst({ where: { id: jobId, ...publicJobWhere() }, select: { postedById: true } });
  if (!job) throw new NotFoundError("This job is no longer available.");
  if (job.postedById === actor.id) throw new ValidationError("You cannot report your own job.");
  try {
    await prisma.jobReport.create({ data: { jobId, reporterId: actor.id, reason, details } });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("You have already reported this job. Our moderators will review it.");
    throw error;
  }
}
