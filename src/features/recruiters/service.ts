import "server-only";
import type { ApplicationStatus, JobStatus } from "@/generated/prisma/enums";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ForbiddenError } from "@/lib/errors";
import type { CompanyInput } from "./schemas";

function assertRecruiter(actor: Actor) {
  if (actor.role !== "RECRUITER") throw new ForbiddenError();
}

export async function getRecruiterContext(actor: Actor) {
  assertRecruiter(actor);
  const profile = await prisma.recruiterProfile.findUnique({ where: { userId: actor.id }, include: { company: true } });
  if (!profile) throw new ForbiddenError("Your recruiter profile is missing. Contact an administrator.");
  return profile;
}

/** Any recruiter attached to a company may edit its public profile. The slug stays stable. */
export async function updateCompany(actor: Actor, input: CompanyInput) {
  const profile = await getRecruiterContext(actor);
  await prisma.company.update({ where: { id: profile.companyId }, data: input });
}

export async function updateRecruiterProfile(actor: Actor, input: { jobTitle: string | null; phone: string | null }) {
  assertRecruiter(actor);
  await prisma.recruiterProfile.update({ where: { userId: actor.id }, data: input });
}

const FUNNEL: ApplicationStatus[] = ["SHORTLISTED", "INTERVIEW", "OFFERED", "HIRED"];

/** Recruitment statistics computed from the recruiter's own jobs and applications. */
export async function getRecruiterStats(actor: Actor) {
  assertRecruiter(actor);
  const ownJobs = { postedById: actor.id };
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [jobsByStatus, views, appsByStatus, recentApplicationsCount, jobs, perJobStatus, upcomingInterviews, recentApplications] =
    await Promise.all([
      prisma.job.groupBy({ by: ["status"], where: ownJobs, _count: { _all: true } }),
      prisma.job.aggregate({ where: ownJobs, _sum: { viewCount: true } }),
      prisma.application.groupBy({ by: ["status"], where: { job: ownJobs }, _count: { _all: true } }),
      prisma.application.count({ where: { job: ownJobs, createdAt: { gte: since } } }),
      prisma.job.findMany({
        where: ownJobs,
        orderBy: [{ status: "asc" }, { publishedAt: { sort: "desc", nulls: "last" } }],
        take: 8,
        select: { id: true, title: true, status: true, viewCount: true, publishedAt: true, _count: { select: { applications: true } } },
      }),
      prisma.application.groupBy({ by: ["jobId", "status"], where: { job: ownJobs }, _count: { _all: true } }),
      prisma.interview.findMany({
        where: { application: { job: ownJobs }, status: "SCHEDULED", startsAt: { gte: new Date() } },
        orderBy: { startsAt: "asc" },
        take: 5,
        include: { application: { select: { id: true, candidate: { select: { name: true } }, job: { select: { title: true } } } } },
      }),
      prisma.application.findMany({
        where: { job: ownJobs },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, status: true, createdAt: true, candidate: { select: { name: true } }, job: { select: { title: true } } },
      }),
    ]);

  const jobCounts = Object.fromEntries(jobsByStatus.map((r) => [r.status, r._count._all])) as Partial<Record<JobStatus, number>>;
  const appCounts = Object.fromEntries(appsByStatus.map((r) => [r.status, r._count._all])) as Partial<Record<ApplicationStatus, number>>;
  const totalApplications = appsByStatus.reduce((s, r) => s + r._count._all, 0);

  const progressedByJob = new Map<string, { progressed: number; hired: number }>();
  for (const row of perJobStatus) {
    const entry = progressedByJob.get(row.jobId) ?? { progressed: 0, hired: 0 };
    if (FUNNEL.includes(row.status)) entry.progressed += row._count._all;
    if (row.status === "HIRED") entry.hired += row._count._all;
    progressedByJob.set(row.jobId, entry);
  }

  return {
    jobCounts,
    appCounts,
    totalApplications,
    totalViews: views._sum.viewCount ?? 0,
    recentApplicationsCount,
    jobPerformance: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      status: job.status,
      views: job.viewCount,
      applications: job._count.applications,
      progressed: progressedByJob.get(job.id)?.progressed ?? 0,
      hired: progressedByJob.get(job.id)?.hired ?? 0,
    })),
    upcomingInterviews,
    recentApplications,
  };
}

/** Jobs list for filter drop-downs. */
export async function listOwnJobOptions(actor: Actor) {
  assertRecruiter(actor);
  return prisma.job.findMany({ where: { postedById: actor.id }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, status: true } });
}
