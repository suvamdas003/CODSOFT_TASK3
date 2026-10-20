import { beforeAll, describe, expect, it } from "vitest";
import {
  addApplicationNote,
  applyToJob,
  deleteApplicationNote,
  getApplicationForRecruiter,
  getCandidateApplication,
  listApplicants,
  listCandidateApplications,
  scheduleInterview,
  updateApplicationStatus,
  updateInterviewStatus,
  withdrawApplication,
} from "@/features/applications/service";
import { deleteResume, getResumeForDownload, replaceResume, setDefaultResume, updateCandidateProfile, uploadResume } from "@/features/candidates/service";
import { createJob, setJobStatus } from "@/features/jobs/service";
import { prisma } from "@/server/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { createAdmin, createCandidate, createPublishedJob, createRecruiter, jobInput, pdfBytes, resetDatabase } from "../support/fixtures";

beforeAll(resetDatabase);

const inThreeDays = () => new Date(Date.now() + 3 * 86_400_000);

describe("applying", () => {
  it("creates an application with history and notifies the recruiter", async () => {
    const recruiter = await createRecruiter();
    const candidate = await createCandidate();
    const job = await createPublishedJob(recruiter);
    const resume = await uploadResume(candidate, { name: "cv.pdf", data: pdfBytes() });

    const app = await applyToJob(candidate, { jobId: job.id, resumeId: resume.id, coverLetter: "Hello" });
    expect(app.status).toBe("APPLIED");
    expect(await prisma.applicationStatusEvent.count({ where: { applicationId: app.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: recruiter.id, type: "APPLICATION_RECEIVED" } })).toBe(1);
    expect((await listCandidateApplications(candidate, { page: 1 })).total).toBe(1);
  });

  it("prevents duplicate applications, including concurrent submissions", async () => {
    const recruiter = await createRecruiter();
    const candidate = await createCandidate();
    const job = await createPublishedJob(recruiter);
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => applyToJob(candidate, { jobId: job.id, resumeId: null, coverLetter: null })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results.filter((r) => r.status === "rejected")) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
    }
    await expect(applyToJob(candidate, { jobId: job.id, resumeId: null, coverLetter: null })).rejects.toThrow("already applied");
    expect(await prisma.application.count({ where: { jobId: job.id } })).toBe(1);
  });

  it("rejects applications to closed/draft jobs, by non-candidates, or with someone else's resume", async () => {
    const recruiter = await createRecruiter();
    const candidate = await createCandidate();
    const other = await createCandidate();
    const draft = await createJob(recruiter, jobInput(), false);
    await expect(applyToJob(candidate, { jobId: draft.id, resumeId: null, coverLetter: null })).rejects.toBeInstanceOf(NotFoundError);

    const job = await createPublishedJob(recruiter);
    await setJobStatus(recruiter, job.id, "CLOSED");
    await expect(applyToJob(candidate, { jobId: job.id, resumeId: null, coverLetter: null })).rejects.toBeInstanceOf(NotFoundError);

    const open = await createPublishedJob(recruiter);
    await expect(applyToJob(recruiter, { jobId: open.id, resumeId: null, coverLetter: null })).rejects.toBeInstanceOf(ForbiddenError);
    const othersResume = await uploadResume(other, { name: "theirs.pdf", data: pdfBytes() });
    await expect(applyToJob(candidate, { jobId: open.id, resumeId: othersResume.id, coverLetter: null })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("candidate privacy", () => {
  it("lets candidates see only their own applications, without internal notes", async () => {
    const recruiter = await createRecruiter();
    const candidate = await createCandidate();
    const snooper = await createCandidate();
    const job = await createPublishedJob(recruiter);
    const app = await applyToJob(candidate, { jobId: job.id, resumeId: null, coverLetter: null });
    await addApplicationNote(recruiter, app.id, "Secret internal assessment");
    await scheduleInterview(recruiter, { applicationId: app.id, startsAt: inThreeDays(), durationMinutes: 30, mode: "VIDEO", location: "https://meet.example/x", internalNotes: "Ask about salary history" });

    const view = await getCandidateApplication(candidate, app.id);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("Secret internal assessment");
    expect(serialized).not.toContain("Ask about salary history");
    expect(view.interviews[0]).not.toHaveProperty("internalNotes");
    expect(view.interviews[0].location).toBe("https://meet.example/x");

    await expect(getCandidateApplication(snooper, app.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(withdrawApplication(snooper, app.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("recruiter pipeline", () => {
  it("moves applications through statuses with history and candidate notifications", async () => {
    const recruiter = await createRecruiter();
    const candidate = await createCandidate();
    const job = await createPublishedJob(recruiter);
    const app = await applyToJob(candidate, { jobId: job.id, resumeId: null, coverLetter: null });

    for (const status of ["SHORTLISTED", "INTERVIEW", "OFFERED", "HIRED"] as const) {
      await updateApplicationStatus(recruiter, app.id, status);
    }
    const detail = await getApplicationForRecruiter(recruiter, app.id);
    expect(detail.status).toBe("HIRED");
    expect(detail.events.map((e) => e.toStatus)).toEqual(["APPLIED", "SHORTLISTED", "INTERVIEW", "OFFERED", "HIRED"]);
    expect(await prisma.notification.count({ where: { userId: candidate.id, type: "APPLICATION_STATUS" } })).toBe(4);
    await expect(updateApplicationStatus(recruiter, app.id, "WITHDRAWN")).rejects.toBeInstanceOf(ValidationError);
  });

  it("denies other recruiters access to applicants, notes, interviews and status changes", async () => {
    const owner = await createRecruiter();
    const outsider = await createRecruiter("Rival Co");
    const candidate = await createCandidate();
    const job = await createPublishedJob(owner);
    const app = await applyToJob(candidate, { jobId: job.id, resumeId: null, coverLetter: null });

    await expect(getApplicationForRecruiter(outsider, app.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateApplicationStatus(outsider, app.id, "REJECTED")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addApplicationNote(outsider, app.id, "x")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(scheduleInterview(outsider, { applicationId: app.id, startsAt: inThreeDays(), durationMinutes: 30, mode: "PHONE", location: null, internalNotes: null })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getApplicationForRecruiter(candidate, app.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await listApplicants(outsider, { page: 1 })).total).toBe(0);
    expect((await listApplicants(owner, { page: 1 })).total).toBe(1);
  });

  it("filters applicants by job, status, name and skill (case-insensitive)", async () => {
    const recruiter = await createRecruiter();
    const jobA = await createPublishedJob(recruiter, { title: "Job A" });
    const jobB = await createPublishedJob(recruiter, { title: "Job B" });
    const ada = await createCandidate("Ada Lovelace");
    const bob = await createCandidate("Bob Builder");
    await updateCandidateProfile(ada, { headline: "Analyst", summary: null, location: null, phone: null, skills: ["Python", "SQL"], experienceYears: 5, desiredEmploymentType: null, desiredWorkplaceType: null, linkedinUrl: null, portfolioUrl: null, openToWork: true });
    const appAda = await applyToJob(ada, { jobId: jobA.id, resumeId: null, coverLetter: null });
    await applyToJob(bob, { jobId: jobB.id, resumeId: null, coverLetter: null });
    await updateApplicationStatus(recruiter, appAda.id, "SHORTLISTED");

    expect((await listApplicants(recruiter, { page: 1, jobId: jobA.id })).items.map((a) => a.candidate.name)).toEqual(["Ada Lovelace"]);
    expect((await listApplicants(recruiter, { page: 1, status: "SHORTLISTED" })).total).toBe(1);
    expect((await listApplicants(recruiter, { page: 1, q: "bob" })).items[0].candidate.name).toBe("Bob Builder");
    expect((await listApplicants(recruiter, { page: 1, skill: "python" })).items.map((a) => a.candidate.name)).toEqual(["Ada Lovelace"]);
    expect((await listApplicants(recruiter, { page: 1 })).counts).toMatchObject({ APPLIED: 1, SHORTLISTED: 1 });
  });

  it("schedules interviews (moving the application to INTERVIEW) and manages notes", async () => {
    const recruiter = await createRecruiter();
    const candidate = await createCandidate();
    const job = await createPublishedJob(recruiter);
    const app = await applyToJob(candidate, { jobId: job.id, resumeId: null, coverLetter: null });
    await scheduleInterview(recruiter, { applicationId: app.id, startsAt: inThreeDays(), durationMinutes: 45, mode: "ONSITE", location: "HQ", internalNotes: null });
    const detail = await getApplicationForRecruiter(recruiter, app.id);
    expect(detail.status).toBe("INTERVIEW");
    expect(detail.interviews).toHaveLength(1);
    expect(await prisma.notification.count({ where: { userId: candidate.id, type: "INTERVIEW_SCHEDULED" } })).toBe(1);

    await updateInterviewStatus(recruiter, detail.interviews[0].id, "CANCELLED");
    await expect(updateInterviewStatus(recruiter, detail.interviews[0].id, "COMPLETED")).rejects.toBeInstanceOf(ValidationError);

    await addApplicationNote(recruiter, app.id, "Good culture fit");
    const note = await prisma.applicationNote.findFirstOrThrow({ where: { applicationId: app.id } });
    await expect(deleteApplicationNote(await createRecruiter(), note.id)).rejects.toBeInstanceOf(ForbiddenError);
    await deleteApplicationNote(recruiter, note.id);
    expect(await prisma.applicationNote.count({ where: { applicationId: app.id } })).toBe(0);
  });

  it("lets candidates withdraw, which locks the pipeline and cancels interviews", async () => {
    const recruiter = await createRecruiter();
    const candidate = await createCandidate();
    const job = await createPublishedJob(recruiter);
    const app = await applyToJob(candidate, { jobId: job.id, resumeId: null, coverLetter: null });
    await scheduleInterview(recruiter, { applicationId: app.id, startsAt: inThreeDays(), durationMinutes: 30, mode: "VIDEO", location: null, internalNotes: null });
    await withdrawApplication(candidate, app.id);
    expect((await prisma.interview.findFirstOrThrow({ where: { applicationId: app.id } })).status).toBe("CANCELLED");
    await expect(updateApplicationStatus(recruiter, app.id, "SHORTLISTED")).rejects.toBeInstanceOf(ValidationError);
    await expect(withdrawApplication(candidate, app.id)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("resume storage and access control", () => {
  it("lets the owner upload, replace, set default, download and delete", async () => {
    const candidate = await createCandidate();
    const first = await uploadResume(candidate, { name: "first.pdf", data: pdfBytes("one") });
    const second = await uploadResume(candidate, { name: "second.pdf", data: pdfBytes("two") });
    expect(first.isDefault).toBe(true);
    expect(second.isDefault).toBe(false);

    await setDefaultResume(candidate, second.id);
    expect((await prisma.resume.findUniqueOrThrow({ where: { id: second.id } })).isDefault).toBe(true);
    expect((await prisma.resume.findUniqueOrThrow({ where: { id: first.id } })).isDefault).toBe(false);

    await replaceResume(candidate, first.id, { name: "first-v2.pdf", data: pdfBytes("one-v2") });
    const download = await getResumeForDownload(candidate, first.id);
    expect(download.resume.originalName).toBe("first-v2.pdf");
    expect(download.data.toString("latin1")).toContain("one-v2");

    await deleteResume(candidate, second.id);
    expect((await prisma.resume.findUniqueOrThrow({ where: { id: first.id } })).isDefault).toBe(true);
    await expect(getResumeForDownload(candidate, second.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects invalid files and enforces the per-candidate limit", async () => {
    const candidate = await createCandidate();
    await expect(uploadResume(candidate, { name: "virus.exe", data: Buffer.from("MZ") })).rejects.toBeInstanceOf(ValidationError);
    await expect(uploadResume(candidate, { name: "fake.pdf", data: Buffer.from("<script>alert(1)</script>") })).rejects.toBeInstanceOf(ValidationError);
    await prisma.platformSettings.update({ where: { id: 1 }, data: { maxResumesPerCandidate: 2 } });
    await uploadResume(candidate, { name: "a.pdf", data: pdfBytes() });
    await uploadResume(candidate, { name: "b.pdf", data: pdfBytes() });
    await expect(uploadResume(candidate, { name: "c.pdf", data: pdfBytes() })).rejects.toThrow(/at most 2/);
    await prisma.platformSettings.update({ where: { id: 1 }, data: { maxResumesPerCandidate: 5 } });
    await expect(uploadResume(await createRecruiter(), { name: "a.pdf", data: pdfBytes() })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows downloads only by the owner or the recruiter of a job the resume was submitted to", async () => {
    const owner = await createRecruiter();
    const outsider = await createRecruiter("Outsider");
    const admin = await createAdmin();
    const candidate = await createCandidate();
    const otherCandidate = await createCandidate();
    const job = await createPublishedJob(owner);
    const resume = await uploadResume(candidate, { name: "cv.pdf", data: pdfBytes() });
    const unsubmitted = await uploadResume(candidate, { name: "private.pdf", data: pdfBytes() });
    const app = await applyToJob(candidate, { jobId: job.id, resumeId: resume.id, coverLetter: null });

    await expect(getResumeForDownload(owner, resume.id)).resolves.toMatchObject({ resume: { id: resume.id } });
    for (const actor of [outsider, admin, otherCandidate]) {
      await expect(getResumeForDownload(actor, resume.id)).rejects.toBeInstanceOf(NotFoundError);
    }
    await expect(getResumeForDownload(owner, unsubmitted.id)).rejects.toBeInstanceOf(NotFoundError);

    // After withdrawal the recruiter loses access.
    await withdrawApplication(candidate, app.id);
    await expect(getResumeForDownload(owner, resume.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("keeps applications when a resume is deleted but removes the file link", async () => {
    const recruiter = await createRecruiter();
    const candidate = await createCandidate();
    const job = await createPublishedJob(recruiter);
    const resume = await uploadResume(candidate, { name: "cv.pdf", data: pdfBytes() });
    const app = await applyToJob(candidate, { jobId: job.id, resumeId: resume.id, coverLetter: null });
    await deleteResume(candidate, resume.id);
    const after = await prisma.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(after.resumeId).toBeNull();
  });
});
