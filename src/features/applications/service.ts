import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ApplicationStatus, InterviewStatus } from "@/generated/prisma/enums";
import type { Actor } from "@/server/auth/session";
import { prisma, isUniqueViolation } from "@/server/db";
import { notify } from "@/server/notifications";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { label } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/utils";
import { publicJobWhere } from "@/features/jobs/service";
import type { InterviewInput } from "./schemas";

const CLOSED_STATUSES: ApplicationStatus[] = ["HIRED", "REJECTED", "WITHDRAWN"];

/** Interview fields a candidate may see (internal notes excluded). */
const candidateInterviewSelect = {
  id: true,
  startsAt: true,
  durationMinutes: true,
  mode: true,
  location: true,
  status: true,
} satisfies Prisma.InterviewSelect;

// ─── Candidate side ─────────────────────────────────────────────────────────

export async function applyToJob(actor: Actor, input: { jobId: string; resumeId: string | null; coverLetter: string | null }) {
  if (actor.role !== "CANDIDATE") throw new ForbiddenError("Only candidates can apply to jobs.");

  const job = await prisma.job.findFirst({
    where: { id: input.jobId, ...publicJobWhere() },
    select: { id: true, title: true, postedById: true },
  });
  if (!job) throw new NotFoundError("This job is no longer accepting applications.");

  if (input.resumeId) {
    const owns = await prisma.resume.count({ where: { id: input.resumeId, ownerId: actor.id } });
    if (!owns) throw new ValidationError("Choose one of your own resumes.", { resumeId: "Choose one of your own resumes." });
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const application = await tx.application.create({
        data: { jobId: job.id, candidateId: actor.id, resumeId: input.resumeId, coverLetter: input.coverLetter },
      });
      await tx.applicationStatusEvent.create({
        data: { applicationId: application.id, toStatus: "APPLIED", changedById: actor.id },
      });
      await notify(
        {
          userId: job.postedById,
          type: "APPLICATION_RECEIVED",
          title: `New application for ${job.title}`,
          body: `${actor.name} applied.`,
          link: `/recruiter/applications/${application.id}`,
        },
        tx,
      );
      return application;
    });
  } catch (error) {
    // The (job_id, candidate_id) unique constraint is the final duplicate guard,
    // which also covers two simultaneous submissions.
    if (isUniqueViolation(error)) throw new ConflictError("You have already applied to this job.");
    throw error;
  }
}

export async function listCandidateApplications(actor: Actor, filters: { status?: ApplicationStatus; page: number }) {
  if (actor.role !== "CANDIDATE") throw new ForbiddenError();
  const where: Prisma.ApplicationWhereInput = { candidateId: actor.id, ...(filters.status ? { status: filters.status } : {}) };
  const [items, total] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        job: { select: { id: true, title: true, location: true, status: true, company: { select: { name: true, slug: true } } } },
      },
    }),
    prisma.application.count({ where }),
  ]);
  return { items, total, page: filters.page, pageSize: PAGE_SIZE };
}

/** Full application detail for its candidate. Internal notes are never included. */
export async function getCandidateApplication(actor: Actor, applicationId: string) {
  if (actor.role !== "CANDIDATE") throw new ForbiddenError();
  const application = await prisma.application.findFirst({
    where: { id: applicationId, candidateId: actor.id },
    select: {
      id: true,
      status: true,
      coverLetter: true,
      createdAt: true,
      updatedAt: true,
      resume: { select: { id: true, originalName: true } },
      job: {
        select: {
          id: true,
          title: true,
          location: true,
          workplaceType: true,
          employmentType: true,
          status: true,
          company: { select: { name: true, slug: true } },
        },
      },
      events: { orderBy: { createdAt: "asc" }, select: { id: true, fromStatus: true, toStatus: true, createdAt: true } },
      interviews: { orderBy: { startsAt: "asc" }, select: candidateInterviewSelect },
    },
  });
  if (!application) throw new NotFoundError("Application not found.");
  return application;
}

export async function withdrawApplication(actor: Actor, applicationId: string) {
  if (actor.role !== "CANDIDATE") throw new ForbiddenError();
  const application = await prisma.application.findFirst({
    where: { id: applicationId, candidateId: actor.id },
    select: { id: true, status: true, job: { select: { title: true, postedById: true } } },
  });
  if (!application) throw new NotFoundError("Application not found.");
  if (CLOSED_STATUSES.includes(application.status)) {
    throw new ValidationError(`This application is already ${label(application.status).toLowerCase()}.`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.application.update({ where: { id: applicationId }, data: { status: "WITHDRAWN" } });
    await tx.applicationStatusEvent.create({
      data: { applicationId, fromStatus: application.status, toStatus: "WITHDRAWN", changedById: actor.id },
    });
    await tx.interview.updateMany({ where: { applicationId, status: "SCHEDULED" }, data: { status: "CANCELLED" } });
    await notify(
      {
        userId: application.job.postedById,
        type: "APPLICATION_STATUS",
        title: `${actor.name} withdrew their application`,
        body: application.job.title,
        link: `/recruiter/applications/${applicationId}`,
      },
      tx,
    );
  });
}

export async function getCandidateDashboard(actor: Actor) {
  if (actor.role !== "CANDIDATE") throw new ForbiddenError();
  const [byStatus, recent, upcomingInterviews, savedCount, resumeCount, profile] = await Promise.all([
    prisma.application.groupBy({ by: ["status"], where: { candidateId: actor.id }, _count: { _all: true } }),
    prisma.application.findMany({
      where: { candidateId: actor.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, status: true, updatedAt: true, job: { select: { title: true, company: { select: { name: true } } } } },
    }),
    prisma.interview.findMany({
      where: { application: { candidateId: actor.id }, status: "SCHEDULED", startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 5,
      select: { ...candidateInterviewSelect, application: { select: { id: true, job: { select: { title: true, company: { select: { name: true } } } } } } },
    }),
    prisma.savedJob.count({ where: { userId: actor.id } }),
    prisma.resume.count({ where: { ownerId: actor.id } }),
    prisma.candidateProfile.findUnique({ where: { userId: actor.id }, select: { headline: true, skills: true, location: true } }),
  ]);
  const counts = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])) as Partial<Record<ApplicationStatus, number>>;
  const total = byStatus.reduce((sum, row) => sum + row._count._all, 0);
  const profileComplete = Boolean(profile?.headline && profile.location && profile.skills.length > 0 && resumeCount > 0);
  return { counts, total, recent, upcomingInterviews, savedCount, resumeCount, profileComplete };
}

// ─── Recruiter side ─────────────────────────────────────────────────────────

/** Loads an application whose job the recruiter owns, or throws. */
async function getOwnedApplication(actor: Actor, applicationId: string) {
  if (actor.role !== "RECRUITER") throw new ForbiddenError();
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true, candidateId: true, job: { select: { id: true, title: true, postedById: true } } },
  });
  if (!application) throw new NotFoundError("Application not found.");
  if (application.job.postedById !== actor.id) throw new ForbiddenError("You can only manage applicants for your own jobs.");
  return application;
}

export type ApplicantFilters = {
  jobId?: string;
  status?: ApplicationStatus;
  q?: string;
  skill?: string;
  sort?: "newest" | "oldest" | "experience";
  page: number;
};

export async function listApplicants(actor: Actor, filters: ApplicantFilters) {
  if (actor.role !== "RECRUITER") throw new ForbiddenError();
  const and: Prisma.ApplicationWhereInput[] = [{ job: { postedById: actor.id } }];
  if (filters.jobId) and.push({ jobId: filters.jobId });
  if (filters.status) and.push({ status: filters.status });
  if (filters.q) {
    and.push({
      OR: [
        { candidate: { name: { contains: filters.q, mode: "insensitive" } } },
        { candidate: { email: { contains: filters.q, mode: "insensitive" } } },
        { candidate: { candidateProfile: { headline: { contains: filters.q, mode: "insensitive" } } } },
      ],
    });
  }
  if (filters.skill) {
    and.push({ candidate: { candidateProfile: { skillKeys: { has: filters.skill.toLowerCase() } } } });
  }
  const where: Prisma.ApplicationWhereInput = { AND: and };
  const orderBy: Prisma.ApplicationOrderByWithRelationInput[] =
    filters.sort === "oldest"
      ? [{ createdAt: "asc" }]
      : filters.sort === "experience"
        ? [{ candidate: { candidateProfile: { experienceYears: { sort: "desc", nulls: "last" } } } }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }];

  const [items, total, statusCounts] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        status: true,
        createdAt: true,
        resumeId: true,
        job: { select: { id: true, title: true } },
        candidate: {
          select: {
            name: true,
            candidateProfile: { select: { headline: true, location: true, skills: true, experienceYears: true } },
          },
        },
        _count: { select: { interviews: true, notes: true } },
      },
    }),
    prisma.application.count({ where }),
    prisma.application.groupBy({
      by: ["status"],
      where: { job: { postedById: actor.id }, ...(filters.jobId ? { jobId: filters.jobId } : {}) },
      _count: { _all: true },
    }),
  ]);
  const counts = Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all])) as Partial<Record<ApplicationStatus, number>>;
  return { items, total, page: filters.page, pageSize: PAGE_SIZE, counts };
}

/** Application detail for the owning recruiter, including candidate profile, notes and interviews. */
export async function getApplicationForRecruiter(actor: Actor, applicationId: string) {
  await getOwnedApplication(actor, applicationId);
  return prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      coverLetter: true,
      createdAt: true,
      updatedAt: true,
      resume: { select: { id: true, originalName: true, sizeBytes: true, mimeType: true } },
      job: { select: { id: true, title: true, status: true } },
      candidate: {
        select: {
          id: true,
          name: true,
          email: true,
          candidateProfile: {
            select: {
              headline: true,
              summary: true,
              location: true,
              phone: true,
              skills: true,
              experienceYears: true,
              linkedinUrl: true,
              portfolioUrl: true,
              desiredEmploymentType: true,
              desiredWorkplaceType: true,
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fromStatus: true, toStatus: true, createdAt: true, changedBy: { select: { name: true } } },
      },
      notes: { orderBy: { createdAt: "desc" }, select: { id: true, body: true, createdAt: true, author: { select: { id: true, name: true } } } },
      interviews: { orderBy: { startsAt: "asc" } },
    },
  });
}

export async function updateApplicationStatus(actor: Actor, applicationId: string, toStatus: ApplicationStatus) {
  if (toStatus === "WITHDRAWN") throw new ValidationError("Only the candidate can withdraw an application.");
  const application = await getOwnedApplication(actor, applicationId);
  if (application.status === "WITHDRAWN") throw new ValidationError("The candidate withdrew this application; it can no longer be changed.");
  if (application.status === toStatus) return;

  await prisma.$transaction(async (tx) => {
    // Optimistic concurrency: only move from the status we just read.
    const { count } = await tx.application.updateMany({ where: { id: applicationId, status: application.status }, data: { status: toStatus } });
    if (count !== 1) throw new ConflictError("This application was updated by someone else. Reload and try again.");
    await tx.applicationStatusEvent.create({
      data: { applicationId, fromStatus: application.status, toStatus, changedById: actor.id },
    });
    if (toStatus === "REJECTED" || toStatus === "HIRED") {
      await tx.interview.updateMany({ where: { applicationId, status: "SCHEDULED", startsAt: { gt: new Date() } }, data: { status: "CANCELLED" } });
    }
    await notify(
      {
        userId: application.candidateId,
        type: "APPLICATION_STATUS",
        title: `Application update: ${application.job.title}`,
        body: `Your application status is now "${label(toStatus)}".`,
        link: `/candidate/applications/${applicationId}`,
      },
      tx,
    );
  });
}

export async function addApplicationNote(actor: Actor, applicationId: string, body: string) {
  await getOwnedApplication(actor, applicationId);
  await prisma.applicationNote.create({ data: { applicationId, authorId: actor.id, body } });
}

export async function deleteApplicationNote(actor: Actor, noteId: string) {
  const note = await prisma.applicationNote.findUnique({ where: { id: noteId }, select: { authorId: true, applicationId: true } });
  if (!note) throw new NotFoundError("Note not found.");
  await getOwnedApplication(actor, note.applicationId);
  if (note.authorId !== actor.id) throw new ForbiddenError("You can only delete your own notes.");
  await prisma.applicationNote.delete({ where: { id: noteId } });
  return note.applicationId;
}

export async function scheduleInterview(actor: Actor, input: InterviewInput) {
  const application = await getOwnedApplication(actor, input.applicationId);
  if (CLOSED_STATUSES.includes(application.status)) {
    throw new ValidationError(`Cannot schedule an interview for a ${label(application.status).toLowerCase()} application.`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.interview.create({
      data: {
        applicationId: application.id,
        scheduledById: actor.id,
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
        mode: input.mode,
        location: input.location,
        internalNotes: input.internalNotes,
      },
    });
    if (application.status === "APPLIED" || application.status === "SHORTLISTED") {
      await tx.application.update({ where: { id: application.id }, data: { status: "INTERVIEW" } });
      await tx.applicationStatusEvent.create({
        data: { applicationId: application.id, fromStatus: application.status, toStatus: "INTERVIEW", changedById: actor.id },
      });
    }
    await notify(
      {
        userId: application.candidateId,
        type: "INTERVIEW_SCHEDULED",
        title: `Interview scheduled: ${application.job.title}`,
        body: `${label(input.mode)} interview on ${input.startsAt.toISOString().slice(0, 16).replace("T", " ")} UTC.`,
        link: `/candidate/applications/${application.id}`,
      },
      tx,
    );
  });
}

export async function updateInterviewStatus(actor: Actor, interviewId: string, status: Exclude<InterviewStatus, "SCHEDULED">) {
  const interview = await prisma.interview.findUnique({ where: { id: interviewId }, select: { applicationId: true, status: true } });
  if (!interview) throw new NotFoundError("Interview not found.");
  const application = await getOwnedApplication(actor, interview.applicationId);
  if (interview.status !== "SCHEDULED") throw new ValidationError("Only scheduled interviews can be updated.");
  await prisma.$transaction(async (tx) => {
    await tx.interview.update({ where: { id: interviewId }, data: { status } });
    if (status === "CANCELLED") {
      await notify(
        {
          userId: application.candidateId,
          type: "INTERVIEW_UPDATED",
          title: `Interview cancelled: ${application.job.title}`,
          link: `/candidate/applications/${application.id}`,
        },
        tx,
      );
    }
  });
  return application.id;
}

export async function listRecruiterInterviews(actor: Actor, filters: { scope: "upcoming" | "past"; page: number }) {
  if (actor.role !== "RECRUITER") throw new ForbiddenError();
  const now = new Date();
  const where: Prisma.InterviewWhereInput = {
    application: { job: { postedById: actor.id } },
    ...(filters.scope === "upcoming" ? { startsAt: { gte: now }, status: "SCHEDULED" } : { OR: [{ startsAt: { lt: now } }, { status: { not: "SCHEDULED" } }] }),
  };
  const [items, total] = await Promise.all([
    prisma.interview.findMany({
      where,
      orderBy: { startsAt: filters.scope === "upcoming" ? "asc" : "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { application: { select: { id: true, candidate: { select: { name: true } }, job: { select: { title: true } } } } },
    }),
    prisma.interview.count({ where }),
  ]);
  return { items, total, page: filters.page, pageSize: PAGE_SIZE };
}
